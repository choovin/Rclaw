# 员工列表与 OpenClaw 同步（localStorage 丢失后恢复）设计

## 背景与问题

- 渲染进程用 Zustand `persist` 将 `myEmployees` 存入 **localStorage**（键名 `rclaw-employees-storage`），其中保存目录员工 **`id`（catalog bundle id）** 与 **`linkedAgentId`（OpenClaw agent slug）** 的对应关系。
- OpenClaw 侧在 provisioning 时把 SOUL/AGENTS/IDENTITY 等写入 `~/.openclaw/workspace-<agentId>`；**历史上未将 `catalogEmployeeId` 持久化到工作区文件**。
- `fetchAgents` 之后会调用 `reconcileWithOpenClawAgentIds`：**仅按 OpenClaw agent 列表过滤本地已有行**。若 localStorage 被清空，本地列表为空，**不会从磁盘/OpenClaw 反建员工行**，导致「OpenClaw 里仍有 agent，应用里像没加过员工」。
- 典型场景：版本更新时卸载应用、同步保留 `~/.openclaw`、重装后 renderer 存储为空。

## 范围

- **在范围内**：仅 **「我的员工」列表** 与 OpenClaw agent / 工作区内容一致；重装或清空 localStorage 后能自动恢复识别。
- **不在范围内**：其它 localStorage / `clawx-settings` 等通用设置（用户明确选择仅 A）。

## 目标行为

1. 当 renderer 持久化的 `myEmployees` **为空或与 OpenClaw 不同步**（缺少仍存在的 agent 对应行）时，只要 OpenClaw 中仍存在对应 agent 与数字员工工作区，应用应 **自动补全** `myEmployees`。
2. **不得**在 OpenClaw 中无对应 agent 时凭空创建员工行。
3. 恢复后 **`reconcileWithOpenClawAgentIds` 行为不变**：仍删除 `linkedAgentId` 在 OpenClaw 已不存在的行。

## 执行顺序（与现有逻辑衔接）

固定顺序：

1. 成功拉取 OpenClaw agent 列表（现有 `fetchAgents` / snapshot）。
2. **Hydrate**：根据 agent + 工作区磁盘内容合并/追加 `myEmployees`（本设计新增）。
3. **Reconcile**：现有 `reconcileWithOpenClawAgentIds(agentIds)`。

避免先 reconcile 再 hydrate，以免误删本可恢复的行。

## 架构与接口

### 推荐：独立 Host API

新增 **`GET /api/employees/hydrate`**（或等价命名），由主进程扫描已配置 agent 的工作区，返回可合并进前端的员工片段列表。

- **优点**：不膨胀 `GET /api/agents` 契约，职责清晰。
- **备选**：在 agents snapshot 中附带 `digitalEmployees` 字段以减少一次 RTT；本 spec **默认采用独立 GET**，若实现阶段有强需求可再评估。

响应形状建议：

```json
{
  "success": true,
  "employees": [
    {
      "linkedAgentId": "agent-slug",
      "id": "catalog-id-or-synthetic",
      "nameZh": "...",
      "name": "...",
      "soulContent": "...",
      "agentsContent": "...",
      "identityContent": "...",
      "emoji": "...",
      "vibe": "...",
      "skipCatalogDetailFetch": true,
      "department": "custom"
    }
  ]
}
```

具体字段以实现时 `Employee` 类型为准；**每条必须含非空 `linkedAgentId`**。

### 渲染进程

- `useEmployeesStore` 增加 **merge/hydrate** 能力（或纯函数 + `set`），由 `fetchAgents` 成功回调链中调用：先 `hostApiFetch('/api/employees/hydrate')`，再合并，再 `reconcileWithOpenClawAgentIds`。
- 现有 `persist` 与 `onRehydrateStorage` 中触发 `fetchAgents` 的路径应保持；确保 **zustand rehydrate 完成后再依赖 `myEmployees`** 的 UI 若已有竞态处理则延续，否则实现计划中补齐。

## 数字员工工作区判定

按优先级：

1. **强认定**：工作区根目录存在 **`.rclaw-digital-employee.json`**（侧车文件，见下节）。
2. **弱认定**：`TODO.md` 包含约定标记 **「由 RClaw 数字员工系统生成」**，且存在非空 `SOUL.md` 与 `AGENTS.md`（与现有 provisioning 写入一致）。
3. 不满足则 **不** 将该 agent 纳入 hydrate 结果（避免把普通 agent 误标为员工）。

**默认 agent（如 `main`）**：若无上述特征，不进入 `myEmployees`。

## 侧车元数据 `.rclaw-digital-employee.json`

为可靠恢复 **catalog `employee.id`**，在 **provision / update 成功写盘** 时同步写入工作区根目录：

- 建议字段：
  - `version`：数字，当前为 `1`。
  - `catalogEmployeeId`：字符串，与前端 `Employee.id` 一致。
  - `skills`：可选，字符串数组（与 allowlist / 展示一致即可，以实现为准）。

**旧工作区**无此文件时仅依赖弱认定 + IDENTITY 解析；不要求用户手动迁移。

### 写入责任

- 在 `provisionDigitalEmployeeAgent` / `updateDigitalEmployeeAgentWorkspace` 完成工作区写入后，或由 routes 层在成功返回前调用统一 helper 写入侧车；**须与事务性认知一致**：若写侧车失败，应记录错误且实现计划明确是否整单失败或仅降级（建议：侧车失败打 warn、仍返回成功，hydrate 仍可通过弱认定恢复）。

## 从磁盘构造 `Employee` 行

- **有侧车**：`id = catalogEmployeeId`；`skills` 等从侧车读取；`soulContent` / `agentsContent` 从现有 `readWorkspaceSoulAgentsMd`；`identityContent` 等从 `IDENTITY.md` 读取或解析。
- **无侧车**：
  - `id` 使用稳定合成策略：**`local-openclaw:<agentId>`**（实现可微调前缀，但须稳定、可测）。
  - 设置 **`skipCatalogDetailFetch: true`**，避免 hydrate 阶段误请求 catalog。
  - `nameZh`、职能标签 `name`（role）、`emoji`、`vibe` 等从 **`IDENTITY.md`** 按与 `buildIdentityMd` 输出格式一致的 **只读解析** 提取；解析失败时用 agents snapshot 中的 **`name`** 作为展示降级。
- 每条记录 **`linkedAgentId = agentId`**（trim 后非空）。

## 合并规则

- **主键**：`linkedAgentId`。
- 若 `myEmployees` 已存在相同 `linkedAgentId`：**以 hydrate 结果覆盖**可从磁盘权威恢复的字段（soul / agents / identity、名称、侧车中的 catalog id 等）；策略实现可简化为「磁盘优先」。
- 若不存在：**追加**。
- 同一 `linkedAgentId` 在 hydrate 结果中重复：去重保留一条并打 warn。

## 与商城「再次添加」的交互

若某 catalog 员工对应的 OpenClaw agent **已存在**（`linkedAgentId` 已在 `myEmployees`），从商城再次点击「添加」时应 **视为已添加** 或等价拦截，**禁止**重复 provision。若当前代码未覆盖，在实现计划中 **显式任务** 补齐（例如按 `linkedAgentId` 或工作区侧车 `catalogEmployeeId` 匹配）。

## 错误处理与边界

- 单个 agent **读盘失败**：跳过该 agent，记录 warn；继续处理其它 agent。
- **IDENTITY 解析失败**：降级为最小行（`linkedAgentId` + snapshot `name`），不阻塞整体 hydrate。
- **性能**：agent 数量通常较小；对未通过弱认定初筛的路径避免不必要的全文件读取（实现可先做轻量文件检测再读大文件）。

## 测试

- **主进程单测**：侧车存在/不存在；TODO 标记；IDENTITY 解析；合并去重；`main` 不误入选。
- **API 契约**：`GET /api/employees/hydrate` 在 0 / N 个数字员工、含 `main` 时的 JSON 形状。
- **前端**：对「合并函数」或 store 纯逻辑做单元测试：`myEmployees` 从空经 hydrate + reconcile 后与给定 agent 列表一致。

## 非目标

- 不解决通用设置与其它 persist 键的恢复。
- 不在本 spec 中定义「用户手动编辑 `~/.openclaw`」以外的冲突解决 UI；现有 `reconcileWithOpenClawAgentIds` 继续负责剔除无效 agent。

---

## 修订记录

- 2026-04-18：初稿（与用户确认范围 A 及第 1～4 节设计一致）。
