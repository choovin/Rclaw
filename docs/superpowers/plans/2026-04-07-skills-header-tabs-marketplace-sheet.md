# Skills 头部 Tabs + 技能商店 Sheet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 `Skills` 页面头部改为“我的技能 / 技能商店”Tabs，点击“技能商店”打开现有安装技能 `Sheet`，关闭后自动回“我的技能”，并将“打开技能文件夹”按钮移动到原“安装技能”按钮位置且始终显示。

**Architecture:** 在 `src/pages/Skills/index.tsx` 引入与 `Agents` 类似的 `Tabs` 工具栏状态（`activeTab`），并将 `installSheetOpen` 与 `activeTab` 做双向同步：打开 `Sheet` 时切到 marketplace；关闭 `Sheet` 时切回 mySkills。复用现有 `Sheet` 内容与安装/搜索逻辑，仅调整入口与头部布局。

**Tech Stack:** React 19 + TypeScript + shadcn/ui（`Tabs`/`Sheet`/`Button`/`Input`）+ Playwright（Electron E2E）

---

## Files map（锁定改动边界）

**Modify**
- `e:/Code/Rclaw/src/pages/Skills/index.tsx`：新增 `Tabs` 头部；入口改为 Tab；移动“打开技能文件夹”；`Sheet` 关闭时回 tab。

**Test**
- `e:/Code/Rclaw/tests/e2e/skills-store-grid-cards.spec.ts`：追加一个测试用例覆盖“tab 打开 sheet / 关闭回 tab / 打开技能文件夹按钮始终可见”。

**Related references (read-only)**
- `e:/Code/Rclaw/src/pages/Agents/index.tsx`：工具栏 `Tabs` 形态参考。
- `e:/Code/Rclaw/playwright.config.ts`：E2E 目录与默认 timeout。
- `e:/Code/Rclaw/tests/e2e/fixtures/electron.ts`：E2E 启动与 `completeSetup`。

---

### Task 1: 为 Skills 工具栏新增 Tabs（状态与结构）

**Files:**
- Modify: `e:/Code/Rclaw/src/pages/Skills/index.tsx`（现有 Header / Sub Navigation 区域，约 L589-L690）
- Test: `e:/Code/Rclaw/tests/e2e/skills-store-grid-cards.spec.ts`

- [ ] **Step 1: 写一个会失败的 E2E（先定义要找的元素）**

在 `tests/e2e/skills-store-grid-cards.spec.ts` 追加用例（先写断言与交互，未实现前应失败）：

```ts
test('Skills 工具栏：点击“技能商店”打开安装 Sheet，关闭后自动回“我的技能”，且“打开技能文件夹”始终可见', async ({ page }) => {
  test.setTimeout(180_000);
  await skipSetupAndGoToSkills(page);

  // 工具栏/Tab：需要实现稳定定位（推荐添加 testid）
  const tabMySkills = page.getByTestId('skills-tab-my-skills');
  const tabMarketplace = page.getByTestId('skills-tab-marketplace');
  await expect(tabMySkills).toBeVisible();
  await expect(tabMarketplace).toBeVisible();

  // “打开技能文件夹”始终可见（不再依赖 hasInstalledSkills）
  await expect(page.getByTestId('skills-open-folder')).toBeVisible();

  // 点击技能商店 -> Sheet 打开
  await tabMarketplace.click();
  await expect(page.getByTestId('skills-install-sheet')).toBeVisible();

  // 关闭 Sheet -> 自动回“我的技能”
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('skills-install-sheet')).toBeHidden();
  await expect(tabMySkills).toHaveAttribute('data-state', 'active');
});
```

- [ ] **Step 2: 运行该 E2E，确认失败点符合预期**

Run:
- `pnpm run test:e2e -- tests/e2e/skills-store-grid-cards.spec.ts`

Expected:
- FAIL（因为目前没有 `skills-tab-*` / `skills-open-folder` / `skills-install-sheet` 这些 testid，且无 tabs 结构）

- [ ] **Step 3: 在 Skills 页面引入 `Tabs`（最小实现，先不搬动其他内容）**

在 `src/pages/Skills/index.tsx`：

1) 顶部 import 增加（保持 import 顶部，不做 inline import）：

```ts
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
```

2) 组件 state 增加：

```ts
const [activeTab, setActiveTab] = useState<'mySkills' | 'marketplace'>('mySkills');
```

3) 将 Header 区域改为类似 `Agents` 的工具栏结构（实现 testid）：

```tsx
<Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'mySkills' | 'marketplace')} className="flex min-h-0 flex-1 flex-col">
  <div className="mb-4 flex shrink-0 items-center gap-4 py-0.5" data-testid="skills-page-toolbar">
    <TabsList className="shrink-0">
      <TabsTrigger value="mySkills" data-testid="skills-tab-my-skills">我的技能</TabsTrigger>
      <TabsTrigger value="marketplace" data-testid="skills-tab-marketplace">技能商店</TabsTrigger>
    </TabsList>

    {/* 搜索框：复用现有 searchQuery / setSearchQuery */}
    <Input
      data-testid="skills-search-input"
      placeholder={t('search')}
      value={searchQuery}
      onChange={(e) => setSearchQuery(e.target.value)}
      className={cn('h-11 min-w-[140px] max-w-md flex-1 border-black/10 dark:border-white/10', 'focus-visible:ring-inset focus-visible:ring-offset-0')}
    />

    {/* 右侧操作：先放占位，下一任务完成迁移 */}
    <div className="ml-auto flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        onClick={handleOpenSkillsFolder}
        data-testid="skills-open-folder"
        className="h-9 shrink-0 rounded-full shadow-none"
      >
        <FolderOpen className="h-4 w-4 mr-2" />
        {t('openFolder')}
      </Button>
      <Button
        variant="outline"
        size="icon"
        onClick={fetchSkills}
        disabled={!isGatewayRunning}
        className="h-9 w-9 rounded-full border-black/10 dark:border-white/10 bg-transparent hover:bg-black/5 dark:hover:bg-white/5 shadow-none text-muted-foreground hover:text-foreground"
        title={t('refresh')}
        data-testid="skills-refresh"
      >
        <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
      </Button>
    </div>
  </div>

  {/* 原页面内容（过滤/网格/详情等）继续渲染在 Tabs 下方 */}
  <div className="min-h-0 flex-1">
    {/* 这里继续放原来的 Sub Navigation + Grid + Sheets */}
  </div>
</Tabs>
```

说明：
- 文案“我的技能/技能商店”可先写死中文（后续若需 i18n 再调整），但 testid 必须稳定。
- 这一步只做结构落地，下一任务再接上“点击 marketplace 打开 sheet / 关闭回 tab”等逻辑联动。

- [ ] **Step 4: 运行 typecheck（或至少 lint）确保无 TS/导入问题**

Run:
- `pnpm run typecheck`

Expected:
- PASS

- [ ] **Step 5: 提交一次小步 commit（可选但建议）**

```bash
git add e:/Code/Rclaw/src/pages/Skills/index.tsx e:/Code/Rclaw/tests/e2e/skills-store-grid-cards.spec.ts
git commit -m "实现 Skills 工具栏 Tabs 骨架并为 E2E 增加定位点"
```

---

### Task 2: Tabs 与安装 Sheet 的打开/关闭联动（核心交互）

**Files:**
- Modify: `e:/Code/Rclaw/src/pages/Skills/index.tsx`
- Test: `e:/Code/Rclaw/tests/e2e/skills-store-grid-cards.spec.ts`

- [ ] **Step 1: 让点击“技能商店”Tab 直接打开现有安装 Sheet**

在 `onValueChange` 中处理：

```ts
onValueChange={(v) => {
  const next = v as 'mySkills' | 'marketplace';
  setActiveTab(next);
  if (next === 'marketplace') {
    setInstallQuery('');
    setInstallSheetOpen(true);
  }
  if (next === 'mySkills') {
    setInstallSheetOpen(false);
  }
}}
```

要求：
- 不改动 `searchQuery` / `selectedSource`（保持不动）

- [ ] **Step 2: 让关闭 Sheet 时自动回“我的技能”**

将安装 `Sheet` 的 `onOpenChange` 改为显式处理关闭：

```tsx
<Sheet
  open={installSheetOpen}
  onOpenChange={(open) => {
    setInstallSheetOpen(open);
    if (!open) {
      setActiveTab('mySkills');
    }
  }}
>
  <SheetContent data-testid="skills-install-sheet" ...>
    ...
  </SheetContent>
</Sheet>
```

- [ ] **Step 3: 确保“技能商店”Tab 不需要页面内容区（它只是入口）**

实现策略：
- 页面主体仍然显示“我的技能”过滤条/网格/详情 Sheet（无需为 `marketplace` 渲染新的 `TabsContent`）
- 或者渲染 `TabsContent` 但 marketplace 内容为空（避免布局跳动）

以“不引入额外复杂度”为准。

- [ ] **Step 4: 运行单测/静态检查**

Run:
- `pnpm run typecheck`

Expected:
- PASS

- [ ] **Step 5: 跑 E2E（应从 FAIL 变为 PASS）**

Run:
- `pnpm run test:e2e -- tests/e2e/skills-store-grid-cards.spec.ts`

Expected:
- PASS（`skills-install-sheet` 可见；Esc 关闭后 Tab 回到 mySkills）

- [ ] **Step 6: 提交 commit（建议）**

```bash
git add e:/Code/Rclaw/src/pages/Skills/index.tsx e:/Code/Rclaw/tests/e2e/skills-store-grid-cards.spec.ts
git commit -m "实现 Skills 技能商店 Tab 打开 Sheet，关闭后回我的技能"
```

---

### Task 3: 移动“打开技能文件夹”到原“安装技能”按钮位置并改为始终显示

**Files:**
- Modify: `e:/Code/Rclaw/src/pages/Skills/index.tsx`

- [ ] **Step 1: 移除旧 Header 区域中对 `hasInstalledSkills` 的条件渲染**

当前代码（约 L589-L610）里：
- `hasInstalledSkills && (...)` 包裹的旧按钮逻辑需要删除或迁移
- 保留 `handleOpenSkillsFolder` 函数与 toast 行为不变

- [ ] **Step 2: 确保工具栏右侧“打开技能文件夹”始终可见**

要求：
- 不依赖 `hasInstalledSkills`
- 位置在工具栏右侧操作区（即原“安装技能”按钮所在行）

- [ ] **Step 3: 如果旧“安装技能”按钮仍存在，移除它**

当前按钮在“Sub Navigation and Actions”区域（约 L667-L689）：
- 移除触发 `setInstallSheetOpen(true)` 的按钮（由 Tab 替代）
- 保留刷新按钮（或将刷新按钮统一放到工具栏右侧，避免重复）

- [ ] **Step 4: 运行 lint/typecheck**

Run:
- `pnpm run lint`
- `pnpm run typecheck`

Expected:
- PASS

- [ ] **Step 5: 跑 E2E 回归**

Run:
- `pnpm run test:e2e -- tests/e2e/skills-store-grid-cards.spec.ts`

Expected:
- PASS

- [ ] **Step 6: 提交 commit（建议）**

```bash
git add e:/Code/Rclaw/src/pages/Skills/index.tsx
git commit -m "调整 Skills 头部：打开技能文件夹按钮移动并始终显示，移除安装按钮入口"
```

---

## Final verification（合并前的最小验证）

- [ ] **Step 1: 跑完整 lint + typecheck**

Run:
- `pnpm run lint`
- `pnpm run typecheck`

Expected:
- PASS

- [ ] **Step 2: 跑 E2E（至少包含 skills 相关 spec）**

Run:
- `pnpm run test:e2e -- tests/e2e/skills-store-grid-cards.spec.ts`

Expected:
- PASS

