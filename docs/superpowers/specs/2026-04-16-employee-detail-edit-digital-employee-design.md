# 员工详情：编辑数字员工（与创建表单一致）（设计）

## 背景

「创建数字员工」弹窗（`CreateDigitalEmployeeDialog`）已提供完整字段：中文名、一句话 vibe、`soulContent`、`agentsContent`、emoji、颜色、可选技能白名单（`CreateEmployeeSkillField`），提交后走 `POST /api/employees/provision` 创建 OpenClaw Agent 并写入工作区 Markdown。

「员工详情」侧栏（`EmployeeDetail`）在员工已添加且存在 `linkedAgentId` 时，可查看部门、氛围、描述、技能白名单等，但 **无法** 在详情内修改上述与创建一致的「员工内容」。

## 目标

1. **入口**：仅在 **`isEmployeeAdded(employee.id)` 为真且 `linkedAgentId` 存在** 时，在详情中提供进入编辑的入口（从员工市场或「我的员工」打开同一详情，条件一致则行为一致）。
2. **交互**：点击后弹出与创建 **同结构、同最大尺寸** 的居中弹窗；字段、校验与创建 **一致**（含可选技能白名单）。
3. **名称可编辑**：与创建一致允许修改展示用中文名；**不改变** 已有关联的 OpenClaw `agentId`（`linkedAgentId` 为创建时由名称 slug 生成并固定，工作区路径 `~/.openclaw/workspace-${agentId}` 不变）。展示名通过既有 **`updateAgentName(agentId, name)`** 与 **重写 `IDENTITY.md` 等** 与用户对名称的期望对齐。
4. **持久化**：保存时 **单次后端调用** 完成：写回工作区文件、更新配置中的展示名、按与 provision 相同规则处理技能白名单（安装/解析 slug、`applyAgentSkillAllowlist` 等）、**`scheduleGatewayReload`**，并更新前端持久化的 `myEmployees` 中对应 `Employee` 行。

## 非目标

- **不**通过「删除 Agent 再 provision」实现编辑（避免会话与绑定断裂）。
- **不**重命名磁盘上的 agent id 或迁移工作区目录（本需求以固定 `linkedAgentId` 为锚）。
- 不在本需求中扩展「创建」表单以外的字段（如部门从 `custom` 改为其它枚举），除非与现有 `Employee` 类型冲突——实现阶段以当前创建路径为准。

## 架构与数据流

### 前端

1. **`EmployeeDetail`**：在满足条件时渲染「编辑」按钮；打开 **`CreateDigitalEmployeeDialog`**（或等价外壳）并传入 **`mode: 'edit'`** 与来自 **`myEmployees` 的当前行**（优先于 catalog `employee`）作为初始值。
2. **`CreateDigitalEmployeeDialog`**：支持 **创建 / 编辑** 两种模式：编辑模式下标题、主按钮文案区分；初始 state 由 `initialEmployee` 填充；提交时创建模式仍调用 `addEmployee`，编辑模式调用 **`useEmployeesStore` 新增的 `updateEmployee`**（名称待定，实现阶段与 store 一致）。
3. **`useEmployeesStore`**：新增 `updateEmployee`，内部 **`hostApiFetch`** 调用新 HTTP API；成功后 **就地更新** `myEmployees` 中对应 id 的字段，并 **`useAgentsStore.getState().fetchAgents()`**（与 provision 成功后一致），保证列表与 Agent 快照刷新。

### 后端（Electron HTTP API）

新增例如 **`POST /api/employees/update`**（路径与动词实现阶段与 `electron/api/routes/agents.ts` 路由风格一致即可），请求体至少包含：

- `employeeId`：`myEmployees` 行上的 uuid（与 provision 请求中的员工 id 语义一致）。
- `linkedAgentId`：目标 Agent id（校验非空、与 OpenClaw 配置中存在的 entry 对应）。
- 与 provision 对齐的内容字段：`nameZh`、`nameEn`（或现有字段名）、`soulContent`、`agentsContent`、`identityContent`、`vibe`、`emoji`、可选 `skills` 数组。

处理顺序（逻辑要求，实现可内联或抽取函数）：

1. 校验参数与工作区路径可写。
2. **`writeDigitalEmployeeWorkspaceFiles`**（`electron/utils/digital-employee-workspace.ts`）向 **`~/.openclaw/workspace-${linkedAgentId}`** 写入/更新 Markdown；`IDENTITY.md` 通过既有 `buildIdentityMd` 使用新 `nameZh`、vibe、emoji 等。
3. **`updateAgentName(linkedAgentId, nameZh)`**（或等价展示名）同步 OpenClaw 配置中的展示名。
4. 技能白名单：与 **`POST /api/employees/provision`** 中 **`normalizeProvisionSkillSlugs` / `ensureSlugsViaClawHub` / `applyAgentSkillAllowlist`** 行为 **一致**（非空则解析并应用；空或未传则按产品规则继承或清空——与 provision 对齐，避免两套语义）。
5. **`scheduleGatewayReload`** 及与 provision 尾部一致的 **`syncAllProviderAuthToRuntime`**（若适用）保持与现网一致。

错误时返回明确 `success: false` 与 `error` 字符串；前端 toast 并 **保留弹窗内编辑内容**（不强制关闭）。

### 标识与改名语义（实现必读）

- **`linkedAgentId` 永不因本次保存而变更**；`employeeId`（uuid）亦不变。
- 用户修改「中文名」只影响 **展示名**、**IDENTITY 内 Name 行**、以及 store 内 `nameZh` / `name` 等展示字段；**不**尝试 slug 重算并迁移 Agent。

## UI 与文案

- 编辑入口：按钮文案需 **i18n**（`employees` 命名空间），与「创建数字员工」区分。
- 弹窗标题、提交按钮：编辑态使用「保存」类文案（中英日三套与项目惯例一致）。

## 测试

- **单元**：`CreateDigitalEmployeeDialog` 在 `mode === 'edit'` 下初始值填充与提交分流（可 mock store）。
- **E2E（Playwright）**：已添加员工打开详情 → 打开编辑弹窗 → 修改一字段保存 → 断言 store/UI 或接口侧可见变化（与 `AGENTS.md` 要求一致：可见 UI 变更需 E2E）。

## 与既有文档的关系

- 技能白名单语义与 `2026-04-16-create-digital-employee-skill-allowlist-design.md`、provision 路由实现保持一致。
- 本设计不修改「员工详情仅展示白名单」的既有结论；编辑后白名单变更应反映到 **`myEmployees`** 与运行时策略（与 provision 一致）。
