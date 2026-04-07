# 创建数字员工弹窗（自定义输入 → 自动 provision）

## 背景与目标

当前系统的“添加员工”能力已经存在：前端调用 `useEmployeesStore.addEmployee`，后端 `POST /api/employees/provision` 会为新员工创建 OpenClaw agent 的工作区文件（`SOUL.md / AGENTS.md / IDENTITY.md` 等），并在返回后把新员工写入 `myEmployees`（同时通过 Gateway 重载使运行时可用）。

你提出的需求是：新增/替换“创建员工”入口为“创建数字员工”，让用户按 `src/data/employees/academic/academic-anthropologist.json` 的关键字段习惯输入，创建完成后自动加入系统（效果与“添加到我的员工”一致）。

### 用户输入字段（用户只填这些）
- `员工名称`（必填）
- `vibe（一句话简述）`（必填）
- `soulContent`（必填）
- `agentsContent`（必填）
- `emoji`（从固定 emoji 集合中选择；必填）
- `color`（颜色自定义；必填，使用颜色选择器）

不需要用户填写：id、模型选择、department、description、identityContent 等“内部必填”字段。

## 成功标准

1. 用户在 UI 中点击“创建数字员工”后，只看到上述输入项。
2. 提交后系统能成功 provision：生成对应 OpenClaw agent + 工作区 Markdown 文件。
3. provision 成功后，新员工会出现在“我的员工”列表中（且 `linkedAgentId` 等关联信息被写入）。
4. 新员工的模型遵循“继承方式”，不写显式 `model` override；其模型来源与 main 的“默认继承链路”保持一致（见“模型策略与风险”）。
5. `department=custom` 能被 UI 正常渲染（部门标签可见，筛选栏可选），不破坏现有类型与 i18n。
6. `employee.id`（uuid）与 OpenClaw provision 返回的 `agentId`（由后端基于 `nameZh` slugify）存在差异：UI 显示与关联以 `linkedAgentId` 为准。

## 设计范围

### 需要变更的部分
- UI：`src/pages/Agents/index.tsx`
  - 将现有“创建员工”弹窗替换为“创建数字员工”弹窗（字段、校验、提交逻辑变化）。
- 数据模型/渲染：
  - `src/types/employee.ts`：扩展 `Department` 联合类型加入 `custom`。
  - `src/types/employee.ts`：补齐 `DEPARTMENT_MAP.custom`（emoji/描述可用同样的“自定义”语义）。
  - `src/i18n/locales/zh/employees.json`：补齐 `departments.custom = "自定义"`（并确保 i18n keys 可用）。
- 创建链路复用：
  - 复用现有 `useEmployeesStore.addEmployee` → `POST /api/employees/provision` → `provisionDigitalEmployeeAgent` 的后端写文件与注册逻辑（不新增新的后端接口）。

## 模型策略与风险

### 策略（你确认的最终选择）
- **不写显式 `model` override**。
- 新员工 provision 后的模型由 OpenClaw 的继承逻辑决定，依赖 `agents.defaults.model` 的“继承 defaults”行为。

### 关键假设
- main agent 的“当前生效模型”与 `agents.defaults.model` 来源在语义上保持一致；因此新 agent 在继承 defaults 时能得到你预期的主模型。

### 风险
- 如果 main agent 存在显式 per-agent model 配置，导致 main 的“当前生效模型”与 defaults 不一致，那么新员工将继承 defaults 而非 main 当前模型（两者可能不同）。
- 另外：如果 `agents.defaults.model` 未配置或不满足 OpenClaw 运行时可解析的格式，虽然快照生成层可能仍能拿到某个字符串，但 Gateway/运行时可能无法正确加载模型；因此需要在实施阶段把“defaults.model 必须能被 OpenClaw 运行时解析”作为硬前置条件。

### 降级/补救方案（若上线后反馈不一致）
- 额外一步在后端复制 main 当前生效 model 为 defaults（仍保持“继承方式”，而非显式 override 到单个 agent）。

## UI 设计：创建数字员工弹窗

### 弹窗标题与布局
- 标题：`创建数字员工`
- 顶部关闭按钮：右上角（与现有弹窗一致）

### 表单字段
1. `员工名称`（必填）
   - 单行输入
2. `vibe（一句话简述）`（必填）
   - 多行输入（建议与截图风格一致）
3. `角色定位与策略`（对应 `soulContent`，必填）
   - 多行输入
4. `智能体的工作内容`（对应 `agentsContent`，必填）
   - 多行输入
5. `emoji`（必填）
   - 固定下拉/选择列表（你确认集合）
   - emoji 集合：`🌍 🧠 📚 🗺️ 🎓 🧪 ⭐ 🎨 🎮 💻 🧬 🤖`
6. `color`（必填）
   - `<input type="color" />`
   - 当前仅用于列表/卡片展示的颜色（不会进入工作区 Markdown 写入）

### 按钮与状态
- `创建`：loading 时禁用并显示 loading 状态
- `取消`：关闭弹窗，不做任何写入

### 校验与错误处理
- 必填校验：任一必填（员工名称、vibe、soulContent、agentsContent、emoji、color）在 `trim()` 后为空时禁止提交或提交时报错（toast）
- `color` 必须是合法颜色串（由 color picker 提供，通常天然满足）
- `soulContent/agentsContent`：必须非空（非空白）
  - 后端写文件行为：`writeDigitalEmployeeWorkspaceFiles` 只会在 `payload.soulContent/agentsContent` 为 truthy 时写入 `SOUL.md/AGENTS.md`
  - 若未来允许空字符串，会出现“不会写 SOUL.md/AGENTS.md”，且后端 verify 阶段也不会因为缺失 SOUL.md 报错（因为 verify 只在 `payload.soulContent` truthy 时才检查）
- 语义约定：truthy 判断不等于非空文本
  - 若 payload 是仅包含空白字符的字符串（如 `'   '`），它仍是 truthy，后端仍会写出 `SOUL.md/AGENTS.md`（内容仅为空白）
  - 因此本设计要求前端在提交前必须 `trim()` 校验；（可选增强）实现阶段也建议在 `/api/employees/provision` route 层对必填字段进行 `trim` 并拒绝全空白字符串，以彻底对齐语义
 - 因此本设计要求前端在提交前必须 `trim()` 校验；（必做）实现阶段也必须在 `/api/employees/provision` route 层对必填字段进行 `trim` 并拒绝全空白字符串，以彻底对齐语义

## 数据映射：提交时构造 `Employee`

提交时创建一个 `Employee` 对象，用户输入与补齐字段如下：

### 1) 用户输入直映射
- `employee.nameZh` = `员工名称`
- `employee.name` = `员工名称`
- `employee.vibe` = vibe 输入
- `employee.vibeZh` = vibe 输入（详情页读取 `vibeZh || vibe`）
- `employee.soulContent` = soulContent 输入
- `employee.agentsContent` = agentsContent 输入
- `employee.emoji` = emoji 选项
- `employee.color` = color 选择

### 2) 由系统补齐（用户不填）
- `employee.id`：前端生成 uuid（`crypto.randomUUID()`）
- `employee.department`：固定为 `custom`
- `employee.identityContent`：= vibe（按你要求，不额外包装）
- `employee.description`：= vibe
- `employee.descriptionZh`：= vibe

## 自动加入系统：复用 addEmployee 链路

提交成功后：
1. 前端调用 `useEmployeesStore.addEmployee(employee, onProvisionStage?)`
2. store 内部触发 `POST /api/employees/provision`，payload 包含：
   - `employeeId`：= `employee.id`（uuid）
   - `nameZh`：= `employee.nameZh`
   - `nameEn`：= `employee.name`
   - `soulContent`：= `employee.soulContent || ''`（前端保证非空则必为 truthy）
   - `agentsContent`：= `employee.agentsContent || ''`
   - `identityContent`：= `employee.identityContent || ''`
   - `emoji`：= `employee.emoji`
   - `vibe`：= `employee.vibeZh ?? employee.vibe`
3. 后端 `provisionDigitalEmployeeAgent`：
   - 阶段顺序（与 `employee-provision:stage` UI 进度一致）：
     - `create_agent`（创建 agent 配置条目）
     - `write_files`（写入工作区 Markdown，其中：
       - `soulContent` truthy 才写 `SOUL.md`
       - `agentsContent` truthy 才写 `AGENTS.md`
       - `IDENTITY.md` 总会写入（即使 extra 内容为空也会写 header）
     ）
     - `verify`（仅在 `payload.soulContent` truthy 时检查 `SOUL.md` 存在）
   - provision 成功后，路由还会额外 emit：`sync_reload`（用于同步 provider auth + 触发 Gateway 重载）
   - 返回 `agentId`（注意：它由后端基于 `payload.nameZh` slugify 得到，不等于 uuid）
4. 返回后前端把 `linkedAgentId` 写入 `myEmployees`，并更新员工列表状态
 
说明：本流程以 HTTP 路由 `/api/employees/provision` 为主契约；虽然仓库中存在同名/相近的 IPC channel，但本设计要求的“创建数字员工自动注册到系统”将复用现有 `addEmployee` 的 HTTP 调用链路。

## 需要改动的类型与 i18n

### Type：`Department`
- 在 `src/types/employee.ts` 中加入 `custom`。

### DEPARTMENT_MAP
- 在 `DEPARTMENT_MAP` 增加 `custom` 显示数据：
  - emoji：可使用默认 emoji 或与“自定义部门”语义一致的 emoji（本设计不强制）
  - description/nameZh：用于 UI 文案（建议与 i18n 一致）

### i18n：中文部门名
- 在 `src/i18n/locales/zh/employees.json` 的 `departments` 下加入：
  - `custom: "自定义"`

### i18n：其它语言补齐（避免非 zh 环境渲染问题）
- 为防止 `EmployeeCard/EmployeeDetail` 的 `t('departments.${employee.department}')` 在非 zh 语言下缺 key，需要同步在以下语言文件补齐“departments 对象”：
  - `src/i18n/locales/en/employees.json`
  - `src/i18n/locales/ja/employees.json`

实现要求：
- 若 `departments` 对象不存在，则新增 `departments` 对象
- 至少包含 `custom`：建议分别为 `Custom` / `カスタム`

## 测试策略（实现阶段）

### 单元/组件测试
- 更新或新增 `tests/unit/agents-page.test.tsx`
  - 验证弹窗打开
  - 验证必填校验逻辑
  - 验证提交时构造的 payload 字段与预期一致（uuid/identityContent/department/custom）

### 端到端（E2E）
- 对于“创建数字员工”的用户可见流程，需要补充 Electron/Playwright E2E 用例：
  - 填表 → 点创建 → 断言出现于“我的员工”
  - 可选：断言工作区创建阶段的 toast/进度表现

## 非目标（明确不做）
- 不在 UI 中让用户选择模型。
- 不新增新的后端接口；只复用现有 `/api/employees/provision` 与相关写文件逻辑。
- 不做“department 由 emoji 自动推断”的复杂逻辑。

## 实施计划概览（不含具体代码）
1. 修改 `src/pages/Agents/index.tsx`：替换现有弹窗并接入 `useEmployeesStore.addEmployee`
2. 修改 `src/types/employee.ts`：增加 `custom` 并补齐映射
3. 修改 `src/i18n/locales/zh/employees.json`：新增 `departments.custom`
4. 更新/补充测试与 E2E

