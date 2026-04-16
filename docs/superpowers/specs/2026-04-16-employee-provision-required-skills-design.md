# 添加员工时按 `requiredSkills` 配置 OpenClaw 技能（设计）

## 背景

Claw Catalog 详情字段 `requiredSkills` 为 JSON 字符串，解析后为技能 **slug** 数组（与 OpenClaw / 技能目录名一致）。当前 `POST /api/employees/provision` 仅写入人设与工作区 Markdown，**未**根据该字段限制 Agent 可用技能。

本设计约定：在「添加员工 / provision」链路中，按 slug 解析结果配置 OpenClaw 侧「该 Agent 的技能策略」；并对本地尚不可用的 slug 走与 **技能商店** 一致的安装路径。

## 目标

1. **`requiredSkills` 语义**
   - **缺失 / `null` / 无法解析 / 解析结果为空数组 `[]`**：**继承全部技能**（不施加「仅限列表内」的 per-agent 限制，或写入与 OpenClaw 约定等价的「继承」表示）。
   - **非空 `string[]`**：仅允许列表中的 slug（在成功解析与安装之后）；**不得**通过全局 `skills.entries` 批量开关影响其他 Agent。

2. **未知或尚未落地的 slug**
   - 对当前环境中**仍不可用**的 slug（例如未安装到 `~/.openclaw/skills`、运行时未识别等，以实现阶段判定为准），走 **ClawHub 安装流程**：与技能商店一致，调用 Main 侧已有能力（`ClawHubService.install`，IPC `clawhub:install` 同源逻辑），即 `openclaw` CLI `install <slug>`，并带上与商店一致的 registry（`getSkillHubBaseUrl()`）等参数。
   - **安装失败**：**跳过该 slug**，记录日志；其余 slug 继续处理。
   - **全部失败或最终可用列表为空**：与 **「继承全部」** 对齐（避免新员工被错误限制为「零技能」且无声失败）；同时打 **warn 级别** 日志（可选：后续产品化 toast，非本设计必做）。

3. **配置落点**
   - 在 **OpenClaw 官方 schema** 中确认「按 Agent 限制技能」的唯一配置键（可能在 `agents.list[]` 或工作区元数据）。实现前做一次 **schema 核对**（`openclaw` 包版本与仓库锁定版本一致），禁止用「关掉全局其他技能」冒充 per-agent 限制。

## 非目标

- 不在本设计重新定义 Catalog 字段；slug 由后台保证为合法标识，客户端以字符串处理。
- 不要求在添加员工 UI 中展示安装进度（除非实现阶段产品补充）；日志为最低要求。

## 架构与数据流

1. **市场添加**：`GET .../catalog/agent/{bundleId}` → `mapCatalogAgentToEmployee` → `Employee.skills`（已解析数组）。
2. **自定义创建员工**：若无 Catalog 详情，不传或传空 → **继承全部**。
3. **`useEmployeesStore.addEmployee`** → `POST /api/employees/provision` 增加 **`skills` / `allowedSkillSlugs`**（命名以实现为准）：`string[] | null` 或省略。
4. **Main `provisionDigitalEmployeeAgent`（或等价）**：
   - 创建 Agent、写入工作区文件（现有逻辑）；
   - 若为非空列表：对每个 slug **解析 →（必要时）ClawHub 安装 → 收集成功 slug**；
   - 将 **成功 slug 列表** 写入 **per-agent** OpenClaw 配置（具体键待 schema 确认）；
   - 若为继承语义：**不写**限制或写入继承等价物。

**边界**：ClawHub 安装可能依赖网络与 registry，provision 耗时可能增加；实现时可顺序安装并带超时/错误隔离，避免单 slug 拖死整单（具体策略进实现计划）。

## 错误与可观测性

- 安装失败：日志含 `employeeId` / `agentId`、`slug`、错误摘要。
- 若最终采用「继承全部」兜底：日志说明原因（例如全部安装失败）。

## 测试

- **单元**：`requiredSkills` JSON 解析、空与 `[]` 与列表的 provision payload 构造、安装失败跳过后的列表归约（可 mock ClawHub）。
- **集成 / E2E**：若对外可见行为变化（例如错误提示），按 AGENTS.md 补 Playwright；否则以 Host 层单测或 mock 为主。

## 与既有 spec 的关系

- `2026-04-16-claw-catalog-online-design.md` 中「添加员工前拉详情再 provision」保持不变；本设计在其 **provision 载荷与 Host 写入** 上扩展技能策略与 ClawHub 安装。

## 方案回顾（已定稿）

| 方案 | 结论 |
|------|------|
| 全局 `skills.entries` 批量开关 | **不采用**（副作用波及其他 Agent） |
| per-agent 配置 + ClawHub 安装未知 slug | **采用** |
| 未知 slug 安装失败 | **跳过** |
| 解析后非空但最终无可用 slug | **继承全部** + 日志 |

---

*实现阶段使用 **writing-plans** 产出任务拆分；OpenClaw Agent 级技能字段以实现前 schema 核对为准。*
