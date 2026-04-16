# 数字员工市场：Claw Catalog 线上分类 / 列表 / 详情设计

## 背景

当前「Agents → 数字员工库」从本地 **`@/data/employees/index.json`** 异步加载全量目录；部门筛选来自 **`DEPARTMENT_MAP`** 静态枚举；详情为点击卡片后使用内存中的列表行对象，**无网络请求**。

需求改为对接业务云 **Claw Catalog** HTTP API（路径前缀 `/app-api/claw/catalog/...`），由 **`VITE_CLOUD_API_BASE_URL`** 与 Main 侧代理拼接完整 URL；**本方案完成后移除本地 JSON 数据源**，不再纳入回退或兼容方案。

权威字段说明见仓库内：`temp/claw-catalog-departments-api.md`、`temp/claw-catalog-agents-paging-api.md`、`temp/claw-catalog-agent-detail-api.md`（实现阶段应同步到 `docs/api-docs/` 相应章节）。

## 目标

1. **部门（分类）**：`GET /app-api/claw/catalog/departments`，用于市场顶部部门筛选展示（`departmentNameZh`、`logo` 等）；筛选时列表请求携带 **`departmentId`**（选「全部」则不传）。
2. **列表**：`GET /app-api/claw/catalog/agents`，支持 `pageNo`、`pageSize`（≤100）、`keyword`、`departmentId`、`tier`（可选）等 Query；**滚动触底加载下一页**；**搜索或切换部门时重置为第 1 页**。
3. **详情展示**：**打开详情时不发起详情接口**；详情 UI **仅使用当前分页列表返回的该条数据**（与浏览一致，列表可能含较大字段，以后端为准）。
4. **添加员工（provision）**：用户确认添加时，**先** `GET /app-api/claw/catalog/agent/{bundleId}` 拉取**最新**完整定义，再使用响应中的长文本等字段调用现有 **`POST /api/employees/provision`**，由 Host 写入对应 MD / 创建 Agent。**若详情请求失败，则中止添加并提示**，不得用列表缓存凑合写入。
5. **鉴权**：目录三类接口按 **匿名可读** 处理（与 Skillhub 列表类似）；代理层不强制依赖会员 Token（若通用 cloud 请求默认带 Token，需保证无 Token 时仍可读目录，或与后台约定一致）。

## 非目标

- 不在此 spec 要求后端缩减列表 payload；若需「列表瘦身 + 详情全量」由后续接口演进单独需求。
- 不在此阶段重做「我的员工」与 OpenClaw 本地 Agent 的除必要字段外的业务规则。

## 架构与边界

- **渲染进程**不直接请求业务云域名；通过 **`hostApiFetch('/api/cloud/claw/catalog/...')`**，由 **Electron Main** 转发至 `{getCloudApiBaseUrl()}/app-api/claw/catalog/...`（与 `electron/api/routes/cloud-skillhub.ts` 同构）。
- **推荐结构**（与 Skillhub 一致）：`src/lib/claw-catalog-api.ts`（封装请求与 query）；独立 **Zustand store**（或等价模块）管理列表分页、`keyword` 防抖、部门列表、`loading` / `error` / `loadMore`；**`useEmployeesStore` 仍以「我的员工」持久化、选中行、添加/移除为主**，市场列表数据 **不** 写入 persist。
- **标识符**：市场侧员工主键与 **`POST /api/employees/provision` 的 `employeeId`** 对齐，使用云端 **`bundleId`**（字符串），与工作区 `workspace-{employeeId}` 命名一致；服务端数字 `id` 可作可选字段保留，不替代 `bundleId`。
- **部门筛选状态**：由「枚举 + `DEPARTMENT_MAP`」改为 **`'all' | number`（`departmentId`）** 或与接口一致的 ID 类型；**市场 Tab 不再依赖 `DEPARTMENT_MAP` 作为数据源**（该文件若仍有其它引用可单独清理）。

## 数据映射

- 从 `data.list[]` / 详情 `data` 映射为现有 **`Employee` / `EmployeeWithStatus`** 展示所需字段：`name` / `nameZh`、`description`、`avatar`（若 UI 使用）、`department` 代码、`departmentId`、`emoji`、`color`、`vibe` / `vibeZh`、`requiredSkills` / `requiredChannels`（JSON 字符串需解析处按现有组件约定）等。
- **`tags`、`tier`、`rating` 等**：按产品需要在卡片/详情展示；未使用可忽略。

## 错误与空态

- **无本地 JSON 兜底**；`departments` 或 `agents` 失败时展示错误与 **重试**（部门与列表可分别失败，避免单点阻断时的体验劣化，具体交互以实现为准）。
- **配置缺失**：`VITE_CLOUD_API_BASE_URL` 未配置或无法解析时，给出可理解的提示（复用项目内与 Skillhub/云端相关的既有模式若存在）。

## 性能与交互

- **`pageSize`**：取固定常数（建议与 Skillhub 对齐量级，如 **15～30**，且 ≤100），`pageNo` 从 1 递增。
- **滚动加载**：`已加载条数 < total` 时触底请求下一页；搜索防抖后 **清空列表并重拉第 1 页**。

## 本地数据移除（本方案交付范围）

- 删除 **`Marketplace.tsx` 中对 `@/data/employees/index.json` 的动态 import** 及任何仍依赖该包的引用。
- 清理不再使用的 **`src/data/employees/`** 资源（若整目录仅服务市场）。
- **`DEPARTMENT_MAP` / `Department` 类型**：按实际引用收缩；市场路径以接口部门列表为准。

## 测试与文档

- **E2E（Playwright）**：覆盖 Agents 页市场 Tab——进入后可见部门与列表（可 mock `hostapi:fetch` / IPC）；与 AGENTS.md「可见 UI 变更需 E2E」一致。
- **`docs/api-docs/`**：在实现阶段将三条 Claw Catalog 路由、Query、响应形态写入与 RunNode 契约一致的文档（如 `01_Claw_API.md` 或索引指向的模块文件）。

## 与 brainstorming 结论对齐

| 项 | 结论 |
|----|------|
| 鉴权 | 匿名可读 |
| 详情展示 | **不请求**详情接口；仅用列表行 |
| 详情接口 | **仅在添加员工前**调用，用于 provision |
| 列表交互 | 触底加载；搜索/换部门重置第 1 页 |
| 失败 | 仅错误 + 重试，**无**本地目录兜底 |
| 本地 JSON | **本方案完成后移除**，本设计不保留静态回退 |

## 后续

- 用户审阅本 spec 通过后，使用 **writing-plans** 产出实现计划（Host 路由、API 模块、store、`Marketplace`/`EmployeeDetail`/`employees` store 调整、移除本地数据、E2E、`docs/api-docs`）。
