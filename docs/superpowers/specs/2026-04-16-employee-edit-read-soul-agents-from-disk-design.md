# 员工编辑：打开前从工作区读取 SOUL/AGENTS（磁盘为准）（设计）

## 背景

数字员工编辑弹窗（`CreateDigitalEmployeeDialog` 的 `mode === 'edit'`）中，**角色 / SOUL**、**AGENTS** 两段文案目前来自 `myEmployees` 里持久化的 `soulContent`、`agentsContent`。若用户在工作区 `~/.openclaw/workspace-${linkedAgentId}/` 内**直接修改**了 `SOUL.md`、`AGENTS.md`，应用内缓存可能与磁盘不一致；用户期望**打开编辑时以磁盘内容为准**展示这两段。

本设计**不**解析 `IDENTITY.md`（范围选 **A**）；`identityContent`、`vibe`、`description` 等仍按既有 `Employee` 与产品规则处理。

## 目标

1. 用户点击员工详情中的「编辑内容」后、**弹窗打开前**：从磁盘读取 **`SOUL.md`、`AGENTS.md`**（UTF-8），作为表单中对应两个大文本框的**初值**。
2. **读盘成功后不**将 `soulContent` / `agentsContent` 写回 `myEmployees`（用户选择 **否**）；仅影响**本次会话**表单。用户点**保存**仍走现有 `POST /api/employees/update`，成功后 store 与工作区与现网一致。
3. 读盘失败时：**降级**为使用当前 `Employee` 中的 `soulContent` / `agentsContent` 打开弹窗，并 **toast** 提示（文案 i18n），避免阻断编辑。

## 非目标

- 不反向解析 `IDENTITY.md`，不新增「从磁盘恢复 vibe」等字段。
- 不在本需求中同步 `USER.md`、`TODO.md` 到 `Employee`。
- 不在读盘时自动覆盖持久化 store（除非用户显式保存）。

## 架构与数据流

### 后端（Electron HTTP）

- 新增只读接口，例如 **`GET /api/employees/workspace-md?linkedAgentId=<id>`**（路径与动词以实现阶段与 `electron/api/routes/agents.ts` 惯例为准）。
- 校验 `linkedAgentId` 非空且存在于 OpenClaw 已配置 agent 列表（与 `update` 路由一致，避免任意路径读）。
- 工作区目录：`expandPath('~/.openclaw/workspace-${linkedAgentId}')`。
- 使用 `fs` 读取 `SOUL.md`、`AGENTS.md`；**文件不存在**时该字段返回空字符串 `''`，整体仍 **`success: true`**（可选 `missing?: { soul?: boolean; agents?: boolean }` 供调试，非必须）。
- 读失败（权限、非文件错误等）：返回 **`success: false`** + `error` 字符串。

### 前端

- **入口**：`EmployeeDetail` 中点击「编辑内容」时，不立即 `setEditDialogOpen(true)`；先调用 **`hostApiFetch`** 读上述 API（可封装为 `fetchEmployeeWorkspaceMd(linkedAgentId)` 置于 `src/lib/` 或紧邻 employees 的 api 模块）。
- **加载态**：请求期间按钮 loading / disabled，避免重复点击。
- **成功**：将返回的 `soulContent`、`agentsContent` 以 **props** 传入 `CreateDigitalEmployeeDialog`（例如 `workspaceSoulAgents?: { soulContent: string; agentsContent: string }`），**优先**用于初始化 SOUL/AGENTS 两个受控字段；其余字段仍来自 `initialEmployee` / `editTarget`。
- **失败**：toast；打开弹窗时 **不传** `workspaceSoulAgents`，对话框内 `useEffect` 与现网一致，仅用 `initialEmployee.soulContent` / `agentsContent` 初始化。

### 与保存的关系

- 保存逻辑、请求体、`writeDigitalEmployeeWorkspaceFiles` 行为**不变**。

## 错误处理与边界

- **无 linkedAgentId**：不应发起读盘；沿用既有「缺少关联」错误处理。
- **空磁盘文件**：视为合法，表单可为空（若与「必填」校验冲突，以实现阶段与现表单校验对齐为准）。
- **并发**：快速连点「编辑」应防抖或忽略重复请求。

## 测试

- **单元**：mock `hostApiFetch`，断言 edit 模式下 SOUL/AGENTS 初值优先来自接口。
- **E2E（可选）**：在稳定可准备工作区的前提下，验证磁盘修改后打开编辑可见更新文案。

## 与既有文档的关系

- 依赖 `linkedAgentId` 与工作区路径约定，与 `2026-04-16-employee-detail-edit-digital-employee-design.md` 一致。
- 本设计**不**改变「编辑时一句话描述仅改 description」的既有结论。
