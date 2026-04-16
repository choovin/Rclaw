# 创建数字员工时配置可用技能（白名单）设计

## 背景

自定义创建数字员工入口（`CreateDigitalEmployeeDialog`）当前未收集 **技能白名单**；而后端 `POST /api/employees/provision` 已支持 `skills: string[]`，并与 Catalog 链路一致地通过 **`ensureSlugsViaClawHub`** 安装缺失 slug、再 **`applyAgentSkillAllowlist`** 写入 per-agent 策略（详见 `2026-04-16-employee-provision-required-skills-design.md`）。

本设计仅约束 **创建对话框内的选技能交互与载荷构造**，复用既有 provision / 安装管线，不新增第二套安装实现。

## 目标

1. **语义（与既有 spec 一致）**
   - **未选任何技能**（等价于不传 `skills` 或传空）：**继承全部技能**（不在该员工上施加 per-agent 白名单限制）。
   - **已选 ≥1 个 slug**：`Employee.skills` 为非空 `string[]`，`addEmployee` → provision 请求体携带 `skills`；未安装的 slug 由 Main **统一**走 ClawHub / `ensureSlugsViaClawHub`，与从 Catalog 添加员工时一致。

2. **搜索与结果来源**
   - **无搜索关键词**（`trim` 为空）：下拉列表仅展示 **本地已安装技能**（来自 `useSkillsStore`，进入对话框时确保已 `fetchSkills`），可滚动，便于快速勾选。
   - **有关键词**：防抖后合并两类结果：
     - **Skillhub**：`fetchSkillhubPage(q, pageNo)`（业务云分页搜索，与技能商店同源 API）；
     - **本地**：对 `useSkillsStore.skills` 按 slug / 名称（及与现有聊天技能命令一致的归一化规则，避免重复实现时可抽共享辅助函数）做子串匹配。
   - **合并策略（已定稿）**：以 Skillhub 返回顺序为主列表；按 **slug** 去重；对每条展示 **已安装 / 未安装**（本地存在该 slug 则已安装）。**仅存在于本地**、且未出现在当前 Skillhub 页中的匹配项，以 **单独分组或置顶补漏** 形式展示，避免纯本地技能无法被选到。

3. **状态隔离**
   - 对话框内自管搜索词、Skillhub 分页与加载状态；**不得**写入 `useSkillhubListStore` 全局状态，避免与「设置 → 技能 → 商店」Tab 互相覆盖。

## 非目标

- 不在创建对话框内单独展示 ClawHub 安装进度条（与 `employee-provision-required-skills-design` 一致；日志级可观测性已由 Host 承担）。
- 不重新定义 `Employee` 类型中 `skills` 字段含义；不与聊天侧 `SkillPickerPopover` 合并为同一组件，除非实现阶段发现重复过大再抽离（可选重构，非本设计必做）。

## 架构与数据流

1. 用户在 `CreateDigitalEmployeeDialog` 中选择 0 个或多个 slug（chip 可删；删至 0 → 继承全部）。
2. 提交时：若 `selectedSlugs.length > 0`，在构造 `Employee` 时设置 `skills: selectedSlugs`；否则不传或等价不传（与 `src/stores/employees.ts` 现有 `...(Array.isArray(payload.skills) && payload.skills.length > 0 ? { skills: payload.skills } : {})` 对齐）。
3. `useEmployeesStore.addEmployee` → `POST /api/employees/provision`（现有逻辑）。
4. Main：`provisionDigitalEmployeeAgent` → 若 `skills` 非空则 **`ensureSlugsViaClawHub`** → **`applyAgentSkillAllowlist`**（现有逻辑）。

## UI 要点

- 区块标题与占位、空态、已安装/未安装标签：**i18n**（`employees` 或复用 `skills` 键名以产品为准）。
- **无关键词**：列表仅为本地已安装项；若 Gateway 未运行导致本地为空，展示空态说明（可引导去技能页或输入关键词搜商店）。
- **有关键词**：支持 Skillhub **加载更多**（与商店列表行为对齐，每页 15 条）；本地匹配与 Hub 结果合并展示。

## 错误与边界

- Skillhub 请求失败：可仅展示本地匹配结果 + 错误提示或静默降级（实现阶段二选一，需在实现计划中写清；本设计倾向 **降级 + 简短提示**）。
- 同一 slug 在 Hub 与本地均出现：**一行展示**，已安装以本地为准。

## 测试

- **单元**：合并与去重（无关键词仅本地、有关键词 Hub+本地、补漏、已安装标记）；可选对 `normalizeCommandName` 与 slug 比对的一致性用例。
- **E2E**：按 AGENTS.md，为创建数字员工对话框的选技能与提交流程补充 Playwright 覆盖。

## 与既有文档的关系

- **Provision 与安装**：`2026-04-16-employee-provision-required-skills-design.md`
- **聊天侧按白名单过滤展示**：`2026-04-16-chat-skill-picker-employee-allowlist-design.md`（创建员工写入 `Employee.skills` 后，聊天行为与该 spec 一致）
- **Skillhub API**：`docs/api-docs/06_Skillhub_API.md`

---

*实现阶段使用 **writing-plans** 产出任务拆分。*
