# 添加员工流程（弱绑定 + 编排接口）- 设计文档

**项目**：ClawX (Rclaw)  
**创建日期**：2026-03-27  
**状态**：已评审（用户同意方案）  
**关联**：修正 [2026-03-19 数字员工模块](./2026-03-19-digital-employee-module-design.md) 中「添加员工」实现与真实 Agent workspace 不一致的问题。

---

## 一、问题陈述

### 1.1 现象

- 进度条为前端模拟（定时器），与真实异步步骤无关。
- 「我的员工」在 Agent / 写盘完成前即持久化，与期望顺序不符。
- 实测在「用户认为的 workspace」中未看到正确的 MD 内容。

### 1.2 根因

- `createAgent` 为每个新 Agent 分配 **独立的 `agentId`**（由中文名 slug 化，重名时为 `xxx-2`），workspace 配置为 `~/.openclaw/workspace-{agentId}`（经 `expandPath`）。
- 原 `POST /api/employees/workspace` 按 **`employeeId`** 写入 `workspace-{employeeId}`，与上述 **真实 Agent workspace 不是同一路径**。
- 因此员工人设内容被写到错误目录；用户在 Agents 侧打开的 Agent 目录中看不到对应内容。

---

## 二、设计决策

### 2.1 绑定策略：B（弱绑定）

- OpenClaw Agent 的 **`id` 仍由 `createAgent` 生成**，不强制等于 `employeeId`。
- 所有员工相关 Markdown **必须写入该 Agent 在配置中的 `workspace` 路径**（`expandPath(agent.workspace)`），**禁止**仅以 `employeeId` 作为磁盘目录名的唯一依据。

### 2.2 架构：主进程单接口编排（推荐）

新增单一入口（名称实现时可定，下文称 **`POST /api/employees/provision`**），在主进程内顺序完成：

1. 创建 Agent（`createAgent(nameZh, { inheritWorkspace: false })`）。
2. 从当前配置 / 快照解析 **新建 Agent 的 `agentId` 与 `workspace` 路径**。
3. 在该目录写入 `SOUL.md`、`AGENTS.md`、`IDENTITY.md`（有内容则写）及模板 `user.md`、`todo.md`。
4. 执行与现有一致的 **Provider 同步**、**Gateway reload**（顺序遵循当前 `agents` 路由惯例）。
5. 刷新快照，确认列表中存在该 **`agentId`**（可选：对关键文件做存在性检查）。
6. 仅当整段成功时，由前端将员工写入 **「我的员工」** 并标记已添加。

进度条：**每一步对应真实 `await` 边界**，不再使用固定间隔的模拟进度。

### 2.3 数据模型：linkedAgentId

- 在「我的员工」所保存的条目中增加 **`linkedAgentId: string`**（或等价字段），记录 OpenClaw 中真实 Agent id。
- UI、会话选择、后续删除/同步均以该字段定位 Agent；**不假设** `linkedAgentId === employeeId`。

---

## 三、API 契约（草案）

### 3.1 `POST /api/employees/provision`

**Request body（示例字段）**

| 字段 | 说明 |
|------|------|
| `employeeId` | 员工数据 id（市场数据主键，用于追溯） |
| `nameZh` / `nameEn` | 展示名；创建 Agent 时使用与现有一致的命名规则 |
| `soulContent` / `agentsContent` / `identityContent` | 写入对应 MD |

**成功响应**

- `success: true`
- `agentId`：新建 Agent 的 id（slug）
- `workspacePath`：展开后的绝对路径（便于调试与日志）

**失败响应**

- `success: false`
- `error`：可读错误信息
- `stage`（可选）：失败阶段，供 UI 与排错
- `agentId`（可选）：若 Agent 已创建但后续失败，带上以便 **补写** 或 **引导用户删除孤立 Agent**

---

## 四、前端行为

### 4.1 `addEmployee`（或重命名）

- 仅调用 **`/api/employees/provision`**（不再先 `POST /api/agents` 再 `POST /api/employees/workspace` 分两步拼流程）。
- 成功后再 `fetchAgents()`（若编排接口已返回足够信息，可按需减少重复拉取）。
- 更新 Zustand：**写入 `myEmployees` 时附带 `linkedAgentId`**；市场列表标记 `isAdded` / `addedAt`。
- 失败：**不** 更新持久化「我的员工」；若响应提示已存在 `agentId`，展示重试/去 Agents 管理类文案。

### 4.2 进度 UI

- 与主进程阶段对齐（例如：创建 Agent → 写入文件 → 同步与重载 → 校验）。
- 具体文案与步数在实现时与路由内阶段一一对应。

---

## 五、错误处理与补偿

| 场景 | 处理 |
|------|------|
| Agent 创建成功，写盘或 reload 失败 | 返回 `agentId`，允许后续「仅补写 workspace」接口或手动在 Agents 中处理 |
| slug 重名为 `xxx-2` | 以响应中的 `agentId` 为准，「我的员工」存 `linkedAgentId` |
| 用户重复添加同一员工 | 实现时需定义：拒绝 / 幂等更新 / 提示已存在（与产品一致即可） |

---

## 六、Gateway 与文件覆盖

- 若 Gateway 在启动或 reload 后对空 workspace **种子化** 默认 `SOUL.md`/`AGENTS.md`，可能导致「先写后被覆盖」。
- **实现顺序**：先按本 spec 完成「创建 Agent → 写员工 MD → reload」；若实测仍被覆盖，再在实现阶段增加 **二次写入** 或 **配置/时序调整**，并单独记录结论。

---

## 七、测试建议

1. 添加员工后，在 **配置中该 Agent 的 workspace 目录** 下核对 MD 内容与 `index.json` 中员工字段一致。
2. Agents 列表中选中该 Agent，路径与 `linkedAgentId` 一致。
3. 失败路径：模拟写盘失败，确认「我的员工」未增加条目，且提示与 `agentId`（若有）合理。

---

## 八、实现后废弃/收缩

- 旧的「先 `POST /api/agents` + 按 `employeeId` 写 workspace」的渲染端组合应移除或改为仅内部被编排接口复用，避免再次写错目录。
- `ipc-handlers` 中与 `employeeId` 直接拼路径的重复逻辑宜统一到 `agent-config` 或单一写入函数，以 **`agentId` 解析出的 workspace** 为准。

---

## 九、修订记录

| 日期 | 说明 |
|------|------|
| 2026-03-27 | 初稿：用户确认弱绑定 B、单接口编排、`linkedAgentId`、进度与真实步骤对齐。 |
