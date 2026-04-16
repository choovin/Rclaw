# 聊天窗口按员工技能白名单过滤可选技能（设计）

## 背景

部分数字员工在 Catalog / provision 链路中带有 **`requiredSkills`**，落地为 `Employee.skills`（slug 数组），并在 OpenClaw 中配置为 per-agent 技能白名单（`agents.list[].skills`）。当前聊天输入区从 `useSkillsStore` 读取**全部本地技能**用于技能选择器与 `/` 联想，未按当前会话 Agent 对应的员工白名单过滤，与「该员工实际可用技能」不一致。

本设计约定：**渲染进程仅以 `Employee.skills` 为数据源**（选项 A），在聊天内将可选技能限制为与白名单一致，**不**在聊天侧读取 OpenClaw 配置文件作为真相源。

## 目标

1. **过滤范围**：技能按钮弹层（`SkillPickerPopover`）、用于 chip / `/` 联想的命令名集合（`slashChipCommandNames` 等）必须使用**同一套**「当前会话可见技能」，避免弹层可选而 `/` 不可选或相反。
2. **语义（与 `2026-04-16-employee-provision-required-skills-design.md` 对齐）**
   - **继承全部**：以下任一成立则**不做白名单过滤**（行为与当前一致：展示所有 **已启用** 的本地技能）  
     - 当前 `currentAgentId` 在 `myEmployees` 中**无** `linkedAgentId === currentAgentId` 的记录（非「我的员工」关联会话）；或  
     - 匹配到的 `Employee.skills` **缺失**或 **长度为 0**。
   - **白名单**：`Employee.skills` **非空** → 仅展示 `enabled === true` 且 slug 命中白名单的技能。
3. **Slug 匹配**：对员工侧 `skills` 与技能条目的 `slug ?? id` 均使用与聊天命令一致的 **`normalizeCommandName`**（见 `src/pages/Chat/chat-skill-command.ts`），再比较是否属于白名单集合，避免存储形态与命令名不一致。

## 非目标

- 不以 Host / OpenClaw 配置为聊天列表的唯一真相源（用户若手动改 `openclaw.json`，UI 可能与运行时不一致，直至员工数据或 provision 与之一致）。
- 不在本设计强制拦截用户手动输入的不在白名单内的 `/command`（运行时仍由 Agent 侧策略约束）；后续若需强提示可另开需求。

## 架构与数据流

1. **输入**：`useChatStore.currentAgentId`、`useEmployeesStore.myEmployees`、`useSkillsStore.skills`（全量）。
2. **解析**：`emp = myEmployees.find((e) => e.linkedAgentId === currentAgentId)`。  
   - 无 `emp` 或 `!emp.skills?.length` → **继承全部** → `chatVisibleSkills = skills` 经「仅 `enabled`」后的等价路径与现有一致（Popover 内部仍会筛 `enabled`，整体行为不变）。  
   - `emp.skills.length > 0` → 构建 `Set`：`emp.skills` 中每项经 `normalizeCommandName` 去重；`chatVisibleSkills = skills.filter(s => s.enabled && allowSet.has(normalizeCommandName(s.slug ?? s.id)))`。
3. **消费**：`ChatInput`（或抽出的 `useChatSkillPickerSkills` / 纯函数）将 `chatVisibleSkills` 传给 `SkillPickerPopover`，并用其构建 `slashChipCommandNames`（及依赖该集合的 chip 行为），**禁止**一处用全量、一处用过滤后列表。

**推荐实现组织**：抽离 **`getChatVisibleSkillsForAgent(agentId, skills, myEmployees)`**（或等价的 hook），集中白名单与 `normalizeCommandName` 逻辑，便于单元测试；避免仅把过滤塞进 `SkillPickerPopover` 而 `/` 仍在别处用全量 `skills`。

## 错误与边界

- **白名单非空但过滤后为空**：沿用现有空态；可选增强为更明确文案（产品决定，非本设计必做）。
- **`Employee.skills` 与本地技能表不一致**（例如 slug 未安装）：列表变短或为空，属预期；不在本设计要求自动安装。

## 测试

- **单元**：表驱动覆盖——非员工、无 `skills`、空数组、非空白名单、`normalizeCommandName` 等价条目。
- **E2E**：若对外可见文案或关键交互变化，按 `AGENTS.md` 补充 Playwright；否则以单元测试为主。

## 与既有文档的关系

- 员工 provision 与白名单语义见 `2026-04-16-employee-provision-required-skills-design.md`；本设计仅约束 **聊天 UI 展示层** 与 `Employee.skills` 对齐方式。
