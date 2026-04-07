# 聊天 Slash 技能选择器与图标面板统一设计

## 背景

当前实现中存在两条路径：

1. **技能图标**：打开 `SkillPickerPopover`（独立搜索框 + 列表 +「技能库」入口）。
2. **输入框输入 `/`**：通过 `getSlashQueryAtCaret` 检测后设置 `slashInline`，使用 `ComposerSlashDropdown` 锚定在 `/` 附近；**搜索词实际打在 composer 的纯文本里**（`/xxx` 片段），与图标路径不一致。

用户期望：`/` 触发的界面与点击技能图标**完全一致**，后续打字发生在**面板内的搜索框**中，而不是在输入框里继续拼 slash 片段并触发与「从面板选择」不同的体验。仅当**不是**从技能窗口选中插入时，不应把未完成或随意的输入变成「技能 chip」体验上的误导；同时**保留**手动完整输入 `/cmd` 且满足边界与技能匹配时的 chip 行为（见下文）。

前置规格：

- `docs/superpowers/specs/2026-04-03-chat-skill-picker-design.md`（chip、token 边界、插入格式）。
- `docs/superpowers/specs/2026-04-07-chat-skills-auto-load-design.md`（技能列表加载与 `fetchSkills`）。

## 目标

1. **`/` 与图标共用同一 UI**：仅使用 `SkillPickerPopover`（同一布局、同一 `data-testid`、同一搜索与列表行为）。
2. **搜索在面板内**：用户输入 `/` 进入 slash 会话后，**后续用于筛选技能的字符**只出现在面板搜索框中；composer 在对应 slash 位置**只保留单个 `/`**（直至选中技能或取消）。
3. **取消时保留 `/`**：Esc 或点击外部关闭面板且未选中技能时，composer **保留**已输入的 `/`；**不**将搜索框中的内容写回 composer。
4. **Chip 规则与手动输入**：用户**未**通过面板、而是**完整手动输入** `/command` 且满足既有**后置边界**（空格/换行/文末），并且 **command 规范化后与某个已启用技能一致** 时，仍按 overlay 规则渲染为 chip；若不匹配任何已启用技能，则始终为普通文本展示与发送。

## 非目标

- 不改变「非 slash 技能选择」的附件、`@Agent`、发送与 Gateway 解析语义。
- 不在本规格中重做技能列表加载逻辑（继续依赖既有 store 与 `fetchSkills`）。

## 方案结论

采用 **统一 `SkillPickerPopover` + 从 composer 剥离 query 至面板搜索**（brainstorming 方案 1）。

- **不采用**仅统一视觉而仍在 composer 内输入 query（无法满足「打字在搜索框」）。
- **不采用**仅 `/` 打开面板并完全拦截后续键入、且不在 composer 保留 `/` 的简单模型（与「取消保留 `/`」及快速输入兼容不如统一剥离方案）。

## 详细设计

### 1. 触发条件（与现有检测对齐）

- 继续使用 `getSlashQueryAtCaret(text, caret)`（`chat-composer-slash-query.ts`）判定「当前是否处于可编辑的 slash 片段」：合法前缀边界、`/` 后仅 `[a-z0-9_]*`、长度上限与光标位置一致。
- 一旦返回非 `null`：调用 `fetchSkills()`（与现有一致），并进入 **slash 驱动的技能面板会话**（见下节）。

### 2. Slash 会话与 `SkillPickerPopover` 绑定

- **打开**：`skillPickerOpen === true`，渲染与技能图标**同一份** `SkillPickerPopover`（同一 ref 容器策略：可与图标共用同一 DOM 挂载点，或两处渲染但保证 UI/行为一致；推荐**单一挂载**以免双实例与焦点竞争）。
- **搜索框受控**：会话内搜索字符串由父组件（如 `ChatInput`）持有，例如 `slashPickerSearchQuery`，作为 `SkillPickerPopover` 的受控 `value` + `onChange`（若当前组件为内部 `useState`，需改为可由父组件覆盖的受控模式）。
- **Query 来源与 composer 剥离**：
  - 设 `getSlashQueryAtCaret` 返回 `{ slashIndex, query }`，其中 `query` 为 `/` 与光标之间的 `[a-z0-9_]*`。
  - 在 `onChange` 同步路径中：将 composer 更新为「删除 `slashIndex+1` 至 `caret` 的子串」，使该 slash 片段在文本层仅保留 `slashIndex` 处的一个 `/`；将**被删除的子串**（即原 `query`）设为 `slashPickerSearchQuery`。
  - 光标：置于 `slashIndex + 1`（紧接在 `/` 之后），或按产品一致性与 IME 安全性的实现选择（需与 `ChatComposer` 协调，避免与 composition 冲突）。
- **面板打开后焦点**：使用 `requestAnimationFrame` 或 `useEffect`（`open && fromSlash`）对 `SkillPickerPopover` 内搜索 `input` 执行 `focus()`，保证后续键入进入搜索框而非 composer。

### 3. 图标打开 vs Slash 打开

| 来源 | `skillPickerOpen` | `slashIndex` / 会话 | 搜索初始值 | 选中后插入 |
|------|-------------------|----------------------|------------|------------|
| 技能图标 | true | 无 slash 锚点 | 空（或保持组件内清空策略） | 现有 `insertAtSelection` / `applySkillPick` |
| `/` | true | 记录 `slashIndex`（及必要时 `slashSegmentRev` 防错位） | 从 composer 剥离出的 `query` | 在 `slashIndex` 处替换片段，等价于当前 `applyInlineSlashPick`（`ZWSP` 包裹等规则不变） |

- 从图标打开时应 **清除** slash 会话状态（与现有点击图标时 `setSlashInline(null)` 一致），避免两种模式叠加。

### 4. 关闭与取消

- **Esc / 点击外部 / 未选关闭**：`skillPickerOpen = false`，清除 slash 会话与 `slashPickerSearchQuery`；composer **保留**单个 `/`（用户已确认）。
- **选中技能**：关闭面板，在记录的 `slashIndex` 执行插入；清除 slash 会话状态；焦点回 composer。

### 5. Chip 与「非面板」文本

- **Overlay chip 识别**仍以 `2026-04-03` 的 token 边界与后置边界为准。
- **匹配已启用技能**：规范化后的 command 与 `useSkillsStore` 中 `enabled === true` 的技能 `normalizeCommandName(slug ?? id)` 集合比对；**匹配则 chip**，**不匹配则普通文本**（不因形似 slash 而强制 chip）。
- **与 slash 会话的关系**：在 slash 会话期间，composer 仅保留 `/`，不产生 `/query` 完整片段，故**不会**在会话中途把「正在搜索的字符」显示为 chip；会话结束后的最终文本仍按上条规则解析。

### 6. 键盘行为

- 面板打开且焦点在搜索框时：`ArrowUp` / `ArrowDown` 与 `Enter` 用于高亮与确认选择（逻辑可从当前 `slashInline` 分支迁移）；**Enter 不得触发发送消息**。
- 面板关闭后：恢复现有 Enter 发送、Shift+Enter 换行。
- **输入法**：`isComposing` 期间不改变既有 `ChatComposer` 与 chip 删除的保守策略（见 `2026-04-03`）；若剥离 query 与 composition 冲突，以实现阶段为准优先不破坏 IME。

### 7. 实现清理

- 移除 **`ComposerSlashDropdown`** 及 **`slashInline` 状态**在「仅服务 `/` 下拉」上的用途；`getSlashQueryAtCaret` 仍可用于判定进入会话与 `slashIndex`。
- 合并重复的过滤列表逻辑：图标与 slash 共用 `SkillPickerPopover` 内列表过滤（或提取共享 `filterEnabledSkills(query, skills)`）。

### 8. 测试

- **单元测试**：`/` → 面板打开 → query 仅在搜索框；composer 仅 `/`；选中插入；Esc 关闭后仍为 `/`；手动输入 `/feishu `（匹配 enabled）→ chip。
- **E2E**：与 `AGENTS.md` 一致，覆盖「`/` 与图标同一 popover testid」「搜索框输入」「取消保留 `/`」。

### 9. 相关文档修订

- 更新 `2026-04-03-chat-skill-picker-design.md`：补充「`/` 与图标共用 `SkillPickerPopover`，不再使用内联 `ComposerSlashDropdown`」的说明段落（实现与本 spec 同步修改）。

## 实现后检查清单

- [ ] `pnpm run typecheck`、`pnpm test`、相关 E2E 通过。
- [ ] 若有用户可见行为变更，按需同步 `README.md` / `README.zh-CN.md` / `README.ja-JP.md`（本改动若仅为输入交互，可仅更新规格）。
