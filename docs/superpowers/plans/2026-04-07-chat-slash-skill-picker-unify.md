# Chat Slash 与技能面板统一 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将输入 `/` 触发的技能 UI 与技能图标完全统一为 `SkillPickerPopover`，搜索在面板内；取消时保留 `/`；chip 仅对「完整 slash token 且规范化命令名匹配某已启用技能」渲染。

**Architecture:** `ChatInput` 在检测到 `getSlashQueryAtCaret` 时打开与图标相同的 `SkillPickerPopover`，用受控 `searchQuery` 与 composer 剥离同步；移除 `ComposerSlashDropdown` 与 `slashInline` 路径。`ChatComposer` 通过 `slashChipCommandNames: Set<string>`（由 `useSkillsStore` 派生）传入装饰层，仅在白名单内的 token 渲染为 chip。

**Tech Stack:** React 19、Vitest、Playwright Electron、现有 `chat-skill-command` / `chat-composer-decoration` / `ChatComposer` contenteditable 管线。

---

## 文件与职责

| 文件 | 职责 |
|------|------|
| `src/pages/Chat/SkillPickerPopover.tsx` | 支持受控搜索、打开时聚焦搜索框、列表内 ↑↓/Enter 选择；与图标路径共用。 |
| `src/pages/Chat/ChatInput.tsx` | Slash 会话状态、`skillPickerSearch`、composer 剥离、`fetchSkills`、键盘路由；删除 `slashInline`/`ComposerSlashDropdown`。 |
| `src/pages/Chat/ComposerSlashDropdown.tsx` | **删除**（或保留空壳 re-export 直至任务完成，推荐直接删除并更新 import）。 |
| `src/pages/Chat/chat-composer-decoration.ts` | `buildComposerBody` 增加「仅白名单 token 显示 chip」分支，其余 token 按纯文本渲染。 |
| `src/pages/Chat/ChatComposer.tsx` | 新增可选 prop `slashChipCommandNames?: ReadonlySet<string>`，传入 `buildComposerBody`。 |
| `src/pages/Chat/chat-skill-command.ts` | 可选：导出 `extractCommandNameFromSlashToken(text: string, token: SlashToken): string`（`text.slice(startIndex+1, endIndexExclusive)` 已规范化校验）避免重复逻辑。 |
| `src/pages/Chat/chat-composer-slash-query.ts` | 保留；无强制变更，供 `ChatInput` 继续调用。 |
| `tests/unit/chat-skill-picker.test.tsx` | 更新/新增：Popover 受控、chip 白名单、删除对 inline picker 的依赖。 |
| `tests/e2e/chat-skill-picker.spec.ts` | `/` 用例改为断言 `chat-skill-picker-popover` + `chat-skill-picker-search`，不再使用 `chat-skill-inline-*`。 |
| `docs/superpowers/specs/2026-04-03-chat-skill-picker-design.md` | 同步「`/与图标共用 SkillPickerPopover`」与 chip 白名单一句说明。 |

---

### Task 1: `slashChipCommandNames` 与装饰层

**Files:**
- Modify: `src/pages/Chat/chat-composer-decoration.ts`
- Modify: `src/pages/Chat/ChatComposer.tsx`
- Test: `tests/unit/chat-skill-picker.test.tsx`

- [ ] **Step 1: 在 `chat-composer-decoration.ts` 扩展 `BuildComposerBodyOptions` 与 `buildSlashMirrorParts`**

新增可选字段 `slashChipCommandNames?: ReadonlySet<string>`。对每个 `parseSlashTokens` 得到的 `token`，从 `plainText` 提取 command：`const cmd = plainText.slice(token.startIndex + 1, token.endIndexExclusive)`（与 `parseSlashTokens` 一致）。若 `slashChipCommandNames` **未传**，保持现有行为（所有合法 token 均为 chip）。若 **已传**，仅当 `slashChipCommandNames.has(cmd)` 时 `parts.push({ kind: 'token', token })`；否则将该 token 覆盖的区间作为 `kind: 'text'` 输出（与周围文本合并，避免拆成多段无意义 fragment 亦可，但索引必须连续）。

```typescript
// buildSlashMirrorParts 内循环 token 时伪代码
const cmd = text.slice(token.startIndex + 1, token.endIndexExclusive);
const allowChip =
  options?.slashChipCommandNames == null ||
  options.slashChipCommandNames.has(cmd);
if (!allowChip) {
  // 作为普通文本：可 push { kind: 'text', text: text.slice(token.startIndex, token.endIndexExclusive) }
  // 注意与前后 text 片段的拼接顺序保持原顺序
}
```

- [ ] **Step 2: `ChatComposer` 增加 prop 并传入**

```typescript
// ChatComposerProps 增加
slashChipCommandNames?: ReadonlySet<string>;

// buildComposerBody(value, {
//   removeButtonAriaLabel,
//   showRemoveButtons: true,
//   slashChipCommandNames: props.slashChipCommandNames,
// })
```

- [ ] **Step 3: 写失败单测（白名单外无 chip）**

在 `chat-skill-picker.test.tsx` 或新建 `chat-composer-decoration.test.ts`（若项目偏好测纯函数可抽 `buildSlashMirrorParts` 为 export 再测）。断言：value=`'/unknown '`、`slashChipCommandNames=new Set(['feishu'])` 时，不应出现 `data-testid="chat-skill-chip"`（若测 DOM，需 mount `ChatComposer`）。

更稳妥：导出 `buildSlashMirrorParts` 为 package-private 测试，或仅测 `render` 后 `queryAllByTestId('chat-skill-chip')` 长度为 0。

Run: `pnpm test -- tests/unit/chat-skill-picker.test.tsx -t "chip whitelist"`
Expected: 先红（若尚未接线）或绿。

- [ ] **Step 4: 提交**

```bash
git add src/pages/Chat/chat-composer-decoration.ts src/pages/Chat/ChatComposer.tsx tests/unit/chat-skill-picker.test.tsx
git commit -m "feat(chat): chip 仅对白名单内已启用技能命令渲染"
```

---

### Task 2: `ChatInput` 派生白名单并传入 `ChatComposer`

**Files:**
- Modify: `src/pages/Chat/ChatInput.tsx`

- [ ] **Step 1: 用 `useMemo` 从 `skills` 构建 `Set`**

```typescript
const slashChipCommandNames = useMemo(() => {
  const set = new Set<string>();
  for (const s of skills ?? []) {
    if (!s.enabled) continue;
    set.add(normalizeCommandName((s.slug ?? s.id) as string));
  }
  return set;
}, [skills]);
```

传给 `<ChatComposer slashChipCommandNames={slashChipCommandNames} ... />`。

- [ ] **Step 2: 运行 typecheck**

Run: `pnpm run typecheck`
Expected: 无错误。

- [ ] **Step 3: 提交**

```bash
git add src/pages/Chat/ChatInput.tsx
git commit -m "feat(chat): 将已启用技能命令集传入 composer 用于 chip 白名单"
```

---

### Task 3: `SkillPickerPopover` 受控搜索 + 聚焦 + 键盘

**Files:**
- Modify: `src/pages/Chat/SkillPickerPopover.tsx`

- [ ] **Step 1: 增加 props**

```typescript
export type SkillPickerPopoverProps = {
  open: boolean;
  skills: Skill[];
  onPick: (payload: { commandName: string; display: string }) => void;
  onOpenSkills: () => void;
  onClose: () => void;
  searchPlaceholder: string;
  skillsLibraryLabel: string;
  emptyEnabledLabel: string;
  noResultsLabel: string;
  /** 受控搜索；与 onSearchChange 同时提供时覆盖内部 state */
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
  /** 打开时聚焦搜索框（如图标或 slash 打开） */
  autoFocusSearch?: boolean;
};
```

当 `searchQuery !== undefined` 时，`input` 为受控：`value={searchQuery}`，`onChange` 调 `onSearchChange?.(e.target.value)`。

当未受控时保留现有内部 `useState('')`；`open` 从 false→true 时可选择清空内部 q（保持与现有一致）。

- [ ] **Step 2: `useRef<HTMLInputElement>(null)` + `useEffect`**

`useEffect(() => { if (open && autoFocusSearch) { requestAnimationFrame(() => inputRef.current?.focus()); } }, [open, autoFocusSearch]);`

- [ ] **Step 3: 在搜索 input 上处理键盘**

`onKeyDown`: `ArrowDown` / `ArrowUp` 更新 `highlightIndex`（内部 state，范围 `0..filtered.length-1`）；`Enter` `preventDefault`，若有 `filtered[highlightIndex]` 则 `onPick`。`Escape` 可 `stopPropagation` 并 `onClose()`（若父级已处理 Esc，避免双调；与 `ChatInput` 协调二选一：Popover 调 onClose 或仅父级处理）。

- [ ] **Step 4: Vitest 轻量测（可选）**

`SkillPickerPopover` 受控：`searchQuery="ab"` 时 input 显示 `ab`。

Run: `pnpm test -- tests/unit/chat-skill-picker.test.tsx`
Expected: 绿。

- [ ] **Step 5: 提交**

```bash
git add src/pages/Chat/SkillPickerPopover.tsx tests/unit/chat-skill-picker.test.tsx
git commit -m "feat(chat): SkillPickerPopover 支持受控搜索、聚焦与键盘选择"
```

---

### Task 4: `ChatInput` 统一 Slash 与图标 — 状态机与 composer 剥离

**Files:**
- Modify: `src/pages/Chat/ChatInput.tsx`
- Delete: `src/pages/Chat/ComposerSlashDropdown.tsx`

- [ ] **Step 1: 新增状态（示例命名，实现可微调）**

```typescript
type SlashFromComposerSession = { slashIndex: number };
const [skillPickerSearch, setSkillPickerSearch] = useState('');
const [slashSession, setSlashSession] = useState<SlashFromComposerSession | null>(null);
```

删除：`slashInline`、`slashHighlightIndex`、`slashAnchorRect`、`prevSlashSegmentRef`（若仍需要防重复 `fetchSkills` 可用 ref 记录上次 `slashIndex`）。

- [ ] **Step 2: 改写 `handleComposerChange`**

在 `!isComposingRef.current` 分支：

1. 调 `getSlashQueryAtCaret(plain, caret)`。
2. 若 `q !== null`：`void fetchSkills()`；`setSkillPickerOpen(true)`；`setSlashSession({ slashIndex: q.slashIndex })`；`setSkillPickerSearch(q.query)`。
3. **剥离**：若 `plain` 在 `[q.slashIndex + 1, caret)` 有字符需作为 query，则从 `plain` 构造 `stripped = plain.slice(0, q.slashIndex + 1) + plain.slice(caret)`，并 `setInput(stripped)`，然后 `composerRef.current?.setPlainTextAndSelection(stripped, { start: q.slashIndex + 1, end: q.slashIndex + 1 })`。注意：避免无限循环：仅在 `stripped !== plain` 时做程序化写回；或在同一 tick 用 ref 标记「本次为剥离」。

4. 若 `q === null`：若当前 `slashSession` 存在且用户已不在 slash 上下文，清除 `slashSession` 与 `skillPickerSearch`（按产品：光标移出 `/xxx` 区域时关闭会话，实现阶段与 `getSlashQueryAtCaret` 一致）。

- [ ] **Step 3: 图标按钮 `onClick`**

打开 picker 时：`setSlashSession(null)`，`setSkillPickerSearch('')`，`setSkillPickerOpen(toggle)`（与现有一致），并 `setPickerOpen(false)`。

- [ ] **Step 4: `SkillPickerPopover` 绑定**

```typescript
<SkillPickerPopover
  open={skillPickerOpen}
  skills={skills}
  searchQuery={skillPickerSearch}
  onSearchChange={setSkillPickerSearch}
  autoFocusSearch={skillPickerOpen}
  onPick={(payload) => {
    if (slashSession) {
      // 等价原 applyInlineSlashPick：在 slashSession.slashIndex 插入 ZWSP 包裹命令
      // 需合并 skillPickerSearch 清理与 slashSession 清空
    } else {
      applySkillPick(payload);
    }
  }}
  onClose={() => {
    setSkillPickerOpen(false);
    setSlashSession(null);
    setSkillPickerSearch('');
  }}
  ...
/>
```

将原 `applyInlineSlashPick` 逻辑内联到 `slashSession` 分支；`applySkillPick` 保持从光标插入。

- [ ] **Step 5: 删除 `ComposerSlashDropdown` 引用与 `useLayoutEffect`（slash 锚点）**

移除 `slashAnchorRect` 相关 effect。

- [ ] **Step 6: `handleKeyDown` 调整**

- 删除 `slashInline` 分支；`skillPickerOpen` 时若焦点在搜索框，Enter 由 Popover 处理；若焦点仍在 composer，Enter 应不发送（当 `skillPickerOpen` 时 `preventDefault` 并可选聚焦搜索或选第一项）——以父级统一：`if (skillPickerOpen) { /* 不 handleSend */ return` 需与 Popover 内 Enter 协调，避免双处理。

推荐：`ChatInput` 在 `skillPickerOpen && e.key === 'Enter' && !e.shiftKey` 时 `preventDefault()` 且不 `handleSend`；具体选中由 `SkillPickerPopover` 内 Enter 触发 `onPick`。

- [ ] **Step 7: 全局 mousedown**

替换原 `slashInline` 判断：若 `skillPickerOpen && !skillPickerRef.current?.contains(target)`，则 `setSkillPickerOpen(false)`、`setSlashSession(null)`、`setSkillPickerSearch('')`。**不再**依赖 `chat-skill-inline-picker`。

- [ ] **Step 8: 删除文件 `ComposerSlashDropdown.tsx`**

```bash
git rm src/pages/Chat/ComposerSlashDropdown.tsx
```

- [ ] **Step 9: 运行 `pnpm run typecheck` 与 `pnpm test`**

Expected: 全部通过；修复失败用例。

- [ ] **Step 10: 提交**

```bash
git add src/pages/Chat/ChatInput.tsx
git commit -m "feat(chat): / 与技能图标共用 SkillPickerPopover 并剥离 composer 查询"
```

---

### Task 5: E2E 与规格文档

**Files:**
- Modify: `tests/e2e/chat-skill-picker.spec.ts`
- Modify: `docs/superpowers/specs/2026-04-03-chat-skill-picker-design.md`

- [ ] **Step 1: 更新第三个用例**

将 `chat-skill-inline-*` 改为 `chat-skill-picker-popover`、`chat-skill-picker-search`；在 `/` 后可选断言搜索框可见并可输入（`fill` 搜索框）。

- [ ] **Step 2: 运行 E2E（本地）**

Run: `pnpm run test:e2e -- tests/e2e/chat-skill-picker.spec.ts`
Expected: 通过（或已知环境问题记录）。

- [ ] **Step 3: 更新 `2026-04-03` 文档 2～3 句**

说明 slash 不再使用内联 dropdown；chip 需匹配已启用技能命令名。

- [ ] **Step 4: 提交**

```bash
git add tests/e2e/chat-skill-picker.spec.ts docs/superpowers/specs/2026-04-03-chat-skill-picker-design.md
git commit -m "test(docs): 对齐 slash 技能面板 E2E 与规格说明"
```

---

## Spec 对照（自检）

| 规格章节 | 对应任务 |
|----------|----------|
| `/` 与图标同一 `SkillPickerPopover` | Task 4 |
| 搜索在面板、composer 仅保留 `/` | Task 3 + 4 `handleComposerChange` 剥离 |
| 取消保留 `/` | Task 4 `onClose` 不删 composer 中 `/` |
| 手动 `/cmd ` 匹配 enabled → chip；否则普通文本 | Task 1 + 2 |
| 移除 `ComposerSlashDropdown` | Task 4 |
| 测试 / E2E / 文档 | Task 1、5 |

**占位符扫描：** 无 TBD；实现时注意 `strip` 与 `onChange` 重入、IME `isComposing` 分支与现有 spec 一致。

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-07-chat-slash-skill-picker-unify.md`. Two execution options:

**1. Subagent-Driven (recommended)** — 每个任务单独开子代理，任务间人工 review，迭代快。

**2. Inline Execution** — 本会话用 executing-plans 按任务批量执行并设检查点。

**Which approach?**

（将计划纳入 git 时若 `docs/` 被忽略，需使用 `git add -f docs/superpowers/plans/2026-04-07-chat-slash-skill-picker-unify.md`。）
