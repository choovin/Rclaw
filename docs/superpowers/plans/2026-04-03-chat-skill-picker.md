# Chat 技能选择器（Slash Skill Picker）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `ChatInput` 中新增技能选择面板，并在输入框内以 overlay 方式将 `/${commandName}` 渲染为可删除的内联气泡，同时保持最终发送内容为 OpenClaw 可识别的纯文本命令。

**Architecture:** 维持现有 `Textarea` 作为真实输入源；新增一个 Popover 面板用于选择启用技能并按光标插入 `/${commandName} `；新增一个 overlay 镜像层按 token 解析结果渲染文本与 chip，并提供点击 X 删除 token 的精确字符串切片与 caret 更新。

**Tech Stack:** React 19 + TypeScript + Tailwind（现有组件体系）、Zustand（`useSkillsStore`）、Vitest（unit）、Playwright（Electron e2e）。

---

## File Structure（本计划会触达的文件）

**Create:**
- `e:/Code/Rclaw/src/pages/Chat/SkillPickerPopover.tsx`：技能面板 UI（搜索、列表、/skills 跳转、选择回调）。
- `e:/Code/Rclaw/src/pages/Chat/chat-skill-command.ts`：命令名规范化、token 解析、删除切片与 caret 计算（纯函数，便于单测）。
- `e:/Code/Rclaw/tests/unit/chat-skill-picker.test.tsx`：关键行为单测（插入、解析、删除、边界）。
- `e:/Code/Rclaw/tests/e2e/chat-skill-picker.spec.ts`：Electron E2E（打开面板、插入、chip 删除、发送值断言）。

**Modify:**
- `e:/Code/Rclaw/src/pages/Chat/ChatInput.tsx`：新增技能按钮 + 弹层、插入逻辑、overlay 渲染与删除交互、scroll 同步。
- `e:/Code/Rclaw/src/i18n/locales/zh/chat.json`：新增技能面板文案 keys。
- `e:/Code/Rclaw/src/i18n/locales/en/chat.json`：同上。
- `e:/Code/Rclaw/src/i18n/locales/ja/chat.json`：同上。

---

## Task 1: 新增技能命令工具函数（规范化 + token 解析 + 删除/光标规则）

**Files:**
- Create: `src/pages/Chat/chat-skill-command.ts`
- Test: `tests/unit/chat-skill-picker.test.tsx`（本任务先写纯函数单测部分）

- [ ] **Step 1: 写 failing unit tests（纯函数层）**

在 `tests/unit/chat-skill-picker.test.tsx` 里先写以下测试用例（先不引入 React 组件）：

```tsx
import { describe, expect, it } from 'vitest';
import {
  normalizeCommandName,
  parseSlashTokens,
  deleteTokenAtRange,
  insertAtSelection,
} from '@/pages/Chat/chat-skill-command';

describe('chat-skill-command', () => {
  it('normalizeCommandName: lowercases, replaces invalid chars with _, truncates 32', () => {
    expect(normalizeCommandName('Feishu')).toBe('feishu');
    expect(normalizeCommandName('tavily-search')).toBe('tavily_search');
    expect(normalizeCommandName('a'.repeat(40))).toBe('a'.repeat(32));
  });

  it('parseSlashTokens: recognizes token only with prefix boundary + suffix boundary (space/newline/EOF)', () => {
    expect(parseSlashTokens('/feishu ')).toMatchObject([{ startIndex: 0, endIndexExclusive: 7, text: '/feishu' }]);
    expect(parseSlashTokens('use /feishu ')).toHaveLength(1);
    expect(parseSlashTokens('http://a/b ')).toHaveLength(0);
    expect(parseSlashTokens('foo/bar ')).toHaveLength(0);
    expect(parseSlashTokens('/feishu,')).toHaveLength(0);
  });

  it('insertAtSelection: inserts at caret or replaces selection and returns next selection', () => {
    const r1 = insertAtSelection('hello world', { start: 6, end: 6 }, '/feishu ');
    expect(r1.nextValue).toBe('hello /feishu world');
    expect(r1.nextSelection).toEqual({ start: 14, end: 14 }); // after inserted text

    const r2 = insertAtSelection('hello world', { start: 0, end: 5 }, '/feishu ');
    expect(r2.nextValue).toBe('/feishu world');
    expect(r2.nextSelection).toEqual({ start: 8, end: 8 });
  });

  it('deleteTokenAtRange: deletes token and one trailing space only, updates selection deterministically', () => {
    const value = '/a /a test';
    const tokens = parseSlashTokens(value);
    expect(tokens).toHaveLength(2);
    // delete the second token
    const del = deleteTokenAtRange(value, { startIndex: tokens[1].startIndex, endIndexExclusive: tokens[1].endIndexExclusive }, { start: value.length, end: value.length });
    expect(del.nextValue).toBe('/a test');
    expect(del.nextSelection).toEqual({ start: tokens[1].startIndex, end: tokens[1].startIndex });
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

运行：

```bash
pnpm test tests/unit/chat-skill-picker.test.tsx -r
```

Expected：FAIL（因为 `chat-skill-command.ts` 尚未实现）。

- [ ] **Step 3: 实现 `chat-skill-command.ts`（最小实现让测试过）**

创建 `src/pages/Chat/chat-skill-command.ts`：

```ts
export type Selection = { start: number; end: number };
export type SlashToken = { startIndex: number; endIndexExclusive: number; text: string };

const MAX_CMD_LEN = 32;
const CMD_RE = /^[a-z0-9_]{1,32}$/;
const PREFIX_BOUNDARY = new Set([' ', '\n', '\r', '\t', '(', '[', '{', '"', "'"]);

export function normalizeCommandName(raw: string): string {
  const s = (raw ?? '').toLowerCase();
  const replaced = s.replace(/[^a-z0-9_]+/g, '_');
  const trimmed = replaced.slice(0, MAX_CMD_LEN);
  return trimmed;
}

function isPrefixBoundaryChar(ch: string | undefined): boolean {
  if (ch == null) return true; // start of string
  return PREFIX_BOUNDARY.has(ch);
}

function isSuffixBoundaryChar(ch: string | undefined): boolean {
  return ch == null || ch === ' ' || ch === '\n';
}

export function parseSlashTokens(value: string): SlashToken[] {
  const text = value ?? '';
  const tokens: SlashToken[] = [];
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== '/') continue;
    const prev = i === 0 ? undefined : text[i - 1];
    if (!isPrefixBoundaryChar(prev)) continue;
    let j = i + 1;
    while (j < text.length) {
      const ch = text[j]!;
      // stop when boundary reached
      if (ch === ' ' || ch === '\n' || ch === '\r' || ch === '\t') break;
      // Only allow a-z0-9_
      if (!/[a-z0-9_]/.test(ch)) {
        j = -1;
        break;
      }
      j++;
      if (j - (i + 1) > MAX_CMD_LEN) {
        j = -1;
        break;
      }
    }
    if (j === -1) continue;
    const cmd = text.slice(i + 1, j);
    if (!CMD_RE.test(cmd)) continue;
    const next = j < text.length ? text[j] : undefined;
    if (!isSuffixBoundaryChar(next)) continue;
    tokens.push({ startIndex: i, endIndexExclusive: j, text: text.slice(i, j) });
    i = j - 1; // continue after token
  }
  return tokens;
}

export function insertAtSelection(value: string, selection: Selection, insertText: string): { nextValue: string; nextSelection: Selection } {
  const v = value ?? '';
  const start = Math.max(0, Math.min(selection.start, v.length));
  const end = Math.max(0, Math.min(selection.end, v.length));
  const lo = Math.min(start, end);
  const hi = Math.max(start, end);
  const nextValue = v.slice(0, lo) + insertText + v.slice(hi);
  const caret = lo + insertText.length;
  return { nextValue, nextSelection: { start: caret, end: caret } };
}

export function deleteTokenAtRange(
  value: string,
  token: Pick<SlashToken, 'startIndex' | 'endIndexExclusive'>,
  selection: Selection,
): { nextValue: string; nextSelection: Selection } {
  const v = value ?? '';
  const startIndex = Math.max(0, Math.min(token.startIndex, v.length));
  const endIndexExclusive = Math.max(startIndex, Math.min(token.endIndexExclusive, v.length));
  const after = v.slice(endIndexExclusive);
  const dropSpace = after.startsWith(' ') ? 1 : 0;
  const nextValue = v.slice(0, startIndex) + after.slice(dropSpace);

  const removedLen = (endIndexExclusive - startIndex) + dropSpace;
  const selStart = Math.max(0, Math.min(selection.start, v.length));
  const selEnd = Math.max(0, Math.min(selection.end, v.length));
  const lo = Math.min(selStart, selEnd);
  const hi = Math.max(selStart, selEnd);

  let nextCaret = startIndex;
  if (lo >= endIndexExclusive + dropSpace) {
    nextCaret = lo - removedLen;
  } else if (hi <= startIndex) {
    nextCaret = lo;
  } else {
    nextCaret = startIndex;
  }
  nextCaret = Math.max(0, Math.min(nextCaret, nextValue.length));
  return { nextValue, nextSelection: { start: nextCaret, end: nextCaret } };
}
```

- [ ] **Step 4: 运行测试，确认通过**

```bash
pnpm test tests/unit/chat-skill-picker.test.tsx -r
```

Expected：PASS。

- [ ] **Step 5: Commit**

```bash
git add src/pages/Chat/chat-skill-command.ts tests/unit/chat-skill-picker.test.tsx
git commit -m "feat(chat): 增加技能命令解析与编辑工具函数" -m "提供 /slug 规范化、token 识别、按选区插入与按范围删除+光标更新，用于输入框内联 chip。"
```

---

## Task 2: 技能选择面板组件（Popover）

**Files:**
- Create: `src/pages/Chat/SkillPickerPopover.tsx`
- Modify: `src/i18n/locales/zh/chat.json`
- Modify: `src/i18n/locales/en/chat.json`
- Modify: `src/i18n/locales/ja/chat.json`
- Test: `tests/unit/chat-skill-picker.test.tsx`（新增组件层测试）

- [ ] **Step 1: 写 failing unit tests（组件层：展示 enabled 技能 + 搜索 + 点击回调）**

在 `tests/unit/chat-skill-picker.test.tsx` 追加：

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SkillPickerPopover } from '@/pages/Chat/SkillPickerPopover';

it('SkillPickerPopover: shows enabled skills, filters by search, calls onPick with commandName', async () => {
  const user = userEvent.setup();
  const onPick = vi.fn();
  const onOpenSkills = vi.fn();

  render(
    <SkillPickerPopover
      open
      skills={[
        { id: 'feishu', slug: 'feishu', name: 'Feishu', description: 'desc', enabled: true, icon: '⚙️' },
        { id: 'tavily-search', slug: 'tavily-search', name: 'Tavily', description: 'search', enabled: true, icon: '⚡' },
        { id: 'disabled', slug: 'disabled', name: 'Disabled', description: 'x', enabled: false, icon: '❌' },
      ]}
      onPick={onPick}
      onOpenSkills={onOpenSkills}
      onClose={() => {}}
      searchPlaceholder="搜索技能"
      skillsLibraryLabel="技能库"
      emptyEnabledLabel="暂无可用技能"
      noResultsLabel="未找到技能"
    />
  );

  // disabled skill should not show
  expect(screen.queryByText('/disabled')).toBeNull();
  expect(screen.getByText('/feishu')).toBeInTheDocument();

  await user.type(screen.getByPlaceholderText('搜索技能'), 'tavily');
  expect(screen.queryByText('/feishu')).toBeNull();
  expect(screen.getByText('/tavily_search')).toBeInTheDocument(); // normalized

  await user.click(screen.getByText('/tavily_search'));
  expect(onPick).toHaveBeenCalledWith({ commandName: 'tavily_search', display: '/tavily_search' });

  await user.click(screen.getByText('技能库'));
  expect(onOpenSkills).toHaveBeenCalled();
});
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
pnpm test tests/unit/chat-skill-picker.test.tsx -r
```

- [ ] **Step 3: 实现 `SkillPickerPopover.tsx`**

实现要点：
- props 由上层传入 `skills`（来自 `useSkillsStore().skills`），组件内部只过滤 `enabled: true`。
- 点击条目回调 `onPick({ commandName, display })`；display 用 `/` 前缀。
- 使用 `normalizeCommandName` 生成 commandName。
- UI 样式对齐现有 `ChatInput` 弹层（可复用与 `@Agent` picker 相近的 Tailwind）。

最小实现示例（不要求完全一致，但必须可测）：

```tsx
import { useMemo, useState } from 'react';
import type { Skill } from '@/types/skill';
import { normalizeCommandName } from './chat-skill-command';
import { cn } from '@/lib/utils';

export function SkillPickerPopover(props: {
  open: boolean;
  skills: Skill[];
  onPick: (payload: { commandName: string; display: string }) => void;
  onOpenSkills: () => void;
  onClose: () => void;
  searchPlaceholder: string;
  skillsLibraryLabel: string;
  emptyEnabledLabel: string;
  noResultsLabel: string;
}) {
  const [q, setQ] = useState('');
  const enabled = useMemo(() => props.skills.filter(s => s.enabled), [props.skills]);
  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return enabled;
    return enabled.filter(s =>
      (s.name || '').toLowerCase().includes(query)
      || (s.slug || s.id).toLowerCase().includes(query)
      || (s.description || '').toLowerCase().includes(query)
    );
  }, [enabled, q]);

  if (!props.open) return null;

  return (
    <div className="absolute left-0 bottom-full z-30 mb-2.5 w-96 overflow-hidden rounded-2xl border border-border/60 bg-card shadow-lg">
      <div className="p-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={props.searchPlaceholder}
          className="h-10 w-full rounded-xl border border-border/60 bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
        />
      </div>
      <div className="max-h-72 overflow-y-auto p-2 pt-0">
        {enabled.length === 0 ? (
          <div className="px-3 py-3 text-sm text-muted-foreground">{props.emptyEnabledLabel}</div>
        ) : filtered.length === 0 ? (
          <div className="px-3 py-3 text-sm text-muted-foreground">{props.noResultsLabel}</div>
        ) : (
          <div className="space-y-1">
            {filtered.map((s) => {
              const raw = (s.slug ?? s.id) as string;
              const cmd = normalizeCommandName(raw);
              const display = `/${cmd}`;
              return (
                <button
                  key={s.id}
                  type="button"
                  className={cn('w-full rounded-xl px-3 py-2 text-left hover:bg-secondary/60 transition-colors')}
                  onClick={() => props.onPick({ commandName: cmd, display })}
                >
                  <div className="flex items-start gap-2">
                    <div className="mt-0.5 w-6 shrink-0 text-center">{s.icon ?? '✨'}</div>
                    <div className="min-w-0">
                      <div className="font-mono text-[13px] font-semibold text-foreground">{display}</div>
                      <div className="text-[12px] text-muted-foreground line-clamp-2">{s.description}</div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
      <button
        type="button"
        className="w-full border-t border-border/60 px-3 py-2 text-left text-sm text-foreground/70 hover:bg-secondary/50"
        onClick={props.onOpenSkills}
      >
        {props.skillsLibraryLabel}
      </button>
    </div>
  );
}
```

- [ ] **Step 4: 补齐 i18n keys（zh/en/ja）**

在 `chat.json` 的 `composer` 下新增：

```json
{
  "skillPicker": {
    "open": "选择技能",
    "searchPlaceholder": "搜索技能",
    "skillsLibrary": "技能库",
    "emptyEnabled": "暂无可用技能（请先在技能库启用）",
    "noResults": "未找到技能"
  }
}
```

英文/日文分别翻译为自然表达（保持 keys 相同）。

- [ ] **Step 5: 运行 unit tests**

```bash
pnpm test tests/unit/chat-skill-picker.test.tsx -r
```

- [ ] **Step 6: Commit**

```bash
git add src/pages/Chat/SkillPickerPopover.tsx src/i18n/locales/zh/chat.json src/i18n/locales/en/chat.json src/i18n/locales/ja/chat.json tests/unit/chat-skill-picker.test.tsx
git commit -m "feat(chat): 增加技能选择面板与多语言文案" -m "新增搜索+启用技能列表的 popover，并提供跳转技能库入口。"
```

---

## Task 3: 集成到 `ChatInput`（按钮 + 插入 + overlay chip 渲染）

**Files:**
- Modify: `src/pages/Chat/ChatInput.tsx`
- Test: `tests/unit/chat-skill-picker.test.tsx`

- [ ] **Step 1: 写 failing unit tests（集成层：点击插入到光标位置）**

在 `tests/unit/chat-skill-picker.test.tsx` 增加一个轻量集成测试（通过直接渲染 `ChatInput`，用最小 props）：

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { ChatInput } from '@/pages/Chat/ChatInput';

it('ChatInput: picking skill inserts /cmd at caret and closes popover', async () => {
  const user = userEvent.setup();
  const onSend = vi.fn();

  render(<ChatInput onSend={onSend} disabled={false} sending={false} isEmpty />);
  const textarea = screen.getByRole('textbox');

  await user.type(textarea, 'hello world');
  // move caret between hello and world
  (textarea as HTMLTextAreaElement).setSelectionRange(6, 6);

  // open skill picker (button needs aria-label/title)
  await user.click(screen.getByTitle('选择技能'));
  await user.click(screen.getByText('/feishu'));

  expect((textarea as HTMLTextAreaElement).value).toContain('hello /feishu world');
});
```

说明：为让测试可写，`ChatInput` 的技能按钮需要 `title={t('composer.skillPicker.open')}` 或 `aria-label`。

- [ ] **Step 2: 运行测试，确认失败**

```bash
pnpm test tests/unit/chat-skill-picker.test.tsx -r
```

- [ ] **Step 3: 修改 `ChatInput.tsx`，加入技能按钮与 popover 状态**

实现要点：
- `useSkillsStore`：取 `skills` 与 `fetchSkills`（打开时拉取）。
- 新增 state：`skillPickerOpen`、`skillPickerQuery`（query 可放组件内）。
- 在工具按钮行增加按钮（放回形针与 @ 之间）。
- 复用现有的“点击外部关闭”逻辑：可以复用 `pickerRef` 思路，或为技能面板新增 `skillPickerRef` + document mousedown handler。
- 点击技能项时：
  - 读取 `textarea.selectionStart/End`（如果不存在则 fallback 到末尾）。
  - 调用 `insertAtSelection(input, {start, end}, `/${commandName} `)`
  - `setInput(nextValue)`，并在 `requestAnimationFrame` 中对 textarea `setSelectionRange(nextCaret, nextCaret)`。
  - `setSkillPickerOpen(false)`，`textarea.focus()`

- [ ] **Step 4: overlay 镜像渲染（文本 + chip）**

在 `ChatInput` 的 textarea 容器内增加：
- 一个 overlay `div`（absolute inset-0，padding 与 textarea 一致，`white-space: pre-wrap` 等同）。
- `Textarea` 本体文字设为透明但保留 caret：
  - `className` 增加类似：`text-transparent caret-foreground`（按项目 Tailwind token 调整）
- 解析 token：
  - 在 render 里 `const tokens = useMemo(() => parseSlashTokens(input), [input])`
  - 将 input 切成片段：普通文本片段与 token 片段（token 片段渲染为 chip）
- chip 渲染：
  - 默认 `pointer-events: auto`；其余 overlay 容器 `pointer-events: none`
  - hover 显示 X（通过 group-hover + opacity）
  - composing 时（`isComposingRef.current === true`）隐藏/禁用 X（并让 onClick no-op）
- 删除：点击 X 调用 `deleteTokenAtRange`，更新 input 与 selection，并聚焦 textarea。

- [ ] **Step 5: scroll 同步**

当 textarea 出现滚动时：
- 在 `onScroll` 事件中，把 `overlayRef.current.scrollTop/Left` 同步到 textarea 的 scrollTop/Left（或反向：overlay 使用 transform translateY，按实现选一种，但必须一致）。
- 处理 resize/高度变化：在 input 改变导致 auto-resize 时，overlay 的高度跟随容器（一般 absolute inset-0 + padding 可以天然跟随，但仍需验证换行点一致）。

- [ ] **Step 6: 运行 unit tests**

```bash
pnpm test tests/unit/chat-skill-picker.test.tsx -r
```

- [ ] **Step 7: 手动冒烟（本地）**

运行：

```bash
pnpm dev
```

手动检查：
- 打开 Chat，点技能按钮弹出面板；搜索过滤正常。
- 点击技能插入到光标位置，并显示为 chip。
- hover chip 出现 X，点击删除 token + 1 空格。
- IME 中文输入时（composing），X 不显示/不可点。
- 多行输入触发滚动后，chip 不漂移。

- [ ] **Step 8: Commit**

```bash
git add src/pages/Chat/ChatInput.tsx tests/unit/chat-skill-picker.test.tsx
git commit -m "feat(chat): 集成技能选择与输入框内联 chip" -m "在 ChatInput 增加技能面板与 /slug 插入；使用 overlay 镜像层将命令渲染为可删除气泡并保持 textarea 行为。"
```

---

## Task 4: Electron E2E（Playwright）

**Files:**
- Create: `tests/e2e/chat-skill-picker.spec.ts`

- [ ] **Step 1: 写 E2E（先失败）**

新增 `tests/e2e/chat-skill-picker.spec.ts`（按仓库现有 E2E 结构写；这里给出最小骨架，具体 selector 需按页面实际 data-testid/title 调整）：

```ts
import { test, expect } from '@playwright/test';

test('chat: skill picker inserts and chip can remove', async ({ page }) => {
  await page.goto('http://localhost:5173/#/chat'); // 按项目路由调整

  const textarea = page.getByRole('textbox');
  await textarea.click();
  await textarea.fill('hello world');
  // 将光标移动到中间：Playwright 对 textarea selection 需要 evaluate
  await page.evaluate(() => {
    const el = document.querySelector('textarea') as HTMLTextAreaElement | null;
    if (el) el.setSelectionRange(6, 6);
  });

  await page.getByTitle('选择技能').click();
  await page.getByText('/feishu').click();

  await expect(textarea).toHaveValue(/hello \/feishu world/);

  // 点击 chip 的 X
  await page.getByText('/feishu').hover();
  await page.getByRole('button', { name: 'remove-skill-token' }).click(); // 实现时给 X 加 aria-label
  await expect(textarea).toHaveValue('hello world');
});
```

- [ ] **Step 2: 运行 E2E，修复 selector/等待条件直到通过**

```bash
pnpm run test:e2e -- tests/e2e/chat-skill-picker.spec.ts
```

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/chat-skill-picker.spec.ts
git commit -m "test(e2e): 覆盖 Chat 技能选择与 chip 删除" -m "新增 Playwright 用例验证插入 /slug、overlay chip 与删除同步 textarea 值。"
```

---

## Task 5: 计划自检（Self-Review）

- [ ] **Step 1: Spec 覆盖检查**
  - 对照 `docs/superpowers/specs/2026-04-03-chat-skill-picker-design.md`，逐条确认：
    - 只显示 enabled skills
    - 前置/后置边界
    - 删除只删 token + 1 空格
    - composing 禁用删除
    - /skills 跳转入口
    - scroll 同步与尺寸同步

- [ ] **Step 2: Placeholder 扫描**
  - 全局搜索计划实现中是否仍有“实现阶段决定”之类悬空口径；保证最终代码与 spec 一致。

---

## Plan complete — 执行交接

计划完成并保存到 `docs/superpowers/plans/2026-04-03-chat-skill-picker.md`。两种执行方式：

1. **Subagent-Driven（推荐）**：我按 Task 逐个派发子代理实现，每个任务完成后我复审再进入下一个任务。
2. **Inline Execution**：在本会话中按计划逐步实现（更连续，但一次上下文更重）。

你选哪一种？回复 `1` 或 `2`。

