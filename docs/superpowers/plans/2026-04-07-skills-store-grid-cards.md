# Skills Store Grid Cards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将技能商店（已安装技能列表）改为每行最多 3 个的卡片栅格，并新增卡片级「立即使用/删除」交互：立即使用跳转 Chat 并预填 `/<command>`；内置技能删除按钮 hover 提示「不能删除内置技能」；列表末尾显示「没有更多了」。

**Architecture:** 在 `Skills` 页将列表视图替换为 `grid` 卡片组件；通过 `react-router` 的 `navigate(..., { state })` 传递一次性预填命令到 Chat；在 Chat 侧消费该 state 并复用既有的插入/ZWSP/chip 规则写入 `ChatComposer`。

**Tech Stack:** Electron + React 19 + Vite + TypeScript、Tailwind（现有 className 风格）、react-router、Playwright E2E（`tests/e2e`）。

---

## File map（将要改动/新增的文件）

**Modify:**
- `src/pages/Skills/index.tsx`: 已安装技能列表改为卡片栅格；新增立即使用/删除按钮；新增末尾「没有更多了」。
- `src/pages/Chat/index.tsx`: 读取路由 state 并将一次性预填命令下发到 `ChatInput`（新增 prop）。
- `src/pages/Chat/ChatInput.tsx`: 接收 `prefillSkillCommand`，在首次渲染后将命令插入 composer，聚焦；插入后回调通知上层“已消费”以清除 state。
- `src/i18n/locales/zh/skills.json`: 新增 `card.useNow` / `card.noMore` / `card.cantDeleteBundled`。
- `src/i18n/locales/en/skills.json`: 同上（英文）。
- `src/i18n/locales/ja/skills.json`: 同上（日文）。
- `tests/e2e/*.spec.ts`: 新增或扩展 E2E 覆盖 Skills 卡片与立即使用预填（推荐新文件，避免耦合现有 chat spec）。

**Create:**
- `tests/e2e/skills-store-grid-cards.spec.ts`: E2E：卡片栅格、内置技能删除 tooltip、立即使用预填并聚焦。

---

### Task 1: Add i18n strings for card UI

**Files:**
- Modify: `src/i18n/locales/zh/skills.json`
- Modify: `src/i18n/locales/en/skills.json`
- Modify: `src/i18n/locales/ja/skills.json`

- [ ] **Step 1: Update zh strings**

在 `src/i18n/locales/zh/skills.json` 顶层新增（或放入合适分组）：

```json
{
  "card": {
    "useNow": "立即使用",
    "noMore": "没有更多了",
    "cantDeleteBundled": "不能删除内置技能"
  }
}
```

- [ ] **Step 2: Update en strings**

在 `src/i18n/locales/en/skills.json` 新增：

```json
{
  "card": {
    "useNow": "Use now",
    "noMore": "No more",
    "cantDeleteBundled": "Built-in skills can’t be deleted"
  }
}
```

- [ ] **Step 3: Update ja strings**

在 `src/i18n/locales/ja/skills.json` 新增：

```json
{
  "card": {
    "useNow": "今すぐ使う",
    "noMore": "これ以上ありません",
    "cantDeleteBundled": "内蔵スキルは削除できません"
  }
}
```

- [ ] **Step 4: Run typecheck quickly**

Run:

```bash
pnpm run typecheck
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/i18n/locales/zh/skills.json src/i18n/locales/en/skills.json src/i18n/locales/ja/skills.json
git commit -m "i18n: 技能卡片文案"
```

---

### Task 2: Convert installed skills list to grid cards (max 3 per row)

**Files:**
- Modify: `src/pages/Skills/index.tsx`

- [ ] **Step 1: Add stable test ids**

在 Skills 页根节点增加 `data-testid="skills-page"`（若已存在则复用），并为卡片与关键操作加 testid：

- 卡片：`data-testid="skills-card"`
- 立即使用：`data-testid="skills-card-use-now"`
- 删除：`data-testid="skills-card-delete"`
- 内置删除 tooltip：`data-testid="skills-card-delete-tooltip"`
- 末尾文案：`data-testid="skills-card-no-more"`

- [ ] **Step 2: Replace list container with grid**

将原本：

- 容器：`<div className="flex flex-col gap-1">`
- 列表项：`filteredSkills.map(...)` 的行布局

替换为：

```tsx
<div
  className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3"
  data-testid="skills-grid"
>
  {filteredSkills.map((skill) => (
    <div
      key={skill.id}
      data-testid="skills-card"
      className="group rounded-2xl border border-black/10 dark:border-white/10 bg-transparent hover:bg-black/5 dark:hover:bg-white/5 transition-colors p-4"
      onClick={() => setSelectedSkill(skill)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') setSelectedSkill(skill);
      }}
    >
      {/* header */}
      {/* description */}
      {/* actions */}
    </div>
  ))}
</div>
```

要点：
- 保持现有“点击卡片打开详情抽屉”的行为（onClick）。
- 操作区内部需要 `onClick={e => e.stopPropagation()}`（与现有 Switch 一致），避免点按钮触发打开详情。

- [ ] **Step 3: Add card actions (Use now / Switch / Trash)**

在卡片底部操作区新增：

1) **立即使用**（主按钮）：
- 文案：`t('card.useNow')`
- 点击：调用 `navigate('/', { state: { prefillSkillCommand: `/${normalizeCommandName(skill.slug ?? skill.id)}` } })`

2) **Switch**：
- 保持现有 `handleToggle(skill.id, checked)`
- `disabled={skill.isCore}`

3) **删除 Trash**：
- 仅当 `!skill.isBundled && !skill.isCore && !!skill.slug` 时显示可点击按钮：`onClick={() => handleUninstall(skill.slug!)}`
- 当 `skill.isBundled` 时显示 disabled 按钮并提供 tooltip：

实现 tooltip 的最小可测方式（不引入新依赖）：

```tsx
<div className="relative">
  <Button
    type="button"
    variant="destructive"
    size="icon"
    disabled
    data-testid="skills-card-delete"
    className="h-8 w-8 shadow-none"
  >
    <Trash2 className="h-4 w-4" />
  </Button>
  <div
    data-testid="skills-card-delete-tooltip"
    className="pointer-events-none absolute -top-9 right-0 hidden group-hover:block rounded-md border border-black/10 dark:border-white/10 bg-card px-2 py-1 text-[12px] text-foreground/80 shadow"
  >
    {t('card.cantDeleteBundled')}
  </div>
</div>
```

注意：tooltip 的显示触发应绑定到更细粒度的 hover（例如删除按钮包一层 `group/delete`），避免整卡 hover 就出现 tooltip；实现时推荐：
- 删除按钮外层使用 `group/delete`
- tooltip 使用 `group-hover/delete:block`

- [ ] **Step 4: Add “No more” footer**

在 grid 之后追加：

```tsx
{filteredSkills.length > 0 && (
  <div className="py-8 text-center text-sm text-muted-foreground" data-testid="skills-card-no-more">
    {t('card.noMore')}
  </div>
)}
```

- [ ] **Step 5: Run lint + typecheck**

Run:

```bash
pnpm run lint
pnpm run typecheck
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/pages/Skills/index.tsx
git commit -m "feat: 技能商店卡片栅格展示"
```

---

### Task 3: Wire “Use now” route state into Chat and prefill composer (one-shot)

**Files:**
- Modify: `src/pages/Chat/index.tsx`
- Modify: `src/pages/Chat/ChatInput.tsx`

- [ ] **Step 1: Define a typed route state**

在 `src/pages/Chat/index.tsx`（或同目录新建轻量类型文件也可，但本任务保持最小改动），定义：

```ts
type ChatRouteState = {
  prefillSkillCommand?: string;
};
```

- [ ] **Step 2: Read `location.state` and pass to ChatInput**

在 Chat 组件里：
- `const location = useLocation();`
- `const routeState = (location.state ?? null) as ChatRouteState | null;`
- 提取 `const prefillSkillCommand = routeState?.prefillSkillCommand;`
- 渲染 `ChatInput` 时新增 prop：`prefillSkillCommand={prefillSkillCommand}`
- 同时传递一个回调让 `ChatInput` 消费后通知上层清 state：

```tsx
const navigate = useNavigate();
const clearPrefillState = useCallback(() => {
  navigate(location.pathname, { replace: true, state: null });
}, [navigate, location.pathname]);
```

并把 `onPrefillConsumed={clearPrefillState}` 传下去。

- [ ] **Step 3: Implement prefill in `ChatInput`**

在 `src/pages/Chat/ChatInput.tsx` 的 props 增加：

```ts
prefillSkillCommand?: string;
onPrefillConsumed?: () => void;
```

实现一个只执行一次的 effect（用 `useRef(false)` 防止重复）：

```ts
const didPrefillRef = useRef(false);

useEffect(() => {
  if (didPrefillRef.current) return;
  const cmd = (prefillSkillCommand ?? '').trim();
  if (!cmd) return;
  didPrefillRef.current = true;

  // 将 `/<cmd>` 插入到 composer：复用既有插入 API
  // 这里优先使用 composerRef.current.setPlainTextAndSelection / insertAtSelection
  // 取决于当前 ChatComposer 暴露的方法；若需要，增加一个最小方法到 ChatComposerHandle。

  // Minimal approach (works even if input state is source of truth):
  setInput((prev) => (prev ? `${cmd} ${prev}` : cmd));
  requestAnimationFrame(() => {
    composerRef.current?.focus?.();
  });
  onPrefillConsumed?.();
}, [prefillSkillCommand, onPrefillConsumed]);
```

**关键要求：**
- 插入逻辑必须走“现有的 chip/ZWSP 规则”。如果当前 `ChatInput` 的 source-of-truth 是 `input` + `ChatComposer` 的同步，则应优先复用现有的 `insertAtSelection` / `formatComposerTextForSend` 路径，而不是直接拼字符串；实现时以当前 `ChatComposerHandle` 的能力为准，必要时给 `ChatComposer` 增加一个最小接口：

```ts
insertTextAtSelection(text: string): void
focus(): void
```

并在 `ChatInput` 使用：

```ts
composerRef.current?.insertTextAtSelection(cmd);
composerRef.current?.focus();
```

- 预填完成后必须调用 `onPrefillConsumed()`，并确保路由 state 被清掉，避免返回/刷新重复预填。

- [ ] **Step 4: Typecheck**

Run:

```bash
pnpm run typecheck
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/pages/Chat/index.tsx src/pages/Chat/ChatInput.tsx
git commit -m "feat(chat): 支持从技能商店预填技能命令"
```

---

### Task 4: Playwright E2E for grid cards + bundled delete tooltip + use-now prefill

**Files:**
- Create: `tests/e2e/skills-store-grid-cards.spec.ts`

- [ ] **Step 1: Create new spec file**

新建 `tests/e2e/skills-store-grid-cards.spec.ts`：

```ts
import { expect, test } from './fixtures/electron';

async function skipSetup(page: import('@playwright/test').Page) {
  await expect(page.getByTestId('setup-page')).toBeVisible();
  await page.getByTestId('setup-skip-button').click();
  await expect(page.getByTestId('main-layout')).toBeVisible();
}

test.describe('Skills store grid cards', () => {
  test('shows grid cards and no-more footer (smoke)', async ({ page }) => {
    test.setTimeout(180_000);
    await skipSetup(page);

    const raw = page.url();
    const base = raw.includes('#') ? raw.slice(0, raw.indexOf('#')) : raw;
    await page.goto(`${base}#/skills`);

    await expect(page.getByText('Skills Store')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('skills-grid')).toBeVisible();

    const cards = page.getByTestId('skills-card');
    if (await cards.count() === 0) {
      test.skip();
    }

    await expect(page.getByTestId('skills-card-no-more')).toBeVisible();
  });

  test('bundled skill delete shows tooltip text when hovered (if bundled exists)', async ({ page }) => {
    test.setTimeout(180_000);
    await skipSetup(page);

    const raw = page.url();
    const base = raw.includes('#') ? raw.slice(0, raw.indexOf('#')) : raw;
    await page.goto(`${base}#/skills`);

    const cards = page.getByTestId('skills-card');
    if (await cards.count() === 0) test.skip();

    // Hover each delete button until we find a bundled tooltip; otherwise skip.
    const deleteButtons = page.getByTestId('skills-card-delete');
    const n = await deleteButtons.count();
    if (n === 0) test.skip();

    let found = false;
    for (let i = 0; i < n; i++) {
      await deleteButtons.nth(i).hover();
      const tip = page.getByTestId('skills-card-delete-tooltip');
      if (await tip.isVisible().catch(() => false)) {
        found = true;
        await expect(tip).toContainText('不能删除内置技能');
        break;
      }
    }
    if (!found) test.skip();
  });

  test('use now navigates to chat and prefills command', async ({ page }) => {
    test.setTimeout(180_000);
    await skipSetup(page);

    const raw = page.url();
    const base = raw.includes('#') ? raw.slice(0, raw.indexOf('#')) : raw;
    await page.goto(`${base}#/skills`);

    const cards = page.getByTestId('skills-card');
    if (await cards.count() === 0) test.skip();

    // Click first use-now button (works even if it is bundled/core)
    await page.getByTestId('skills-card-use-now').first().click();

    // Now in chat route.
    await expect(page.getByTestId('chat-composer')).toBeVisible({ timeout: 15_000 });
    const composer = page.getByTestId('chat-composer');

    // Prefill should start with '/'.
    await expect(composer).toContainText('/');
    await expect(composer).toBeFocused();
  });
});
```

说明：
- 这里使用最小 smoke 断言；若文案受语言影响，后续可改为 testid 断言而非英文标题文本。
- tooltip 断言使用中文文案；如果测试运行时语言不是中文，应改为 testid-only 或强制 locale。实现阶段按实际运行语言调整。

- [ ] **Step 2: Run E2E**

Run:

```bash
pnpm run test:e2e -- tests/e2e/skills-store-grid-cards.spec.ts
```

Expected: PASS（若没有技能/没有 bundled 技能，测试会 `test.skip()`）

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/skills-store-grid-cards.spec.ts
git commit -m "test(e2e): 覆盖技能卡片与立即使用预填"
```

---

## Plan self-review

**Spec coverage mapping:**
- 卡片栅格、每行最多 3：Task 2
- 末尾「没有更多了」：Task 2 Step 4
- 内置技能删除 hover「不能删除内置技能」：Task 2 Step 3 + Task 4 第二个用例
- 立即使用跳 Chat 并预填 `/command`、聚焦、一次性消费：Task 3 + Task 4 第三个用例
- 不做二次确认、不打开详情：Task 2/3 的交互明确不触发确认/详情

**Placeholder scan:** 无 TBD/TODO；每步包含具体代码与命令。

**Type consistency:** `prefillSkillCommand` / `onPrefillConsumed` 在 Task 3 前后命名一致；testid 命名在 Task 2 与 Task 4 一致。

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-07-skills-store-grid-cards.md`. Two execution options:

1. **Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration
2. **Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?

