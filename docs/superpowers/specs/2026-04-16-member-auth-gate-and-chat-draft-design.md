# 会员登录预检、全局会话失效与聊天草稿保留（设计）

## 背景

- 安装技能、创建/编辑数字员工、添加员工到工作区、聊天发送等能力依赖或部分依赖云端会员能力，但除聊天发送外，多数路径未在操作前校验本地登录态。
- `requireAuth()` 仅检查 Zustand 持久化的 `isLoggedIn`，不会在操作前请求服务端；会话在服务端已失效时，依赖后续请求失败再处理。
- 聊天页：`ChatInput` 在调用父组件 `onSend` **之前**即清空输入框；父组件中 `requireAuth()` 失败时用户草稿已丢失，与「未登录时保留输入、登录后仍在输入框」的期望不符。

## 已确认的决策

| 议题 | 选择 |
|------|------|
| 操作前 token 校验强度 | **B**：操作前以本地 `isLoggedIn` 为主，不强制每次请求 `auth/status`。 |
| 鉴权失败时的处理面 | **A**：在统一请求层（`hostApiFetch`）对符合条件的错误做全局处理。 |
| 全局处理的路径范围 | **A**：仅对「云端/会员相关」路径生效；登录尝试类接口排除，避免将「密码错误」等 401 误判为会话失效。 |

## 目标

1. **本地预检**：在**安装技能**、**创建/编辑数字员工并提交**、**添加员工（provision）**等动作发起前调用 `useAuthStore.getState().requireAuth()`；未登录则打开登录弹窗并中止，不进入后续逻辑。
2. **全局会话失效**：当 `hostApiFetch` 失败且错误被规范为会话/鉴权无效（见下文），且请求路径命中允许列表、未命中排除列表时：清除渲染进程中的会员登录展示状态、打开登录弹窗，可选 toast（需防抖）；与 Main 侧 `cloud:logged-out` 语义一致，避免仅清 UI 或仅清 Host 不同步。
3. **聊天草稿**：在用户未通过登录预检时**不清空**输入框与附件准备态；用户登录成功后**不自动发送**，草稿保留在输入框中。

## 非目标

- 不在每次操作前强制调用 `/api/cloud/auth/status` 做服务端预检（与决策 B 一致）。
- 不把「第三方模型 Key 无效」等非会员会话问题统一映射为「请先登录 RunNode 会员」（通过路径允许列表约束）。
- 不在本需求中重构整体路由守卫或全应用登录墙。

## 架构要点

### 1. 本地门控（`requireAuth`）

- **安装技能**：在 `skills` store 的 `installSkill` 开头调用 `requireAuth()`，覆盖所有调用 `installSkill` 的 UI（Skill 页、Skillhub 等）。
- **员工**：在 `employees` store 的 `addEmployee`、`updateEmployee` 开头调用 `requireAuth()`，保证 `EmployeeCard`、创建/编辑对话框等入口一致。
- **聊天**：见下文「聊天输入框」，避免与父组件重复弹窗（推荐：**门控只在一处**——或仅在 `ChatInput` 内先 `await requireAuth()` 再清空并回调，或仅在父组件先 `await requireAuth()` 再交给子组件；二者择一，实现阶段固定一种）。

### 2. 全局处理（`hostApiFetch` 内）

在 IPC 代理与 browser fallback 两条路径上，对抛出的 `AppError`（或规范化后的错误）判断：

- **错误类型**：优先 `code === 'AUTH_INVALID'`；若实现中发现部分 401 未归入该码，可结合 `details.status === 401` 补强（与 `normalizeAppError` / `error-model` 一致）。
- **允许列表（前缀或精确路径，实现时收敛为常量）**：
  - **`/api/cloud/`**（含 Skillhub、Claw catalog、`platform-provider/sync` 等）。
  - **`/api/employees/provision`**、**`/api/employees/update`**（与当前员工开通/更新 Host 路由一致）。
  - **`/api/clawhub/`**：若联调确认安装等接口会因会员 token 返回 401，则纳入；否则可在实现备注中说明暂不纳入，避免误伤纯本地错误。
- **排除列表（不得触发「清会员态 + 弹登录」）**：
  - **`POST /api/cloud/auth/login`**、**`/api/cloud/auth/sms-login`**、**`/api/cloud/auth/wechat-login`**（业务失败常为 401，属凭据错误而非当前会话失效）。
  - 视实现：**`POST /api/cloud/auth/logout`** 若可能返回 401，应排除或单独处理。
- **实现细节**：使用动态 `import('@/stores/auth')` 等避免 `host-api` 与 `auth` store 循环依赖；并行请求触发时 toast/弹窗需防抖，避免重复打扰。

### 3. 聊天输入框

- **调整顺序**：在 `ChatInput` 的发送流程中，**先** `await requireAuth()`（或与父组件约定单一门控点），**仅当返回 `true` 时再**清空输入/附件并调用 `onSend`。
- **父组件 `Chat/index`**：若子组件已承担门控，父组件侧可移除重复的 `requireAuth()`，或保留为防御性一次调用（需保证不会二次弹窗）。

## 测试

- **E2E（Playwright）**：未登录时在 Chat 输入内容并尝试发送 → 出现登录相关 UI → 登录完成或关闭弹窗后，**输入框仍保留草稿**（与 `AGENTS.md` 对 UI 变更的要求一致）。
- **单元（可选）**：路径允许/排除列表的匹配函数，可用表驱动测试。

## 风险与边界

- **登录接口 401**：必须依赖排除列表，否则会误清会话、重复弹窗。
- **403 / 业务码**：默认仅处理明确会话无效；若会员权益过期等走 403，可后续迭代单独扩展。
- **错误分类**：若某云端路径返回体特殊，实现阶段在 `details` 中携带 HTTP status 以便与 `AUTH_INVALID` 一致处理。

## 后续

实现阶段完成后，按仓库约定同步必要 README / E2E；本设计通过后使用 `writing-plans` 编写实现计划。
