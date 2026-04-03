# Chat 轻量 contenteditable Composer 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用受控 `contenteditable` 替换 `ChatInput` 中透明 `textarea` + 镜像 overlay，保持纯文本发送契约与 slash chip 行为；为后续 `/`、 `@` 内联下拉打好单一编辑表面基础。

**Architecture:** React 状态保存**规范化的纯文本字符串**为唯一真相；`contenteditable` 仅作视图。每次内容变化后根据 `parseSlashTokens`（`chat-skill-command.ts`）将「完整 token」区间渲染为 `contenteditable="false"` 的 chip 节点，其余为文本节点；用文本偏移量保存/恢复选区。粘贴仅 `text/plain`；可选 `plaintext-only` + `beforeinput` 兜底。后续下拉使用 `Range.getBoundingClientRect` 或 `@floating-ui/dom` 锚定光标。

**Tech Stack:** React 19、现有 Vitest/RTL、Playwright E2E；可选依赖 `@floating-ui/dom`（仅 Phase 2/3 下拉定位，Phase 1 可不装）。

**权威设计：** [`docs/superpowers/specs/2026-04-03-chat-composer-contenteditable-design.md`](../specs/2026-04-03-chat-composer-contenteditable-design.md)

---

## 文件结构（创建 / 修改）

| 文件 | 职责 |
|------|------|
| **新建** `src/pages/Chat/chat-composer-plaintext.ts` | 从 composer 根元素读取/规范化纯文本；文本偏移 ↔ `Selection` 映射（遍历文本节点累加长度）；与 `chat-skill-command` 的 `Selection` 类型配合（勿与 DOM `Selection` 混淆）。 |
| **新建** `src/pages/Chat/chat-composer-decoration.ts` | 根据 `plainText` + `parseSlashTokens` 生成 `DocumentFragment`（或指令列表），含 chip DOM 结构（与现有 `data-testid="chat-skill-chip"` 等一致）。 |
| **新建** `src/pages/Chat/ChatComposer.tsx` | `contenteditable` 宿主、IME 标记、粘贴处理、`onPlainTextChange` / `onSend` 所需回调；对外暴露 `getPlainText()`、`focus()`、插入技能命令时设置文本与选区（供 `applySkillPick` 使用）。 |
| **修改** `src/pages/Chat/ChatInput.tsx` | 移除 overlay、`Textarea`；接入 `ChatComposer`；保留附件条、技能按钮、`SkillPickerPopover`、`@` 工具栏与 `targetAgentId` 逻辑至 Phase 3 再收敛。 |
| **修改** `tests/unit/chat-input.test.tsx` | 断言改为对 `role="textbox"` 的 contenteditable（`textContent`/`innerText` 而非 `textarea.value`，必要时 `contentEditable` 断言）。 |
| **修改** `tests/e2e/chat-skill-picker.spec.ts` | 不再依赖 `document.querySelector('textarea')`；用 `getByRole('textbox')` 或 `data-testid` 设置选区与读取内容。 |
| **新建** `tests/unit/chat-composer-plaintext.test.ts`（或合并到现有文件） | 纯函数与 JSDOM 下选区偏移单测。 |
| **Phase 2** `src/pages/Chat/ComposerSlashDropdown.tsx`（名称可微调） | `/` 查询态 UI + 键盘导航；数据源 `useSkillsStore`。 |
| **Phase 3** `src/pages/Chat/ComposerMentionDropdown.tsx` | `@` 查询态 UI；**数据源待产品确认**（见 spec），实现前在代码或注释中钉死格式。 |

---

## Phase 1：contenteditable 核心 + chip（必做）

### Task 1: `chat-composer-plaintext` 纯函数与单测

**Files:**
- Create: `src/pages/Chat/chat-composer-plaintext.ts`
- Create: `tests/unit/chat-composer-plaintext.test.ts`

- [ ] **Step 1: 编写失败单测（序列化）**

```ts
import { describe, expect, it } from 'vitest';
import { normalizeComposerPlainText } from '@/pages/Chat/chat-composer-plaintext';

describe('normalizeComposerPlainText', () => {
  it('normalizes CRLF to internal convention consistent with slash token tests', () => {
    expect(normalizeComposerPlainText('a\r\nb')).toBeDefined();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm exec vitest run tests/unit/chat-composer-plaintext.test.ts`
Expected: 模块或导出不存在导致 FAIL

- [ ] **Step 3: 实现最小 API**

实现 `normalizeComposerPlainText(s: string): string`（与 `chat-skill-command` / 历史 `textarea` 行为一致，可对照 `parseSlashTokens` 单测里的 `\r\n` 用例）；预留 `getPlainTextFromRoot(el: HTMLElement): string`（`innerText` + 同一规范化）。

- [ ] **Step 4: 测试通过**

Run: `pnpm exec vitest run tests/unit/chat-composer-plaintext.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/pages/Chat/chat-composer-plaintext.ts tests/unit/chat-composer-plaintext.test.ts
git commit -m "feat(chat): 添加 composer 纯文本规范化与单测"
```

---

### Task 2: 文本偏移 ↔ Selection 映射（JSDOM）

**Files:**
- Modify: `src/pages/Chat/chat-composer-plaintext.ts`
- Modify: `tests/unit/chat-composer-plaintext.test.ts`

- [ ] **Step 1: 单测——设根元素纯文本后 `setSelectionFromOffsets` / `getOffsetsFromSelection` 往返**

使用 `document.createElement('div')` + 若干文本/子节点结构（与 decoration 输出一致时再收紧用例）。

- [ ] **Step 2: 实现 `getOffsetsFromSelection(root)`、`setSelectionFromOffsets(root, start, end)`**

仅针对 composer 根节点内文本节点树；处理空选区与折叠 caret。

- [ ] **Step 3: `pnpm exec vitest run tests/unit/chat-composer-plaintext.test.ts` → PASS**

- [ ] **Step 4: Commit**

---

### Task 3: `chat-composer-decoration` 构建 chip DOM

**Files:**
- Create: `src/pages/Chat/chat-composer-decoration.ts`
- Modify: `tests/unit/chat-composer-plaintext.test.ts` 或新建 `tests/unit/chat-composer-decoration.test.ts`

- [ ] **Step 1: 单测：给定 `plainText`，fragment 序列化后与预期 chip 数量一致**

对 `'/feishu '` 应产生可序列化为含 `/feishu` 的结构；chip 带 `data-testid="chat-skill-chip"`。

- [ ] **Step 2: 实现 `buildComposerBody(plainText): DocumentFragment`**

调用 `parseSlashTokens`，完整 token 段用 `contenteditable="false"` 的 span 包裹并含删除按钮占位（结构与现 `ChatInput` 对齐，减少 UI 抖动）。

- [ ] **Step 3: Vitest PASS → Commit**

---

### Task 4: `ChatComposer` 组件（输入、粘贴、IME、装饰同步）

**Files:**
- Create: `src/pages/Chat/ChatComposer.tsx`
- Modify: `src/pages/Chat/ChatInput.tsx`（先并行接入或临时 story 页——若项目无 story，则直接在 `ChatInput` 替换）

- [ ] **Step 1: `ChatComposer` props 草案**

`value: string`、`onChange: (next: string) => void`、`disabled`、`placeholder`、`onKeyDown`（透传 Enter 逻辑）、`ref` 暴露 `insertAtCaret(text: string)`（内部用 `insertAtSelection` + decoration）。

- [ ] **Step 2: `onInput`：** 读 `getPlainTextFromRoot` → `onChange`；**composition** 期间不执行 decoration 重建（或仅更新纯文本不拆 chip，按 spec 取更安全策略）。

- [ ] **Step 3: `useLayoutEffect`：** `plainText` 与 DOM 不一致时 `replaceChildren(buildComposerBody(plainText))`，随后 **用偏移恢复选区**（删除/输入后长度变化需按 `deleteTokenAtRange` 语义在调用方处理时同步）。

**注意：** 首次实现可采用「每次 `onInput` 全量重建 fragment + 恢复 caret」；若性能或 IME 有问题，再优化为仅增量。

- [ ] **Step 4: `paste`：** `preventDefault` + `insertText`（或 `execCommand('insertText')` 已废弃则 Range API）仅插入纯文本。

- [ ] **Step 5: RTL 单测（可选）：** mock 用户输入，断言 `onChange` 字符串。

- [ ] **Step 6: `pnpm run typecheck` && `pnpm test`**

- [ ] **Step 7: Commit**

---

### Task 5: `ChatInput` 接入并删除 overlay

**Files:**
- Modify: `src/pages/Chat/ChatInput.tsx`

- [ ] **Step 1:** 移除 `Textarea`、`overlayInnerRef`、`buildSlashMirrorParts`、透明文字样式、`handleTextareaScroll`。

- [ ] **Step 2:** 用 `ChatComposer` 绑定 `input` state；`applySkillPick` 调用 composer ref 插入 `/${commandName} ` 并聚焦。

- [ ] **Step 3:** `removeSlashToken`：对当前 `input` 调 `deleteTokenAtRange`，写回 composer。

- [ ] **Step 4:** `handleSend` 仍 `onSend(textToSend, ...)`；高度限制改为 composer 容器 `max-height` + `overflow-y: auto`（与原先 200px 一致）。

- [ ] **Step 5:** `pnpm run lint` && `pnpm test` && `pnpm run typecheck`

- [ ] **Step 6: Commit**（中文信息：替换 Chat 输入为 contenteditable composer，移除镜像 overlay）

---

### Task 6: 更新单元测试 `chat-input` / `chat-skill-picker`

**Files:**
- Modify: `tests/unit/chat-input.test.tsx`
- Modify: `tests/unit/chat-skill-picker.test.tsx`（若引用 `textarea`）

- [ ] **Step 1:** `getByRole('textbox')` 获取 composer；断言文本用 `textContent` 或辅助函数。

- [ ] **Step 2:** `setSelectionRange` 改为对 `window.getSelection()` + Range（或暴露测试用 `data-testid` 仅 dev——**优先**真实 DOM API）。

- [ ] **Step 3:** `pnpm test` PASS

- [ ] **Step 4: Commit**

---

### Task 7: E2E 更新（AGENTS.md 要求）

**Files:**
- Modify: `tests/e2e/chat-skill-picker.spec.ts`

- [ ] **Step 1:** 删除 `document.querySelector('textarea')`；用 Playwright 的 `evaluate` 对 `[contenteditable="true"]` 或 `role=textbox` 设置 caret（按实现选型）。

- [ ] **Step 2:** `toHaveValue` 改为对 textbox 的文本断言（`expect(locator).toHaveText(...)` 或 `inputValue` 若适用）。

- [ ] **Step 3:** `pnpm run test:e2e` 中相关用例（或全量若 CI 一致）

- [ ] **Step 4: Commit**

---

## Phase 2：`/` 技能内联下拉（spec 规划中）

### Task 8: 触发检测 + 浮动层

**Files:**
- Create: `src/pages/Chat/ComposerSlashDropdown.tsx`（或内联于 `ChatComposer` 直至变胖再拆）
- Modify: `package.json`（若新增 `@floating-ui/dom`）

- [ ] **Step 1:** 在纯文本与光标偏移上检测「`/...` 查询态」（边界与 `parseSlashTokens` / 未完成 token 区分，避免与 URL 冲突）。

- [ ] **Step 2:** `pnpm add @floating-ui/dom`（若团队同意零依赖，则用自算坐标 + `fixed` 定位）。

- [ ] **Step 3:** 列表过滤 `enabled` skills；`Enter` 选中插入并关闭；`Esc` 关闭。

- [ ] **Step 4:** 单元或 E2E 冒烟；**Commit**

---

## Phase 3：`@` 员工下拉（数据源确认后）

### Task 9: Mention 触发 + 列表

- [ ] **Step 1:** 产品确认：`@` 列表数据源与插入格式（如 `@AgentName ` 是否同步 `targetAgentId`）。

- [ ] **Step 2:** 实现 `ComposerMentionDropdown` + 与 `ChatInput` 路由状态联动（按确认结果）。

- [ ] **Step 3:** i18n、E2E 冒烟；**Commit**

---

## 验证命令（整体验收）

```bash
pnpm run lint
pnpm run typecheck
pnpm test
pnpm run test:e2e
```

**Comms：** 本改动若不触及 `AGENTS.md` 所列 gateway 发送/接收路径，通常无需 `comms:replay`；若误改 runtime 消息体格式再跑。

---

## Plan 审阅与执行方式

Plan 已保存至 `docs/superpowers/plans/2026-04-03-chat-composer-contenteditable.md`。

**执行选项：**

1. **Subagent-Driven（推荐）** — 每任务派生子代理，任务间 review，迭代快  
2. **Inline Execution** — 本会话用 executing-plans 按任务执行并设检查点  

请选择 **1** 或 **2**（或由负责人直接按 checkbox 自行实现）。
