# 员工详情 Sheet 展示技能白名单与继承说明（设计）

## 背景

数字员工 `Employee` 可选字段 `skills?: string[]` 表示 per-agent 技能白名单（slug）；与 `2026-04-16-chat-skill-picker-employee-allowlist-design.md` 一致：**缺失或空数组表示不单独设白名单，运行时与主 Agent 策略一致（聊天侧表现为继承全部已启用本地技能）**。

当前 `EmployeeDetail`（员工卡片打开的右侧 Sheet）展示部门、氛围、描述等，**未**展示该白名单；用户无法在详情中直接看到「该员工限制在哪些技能」或「是否继承主 Agent」。

## 目标

1. **继承态**：当 **`skills` 未设置或为空数组 `[]`** 时，不渲染技能列表；展示简短说明文案，表达 **继承主 Agent 技能配置**（与既有「继承全部」语义一致）。
2. **白名单态**：当 **`skills` 非空** 时，在详情中展示 **可用技能列表**（按白名单顺序）：
   - 若在本地 `useSkillsStore.skills` 中通过 **`normalizeCommandName`**（与 `getChatVisibleSkillsForAgent` 同源规则）能匹配到 `Skill`：**主文案使用 `Skill.name`**（展示名）。
   - 若匹配不到：**主文案使用白名单中的 slug（或等价可读命令名）**，并标注 **未安装**。
   - 若匹配到但 **`enabled === false`**：可加次要标注 **已禁用**，与「未安装」区分。
3. **数据来源**：白名单以 **`myEmployees` 中与当前 `employee.id` 匹配的那条为准**（若存在），否则回退为 **传入的 `employee`**（Catalog 数据），便于 provision 落地后详情与 store 一致。

## 非目标

- 不在详情 Sheet 内发起安装技能或修改白名单（仅展示；安装仍走既有商店 / provision 链路）。
- 不以 OpenClaw 配置文件为详情唯一真相源；展示层与 `Employee.skills` / store 对齐，与聊天设计一致。

## 架构与数据流

1. **输入**：`employee`（props）、`linkedRow = myEmployees.find(e => e.id === employee.id)`、`skillsWhitelist = linkedRow?.skills ?? employee.skills`、全量 `Skill[]`。
2. **解析**：抽 **纯函数**（推荐）例如 `getEmployeeSkillAllowlistRows(whitelistSlugs, skills)`，对每条白名单 slug：
   - 在 `skills` 中查找满足 `normalizeCommandName(slug) === normalizeCommandName(skill.slug ?? skill.id)` 的条目；
   - 生成行：`primaryLabel`、`state`（`installed` / `installedDisabled` / `missing`）等，供 UI 映射为「展示名 + 未安装 / 已禁用」。
3. **消费**：`EmployeeDetail` 调用 `useSkillsStore` 与上述函数，渲染区块标题 + 列表；继承态仅渲染说明文案。

## UI 与文案

- 区块标题：如「可用技能」或「技能白名单」（与产品用语统一即可）。继承态文案需 i18n（中文示例：**继承主 Agent 技能配置**）。
- 列表顺序与 `skillsWhitelist` **数组顺序一致**。

## 边界

- Skills store 尚未加载或为空时，白名单可能全部显示为「未安装」；属预期，不强制详情内额外拉取 Gateway。
- 不在本需求中强制 Skeleton；若实现阶段需减轻闪烁，可用轻量占位。

## 测试

- **单元**：纯函数表驱动——空/缺省、非空、匹配/不匹配、`normalizeCommandName` 等价、顺序保持、disabled 技能。
- **E2E**：按 `AGENTS.md`，在员工详情 Sheet 上覆盖：继承文案 vs 列表 + 未安装（或等价选择器）的出现条件。

## 与既有文档的关系

- 白名单语义与 `2026-04-16-chat-skill-picker-employee-allowlist-design.md`、`2026-04-16-employee-provision-required-skills-design.md` 对齐；本设计仅约束 **Agents 页员工详情 Sheet 的展示层**。
