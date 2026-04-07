# 技能商店：技能列表改为卡片栅格（含「立即使用」跳转 Chat 预填）

## 背景

当前 `src/pages/Skills/index.tsx` 的「已安装技能」区域为纵向列表（每行一条），支持点击打开详情抽屉与启用/禁用开关。用户期望将该列表改为卡片展示，并提供更直观的操作入口（立即使用/删除），同时对内置技能（Bundled）提供明确的不可删除反馈。

## 目标

- 将「已安装技能」列表改为**卡片栅格**，且**每行最多 3 个**。
- 列表末尾显示文案 **「没有更多了」**（当存在技能项时）。
- **内置技能**在删除图标上 hover 时显示 **「不能删除内置技能」**。
- 新增卡片操作 **「立即使用」**：点击后进入聊天并在输入框**预填**该技能的命令（`/command`），聚焦输入框，用户可继续补充参数并发送。

## 非目标

- 不改造右侧「Marketplace 搜索结果」列表（本次仅针对主页面已安装列表）。
- 不新增卸载二次确认（用户明确：否）。
- 点击「立即使用」后不自动打开技能详情抽屉（用户明确：否）。
- 不改变技能数据加载、合并、启用态规则（参见既有 spec：`2026-04-07-chat-skills-auto-load-design.md`）。

## 术语与判定

- **Core 技能**：`skill.isCore === true`。现有行为：开关禁用。
- **内置技能（Bundled）**：`skill.isBundled === true`。本次新增行为：不可删除，并给出 hover 文案反馈。
- **可卸载技能**：`!skill.isBundled && !skill.isCore && !!skill.slug`（卸载依赖 slug；若无 slug 则不展示删除入口，避免无效操作）。

## UI 设计

### 1) 布局与栅格

将 `filteredSkills` 渲染容器从纵向列表改为 `grid`，采用响应式列数但保证「每行最多 3 个」：

- 小屏：1 列
- 中屏：2 列
- 大屏：3 列（上限）

卡片间距与圆角沿用 Skills 页既有视觉语言（柔和底色、轻边框、hover 背景）。

### 2) 卡片信息层级

每张卡片包含：

- **头部**：图标（`skill.icon` 或回退 emoji）+ 名称（`skill.name`），必要时保留 slug/ID 的小标签（与现有列表信息密度一致）。
- **正文**：描述（`skill.description`），2 行截断。
- **底部操作区**（同一行右侧对齐）：
  - 主按钮：**「立即使用」**
  - 开关：`Switch`（保持现有 enable/disable；`isCore` 禁用）
  - 删除：`Trash` 图标按钮（见下一节规则）

### 3) 删除按钮规则与 hover 文案

- `skill.isBundled === true`：展示删除图标但按钮 **disabled**，鼠标移上去显示 tooltip：**「不能删除内置技能」**。
- `skill.isCore === true`：不提供删除（隐藏）或禁用（实现可选，推荐隐藏以减少噪音）。
- 其余可卸载：点击触发卸载（复用现有 `handleUninstall(skill.slug)`），**不弹二次确认**。

> 说明：当前卸载入口主要在详情抽屉；本次将入口前置到卡片层，但卸载能力与后端契约不变。

### 4) 列表末尾「没有更多了」

当 `filteredSkills.length > 0` 时，在卡片栅格下方显示一行弱文案：

- 文案：**「没有更多了」**
- 样式：居中、次要颜色（`text-muted-foreground`）、上下留白适中。

当列表为空时保持现有空状态（Puzzle icon + 文案）。

## 交互与数据流设计（立即使用）

### 1) 预填命令的生成

卡片点击「立即使用」时生成命令：

- 原始 key：`skill.slug ?? skill.id`
- 规范化：使用聊天侧既有 `normalizeCommandName`（`src/pages/Chat/chat-skill-command.ts`）
- 显示/插入：`/${cmd}`

### 2) 路由传参与一次性消费

从 Skills 页跳转到 Chat，携带一次性预填信息（推荐使用路由 `state`，避免污染 URL）：

- `navigate('/', { state: { prefillSkillCommand: '/xxx' } })`

Chat 页面（或 `ChatInput`）在首次渲染后读取该 state：

- 将 `prefillSkillCommand` 按现有插入/ZWSP/chip 规则写入 composer
- 聚焦 composer
- **消费掉**该 state（例如 `navigate(location.pathname, { replace: true, state: null })` 或等效方式），避免返回/重复渲染造成二次插入

### 3) 与既有 Slash/SkillPicker 关系

预填命令应复用既有插入工具与 chip 规则，确保：

- 与 `SkillPickerPopover` 选中技能后的插入行为一致
- 不额外引入新的命令格式或解析分支

## i18n 文案

需要为 `skills` 命名空间新增 key（至少 `zh/en/ja`）：

- `card.useNow`: 立即使用
- `card.noMore`: 没有更多了
- `card.cantDeleteBundled`: 不能删除内置技能

## 测试计划（实现阶段）

- **单元测试（可选）**：对「预填命令」生成与 `normalizeCommandName` 适配做轻量测试（若现有已覆盖，可不新增）。
- **E2E（建议）**：
  - Skills 页卡片渲染为栅格且最多 3 列（可用 viewport + 选择器断言）。
  - 内置技能删除按钮 hover 显示「不能删除内置技能」。
  - 点击「立即使用」跳转 Chat，输入框出现预填 `/<cmd>`，并聚焦可继续输入。

## 实现后检查清单

- [ ] 文案已加入 `zh/en/ja` locale，且 key 命名一致
- [ ] `pnpm run typecheck` 通过
- [ ] `pnpm run lint` 通过
- [ ] Playwright E2E（若新增/更新）通过

