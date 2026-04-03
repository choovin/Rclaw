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

选区/复制与可访问性（验收要求）：

- 拖拽选择文本时，选区高亮应与 overlay 文本视觉一致（即：用户看到的“被选中区域”与复制结果一致）。
- 复制（Ctrl/Cmd+C）得到的内容必须为底层 `textarea.value` 原文，不包含任何展示层符号。
- 屏幕阅读器应仍以 `textarea` 为可读对象（overlay 仅作视觉层，不应抢夺可访问性焦点）。

### Token 识别规则（决定哪些文本渲染为 chip）

为了避免用户输入中途被“抢占成 chip”导致难编辑，chip 只对“完整命令 token”生效：

- 匹配模式：`/(?:[a-z0-9_]{1,32})`（前导 `/`）
- **前置边界**：token 仅在满足以下条件之一时才被识别为命令：
  - token 位于文本开头（index 0），或
  - token 前一个字符属于“分隔符集合”：空格、换行、Tab、左括号、左中括号、左大括号、单双引号（实现阶段将这组字符以常量形式定义）。
  - 目的：避免在 URL（如 `http://a/b`）、路径（如 `foo/bar`、`/usr/bin`）或单词内部把 `/xxx` 误识别为命令。
- **后置边界（最终选择：保守策略）**：token 后必须是以下之一才视为“完整 token”
  - 空格 ` `（0x20）
  - 换行（`\n` 或 `\r\n` 的 `\n` 位置，见“换行归一化约束”）
  - 文本结束
  - 说明：`/cmd,`、`/cmd.`、`/cmd)` 等 **不** 视为完整 token（仍按普通文本显示）。用户需输入空格或换行后，token 才会变为 chip。

最小验收示例：

- 应识别为 chip：
  - `"/feishu "`（开头 + 后置空格）
  - `"请用 /feishu "`（前置空格 + 后置空格）
  - `"(\n/feishu \n"`（前置换行 + 后置空格/换行）
- 不应识别为 chip：
  - `"http://a/b "`（前置字符不属于分隔符集合）
  - `"foo/bar "`（同上）
  - `"/feishu,"`（后置不是空格/换行/EOF）

当用户正在输入 `/fe` 并且尚未输入空格/换行时，不渲染为 chip，仍显示为普通文本；当输入到 `/feishu ` 后，下一次渲染周期才替换为 chip。

### 删除行为（chip 的 X）

点击 chip 的 `X`：

1. 解析阶段必须为每个 token 记录其在 `textarea.value` 中的稳定范围：
   - `startIndex`：包含 `/` 的起点
   - `endIndexExclusive`：不包含后置边界字符的终点
   - overlay 渲染 chip 时将该范围绑定到 chip（闭包参数或 data 属性），点击删除时直接使用范围切片删除，避免“按文本再搜索”造成错删（尤其在重复 token 场景：`/a /a `）。
2. 删除 token 本身；并且**仅**额外删除其后紧跟的一个半角空格（0x20，若存在）。
   - 不跨越换行（不删除 `\n`/`\r\n`），不吞掉多个空格或 Tab。
3. Caret/selection 更新规则（可验收）：
   - 删除后将 selection 折叠为 caret，其位置为 `startIndex`。
   - 若当前 selection 完全位于被删范围之后，则整体左移删除长度。
   - 若当前 selection 与被删范围有交叠，则统一折叠到 `startIndex`。

### 与输入法/键盘的兼容性

- 不改变 `textarea` 的 `onKeyDown`、`onCompositionStart/End` 逻辑，只在 `onChange` 后的渲染层做展示替换。
- **Composing 期间交互规则（最终选择：更安全）**：当 `isComposing === true` 时，禁用 chip 的删除按钮（`X` 不显示/不可点击），避免 composition 未提交导致 value 变更顺序错乱；composition 结束后恢复可删除。

### 对齐排版（关键实现约束）

overlay 必须与 `Textarea` 使用完全一致的：

- 字体/字号/行高
- padding
- `white-space: pre-wrap`、`word-break`、`overflow-wrap` 等换行规则
- 滚动行为：当 `Textarea` 出现滚动条时，overlay 必须同步滚动位置（监听 `textarea.scrollTop/scrollLeft`）。

否则会出现“文本对不齐”导致光标与显示错位。

- **尺寸同步**：当 `textarea` 宽度/高度变化（窗口 resize、自动增高、出现/消失滚动条）时，overlay 的 content box 尺寸必须同步更新，以避免换行点不同导致错位。
- **换行归一化约束**：token 解析、overlay 渲染与删除索引必须基于同一份 `textarea.value` 字符序列；不在任一层对 `\r\n` 做隐式归一化（或若归一化，则必须在写回 value 时同步归一化并保证索引一致），避免 Windows 换行导致 start/end 下标错位从而错删。

## 边界与错误处理

- **无可用技能**：当 `enabled: true` 的技能列表为空时，面板显示“暂无可用技能”，并提示去“技能库”启用技能。
- **搜索无结果**：显示“未找到技能”与“尝试不同搜索词”。
- **命令冲突**：若运行时实际命令为 `name_2` 等后缀，UI 仍插入 `/${commandName}`。用户可手动修改；此时 overlay 只要满足 token 识别规则仍会显示 chip。
- **多命令文本**：输入中可包含多个 slash token，overlay 会分别渲染为多个 chip；删除操作只影响点击的那个 token。
- **重要说明**：chip 仅是语法高亮/可撤销插入，不代表该命令一定可被 Gateway 解析为已启用技能；解析失败时仍应按普通文本发送。

## i18n 文案（建议新增 keys）

在 `chat.json` 的 `composer` 下新增（zh/en/ja 都要补齐）：

- `skillPicker.open`: “选择技能”
- `skillPicker.searchPlaceholder`: “搜索技能”
- `skillPicker.skillsLibrary`: “技能库”
- `skillPicker.emptyEnabled`: “暂无可用技能（请先在技能库启用）”
- `skillPicker.noResults`: “未找到技能”

（具体 key 命名实现阶段可微调，但需保持结构一致并补齐三语。）

补充规则：

- 覆盖范围：所有存在 `src/i18n/locales/<lang>/chat.json` 的语言都必须补齐相同 keys；若某语言缺少 `chat.json`，遵循现有 i18n fallback 策略（本需求不强制新增新语言文件）。

## 测试策略（实现阶段）

### 单元测试（Vitest + React Testing Library）

- 新增 `tests/unit/chat-skill-picker.test.tsx`：
  - 打开面板 → 展示 enabled 技能列表
  - 搜索过滤
  - 点击技能 → 向 input 指定光标位置插入 `/${commandName} `（含存在选区时替换选区文本）
  - overlay 渲染：完整 token 才变为 chip；不完整 token 保持文本
  - 点击 chip 的 `X` → 删除对应 token（及后空格）
  - 重复 token（`/a /a `）点击第二个 `X` 只删除第二个
  - 不误识别 URL/路径（如 `http://a/b `、`foo/bar `）
  - composing 期间 `X` 不可用（若采用 composing 禁用规则）

### E2E（Playwright）

- 新增/更新 Electron E2E：
  - 打开 Chat → 打开技能面板 → 点选技能 → 输入框出现 chip → 点击 X 删除 → 发送消息验证发送文本符合预期（至少验证 textarea 的 value）。
  - Esc/点外关闭面板；点击技能后焦点仍在输入框
  - 输入多行触发滚动后 chip 不漂移（至少覆盖一个“多行滚动 + 仍可删除”的场景）

## 实施计划概览（不含具体代码）

1. 为 `ChatInput` 增加技能按钮与 popover 面板（复用 `useSkillsStore`）。
2. 实现“插入到光标位置”的字符串拼接 + selection 更新。
3. 在 `Textarea` 容器上实现 overlay 镜像渲染：解析 tokens → 渲染文本片段与 chip。
4. 实现 chip 删除：基于 token 索引删除 input 子串并更新 caret。
5. 补齐 i18n 与测试（unit + e2e）。

