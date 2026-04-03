# Chat 输入框技能选择（Slash Skill Picker）与内联气泡（Overlay）设计

## 背景与目标

当前 `src/pages/Chat/ChatInput.tsx` 提供消息输入、发送、附件与 `@Agent` 路由选择，但没有“选择技能并插入技能命令”的 UI。你希望在对话输入框内：

1. 增加一个“选择使用技能”的入口（类似截图红框的搜索 + 卡片列表）。
2. 点击技能后，把对应技能命令插入到当前输入框中，并能被 OpenClaw Gateway 正确识别与解析。
3. 插入后的技能命令在输入框内以“小气泡（chip）”形式展示，hover 右上角出现 `X` 可删除该技能命令。

本设计目标是在不破坏现有输入体验（IME、Enter/Shift+Enter、粘贴/拖拽附件、聚焦逻辑）的前提下，新增技能选择与可撤销的内联气泡展示。

## 成功标准

1. Chat 输入区出现一个新的“技能”按钮，点击后弹出技能选择面板（带搜索）。
2. 面板只展示 `enabled: true` 的技能；点击卡片后把 `/${commandName} ` 插入到 `textarea` 当前光标位置，插入后光标移动到插入串末尾、面板自动关闭并保持输入框焦点。
3. 输入框内的 `/${commandName}` 命令以气泡形式展示，hover 显示 `X`，点击 `X` 会从底层输入文本中精确删除对应的命令 token（以及其后紧跟的一个空格，如果存在）。
4. 命令名会按 OpenClaw slash 技能命令规则进行规范化（`a-z0-9_`，最长 32），保证插入串与面板显示一致，尽最大可能被 Gateway 识别。
5. 面板底部提供“技能库”入口，点击跳转到应用内 `/skills` 页面。

## 设计范围

### 需要变更的部分

- UI（聊天输入组件）
  - `src/pages/Chat/ChatInput.tsx`：新增技能按钮、弹出面板、插入逻辑、overlay 气泡渲染与删除逻辑。
- UI（可复用的技能选择面板组件，推荐抽离）
  - `src/pages/Chat/SkillPickerPopover.tsx`（新建，或放入 `src/pages/Chat/` 下的局部组件）：渲染搜索框 + 技能列表 + “技能库”入口。
- i18n
  - `src/i18n/locales/*/chat.json`：补充与技能面板相关文案（如“选择技能”“搜索技能”“技能库”“暂无可用技能”）。
- 技能数据来源（复用现有 store）
  - `src/stores/skills.ts`：复用 `useSkillsStore().skills` 与 `fetchSkills()`，不新增新的 API。

### 明确不做（非目标）

- 不将 `textarea` 改为 `contenteditable` 或引入富文本编辑器（风险高，会破坏现有附件/键盘/IME 兼容性）。
- 不保证所有技能命令都能被执行（Gateway 对 skills snapshot、skill enable/disable、命令冲突等因素仍会影响实际行为）；本设计只保证插入格式与 OpenClaw 规范对齐，并提供“技能库”入口供用户管理启用状态。
- 不实现 `/skill ...` 通用命令插入（本次明确选择插入 `/${skillSlug}` 形式）。

## OpenClaw 命令约束（实现插入“规范化”的依据）

OpenClaw Gateway 处理以 `/` 开头的 slash commands。对“用户可调用技能”暴露为 slash 命令时，命令名会被规范化为：

- 字符集：`a-z0-9_`
- 最大长度：32
- 冲突时可能被加后缀（例如 `_2`）

说明：UI 侧无法可靠推断“冲突后缀”，因此本设计采用“规范化 slug/id → commandName”的方式，最大化命中率；若运行时存在冲突导致 suffix，用户仍可手动编辑命令（此时气泡会随文本变化而更新/消失，见“识别规则”）。

## UI 设计：入口与面板

### 入口按钮

在 `ChatInput` 左侧工具按钮行中，新增一个“技能”按钮：

- 位置：在“附件（回形针）”与“@Agent”按钮之间。
- 行为：点击切换技能面板的显示/隐藏。
- 禁用态：当 ChatInput `disabled || sending` 时禁用（与附件按钮一致）。

### 技能选择面板（Popover）

面板从入口按钮上方弹出，结构：

1. 搜索框：placeholder 为“搜索技能”，支持按 name/slug/description 过滤。
2. 列表项（卡片样式，单行一项）：
   - 左侧图标：优先显示 `skill.icon`（emoji），否则显示默认图标。
   - 主标题：显示将被插入的命令，如 `/${commandName}`（粗体）。
   - 副标题：`skill.description`（截断到两行）。
3. 底部入口：“技能库”，点击跳转 `/skills`。

面板数据源：

- 打开面板时调用 `useSkillsStore.getState().fetchSkills()`（如已有缓存可直接展示；实现阶段可做“首次打开才拉取”的节流）。
- 只展示 `enabled: true` 的技能。

关闭规则：

- `Esc` 关闭。
- 点击面板外关闭。
- 选择一个技能后自动关闭。

## 插入行为（文本层）

### 插入格式

点击某技能卡片后，在 `textarea` 当前光标位置插入：

- `/${commandName} `（末尾强制追加一个空格，便于用户继续输入参数/提示词）。

插入后：

- 将 selection/caret 移动到插入串末尾。
- 保持输入框焦点。
- 关闭面板。

### commandName 规范化

从 `skill.slug ?? skill.id` 得到 rawName，并转换为 commandName：

1. 转小写。
2. 将非 `a-z0-9_` 字符替换为 `_`（包括 `-`）。
3. 连续 `_` 可选择性压缩（实现阶段决定；压缩能更贴近“人类可读”，但不是必须）。
4. 截断到 32 字符。

UI 列表显示与实际插入使用同一 `commandName`，避免“点的和插入的不一致”。

## 输入框内联气泡（Overlay）设计

### 约束与方案选择

原生 `<textarea>` 无法在文本内部渲染可交互元素（chip）。为实现“看起来在输入框内、hover 显示 X、点 X 删除”，采用 **overlay 镜像渲染**：

- 底层：仍使用现有 `Textarea`（保留所有输入行为）。
- 上层：一个覆盖在 textarea 内容区域的 `div`，按相同的排版规则把 `input` 文本渲染出来，并把命令 token 渲染为 chip。

### 视觉与交互策略

- `textarea`：文字颜色设为透明（`color: transparent`），但保留光标颜色（`caret-color` 正常），保证用户仍能看到光标与输入位置。
- overlay：使用正常文字颜色渲染内容与 chip。
- pointer events：
  - overlay 默认 `pointer-events: none`，保证点击空白区域仍落到 `textarea` 用于定位/聚焦。
  - chip 与其 `X` 按钮区域设为 `pointer-events: auto`，允许点击删除。

### Token 识别规则（决定哪些文本渲染为 chip）

为了避免用户输入中途被“抢占成 chip”导致难编辑，chip 只对“完整命令 token”生效：

- 匹配模式：`/(?:[a-z0-9_]{1,32})`（前导 `/`）
- 边界条件：token 后必须是以下之一才视为“完整 token”
  - 空格 ` `
  - 换行 `\n`
  - 文本结束
  - 标点（实现阶段按需求决定是否包含；默认不包含以减少误识别）

当用户正在输入 `/fe` 并且尚未输入空格/换行时，不渲染为 chip，仍显示为普通文本；当输入到 `/feishu ` 后，下一次渲染周期才替换为 chip。

### 删除行为（chip 的 X）

点击 chip 的 `X`：

1. 在底层 `input` 字符串中定位该 chip 对应的 token 的起止范围（基于 overlay 渲染时产生的分段索引，避免二次正则导致错删）。
2. 删除 token 本身，并额外删除其后紧跟的一个空格（若存在）。
3. 更新 `input` state，并将 caret 放到删除位置（或就近位置，保证继续输入自然）。

### 与输入法/键盘的兼容性

- 不改变 `textarea` 的 `onKeyDown`、`onCompositionStart/End` 逻辑，只在 `onChange` 后的渲染层做展示替换。
- chip 删除是鼠标操作（click），不会打断 IME composing；实现阶段需确保 composing 时点击删除不会触发发送/回车逻辑。

### 对齐排版（关键实现约束）

overlay 必须与 `Textarea` 使用完全一致的：

- 字体/字号/行高
- padding
- `white-space: pre-wrap`、`word-break`、`overflow-wrap` 等换行规则
- 滚动行为：当 `Textarea` 出现滚动条时，overlay 必须同步滚动位置（监听 `textarea.scrollTop/scrollLeft`）。

否则会出现“文本对不齐”导致光标与显示错位。

## 边界与错误处理

- **无可用技能**：当 `enabled: true` 的技能列表为空时，面板显示“暂无可用技能”，并提示去“技能库”启用技能。
- **搜索无结果**：显示“未找到技能”与“尝试不同搜索词”。
- **命令冲突**：若运行时实际命令为 `name_2` 等后缀，UI 仍插入 `/${commandName}`。用户可手动修改；此时 overlay 只要满足 token 识别规则仍会显示 chip。
- **多命令文本**：输入中可包含多个 slash token，overlay 会分别渲染为多个 chip；删除操作只影响点击的那个 token。

## i18n 文案（建议新增 keys）

在 `chat.json` 的 `composer` 下新增（zh/en/ja 都要补齐）：

- `skillPicker.open`: “选择技能”
- `skillPicker.searchPlaceholder`: “搜索技能”
- `skillPicker.skillsLibrary`: “技能库”
- `skillPicker.emptyEnabled`: “暂无可用技能（请先在技能库启用）”
- `skillPicker.noResults`: “未找到技能”

（具体 key 命名实现阶段可微调，但需保持结构一致并补齐三语。）

## 测试策略（实现阶段）

### 单元测试（Vitest + React Testing Library）

- 新增 `tests/unit/chat-skill-picker.test.tsx`：
  - 打开面板 → 展示 enabled 技能列表
  - 搜索过滤
  - 点击技能 → 向 input 指定光标位置插入 `/${commandName} `
  - overlay 渲染：完整 token 才变为 chip；不完整 token 保持文本
  - 点击 chip 的 `X` → 删除对应 token（及后空格）

### E2E（Playwright）

- 新增/更新 Electron E2E：
  - 打开 Chat → 打开技能面板 → 点选技能 → 输入框出现 chip → 点击 X 删除 → 发送消息验证发送文本符合预期（至少验证 textarea 的 value）。

## 实施计划概览（不含具体代码）

1. 为 `ChatInput` 增加技能按钮与 popover 面板（复用 `useSkillsStore`）。
2. 实现“插入到光标位置”的字符串拼接 + selection 更新。
3. 在 `Textarea` 容器上实现 overlay 镜像渲染：解析 tokens → 渲染文本片段与 chip。
4. 实现 chip 删除：基于 token 索引删除 input 子串并更新 caret。
5. 补齐 i18n 与测试（unit + e2e）。

