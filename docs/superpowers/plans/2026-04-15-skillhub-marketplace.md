# Skillhub 技能商店（云端列表 + 卡片页）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将技能页「技能商店」从 ClawHub Sheet 搜索改为业务云 Skillhub 分页列表，主区域与「我的技能」同风格卡片网格；取消安装 Sheet；分页每页 15 条；卡片外链使用 `VITE_SKILL_HUB_BASE_URL/skills/{slug}`。

**Architecture:** Main Host API 新增 **无鉴权** GET 代理 `/api/cloud/skillhub/skills`，将 query 原样转发至 `{getCloudApiBaseUrl()}/app-api/skillhub/skills`。渲染进程通过现有 **`hostApiFetch`** 拉列表；本地安装仍复用 **`useSkillsStore().installSkill`**（`/api/clawhub/install`）。列表状态放在 **独立模块**（小 Zustand store 或 `useSkillhubList` hook），避免继续膨胀 `skills.ts`。长列表用 **`@tanstack/react-virtual`** 按「行」虚拟化（每行 1～3 列卡片，视断点而定），配合 **滚动加载更多**。

**Tech Stack:** TypeScript、React 19、Zustand、`hostApiFetch`、`@tanstack/react-virtual`（新增依赖）、Playwright E2E、Vitest。

---

## 文件结构（创建 / 修改）

| 路径 | 职责 |
|------|------|
| `electron/api/routes/cloud-skillhub.ts` | **新建**：处理 `GET /api/cloud/skillhub/skills`，`cloudFetchLogged` 转发至业务云，不带 Bearer。 |
| `electron/api/server.ts` | 注册 `handleCloudSkillhubRoutes`（顺序建议在 `handleCloudAuthRoutes` 之后）。 |
| `src/types/skillhub.ts` | **新建**：`SkillhubListItem`、`SkillhubListResponse`（与 `temp/res.json` 对齐）。 |
| `src/lib/skillhub-url.ts` | **新建**：`getSkillHubSkillPageUrl(slug)`，基于 `import.meta.env.VITE_SKILL_HUB_BASE_URL` 规范化拼接。 |
| `src/stores/skillhub-list.ts`（或 `src/hooks/use-skillhub-list.ts`） | 列表、`pageNo`、`total`、loading/error、`append`/`reset`、防抖搜索词。 |
| `src/lib/skillhub-api.ts` | **可选**：封装 `fetchSkillhubPage(q, pageNo)` → `hostApiFetch`。 |
| `src/pages/Skills/index.tsx` | 移除安装 Sheet；技能商店 Tab 下渲染虚拟化卡片网格；工具栏按 Tab 隐藏分类。 |
| `src/pages/Skills/SkillhubCard.tsx`（或内联子组件） | **可选拆分**：单张商店卡片 UI，便于测试。 |
| `.env.example`、`.env.development`、`.env.production` | 增加 `VITE_SKILL_HUB_BASE_URL`（示例值与预发/生产站点一致策略）。 |
| `vite.config.ts` | 若需打包后 Main 可读 Skill Hub（本 spec 仅需渲染进程打开外链，**通常不必** inject Main）；若团队希望与 `VITE_CLOUD_*` 一致注入 `define`，可仅加 renderer 侧 `loadEnv`。 |
| `docs/api-docs/` | 新增或增补 Skillhub 列表契约（路径、query、`pageSize=15` 约定）。 |
| `tests/e2e/skills-store-grid-cards.spec.ts` | 更新：技能商店不再断言 `skills-install-sheet`；改为断言商店视图/分类隐藏等。 |
| `tests/unit/skillhub-url.test.ts` | **新建**：URL 拼接单测。 |

---

### Task 1: 依赖 `@tanstack/react-virtual`

**Files:**
- Modify: `package.json`

- [ ] **Step 1: 添加依赖**

```bash
pnpm add @tanstack/react-virtual
```

- [ ] **Step 2: 安装后 typecheck**

Run: `pnpm run typecheck`  
Expected: PASS（当前基线无新增错误）。

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: 添加 @tanstack/react-virtual 供技能商店长列表虚拟化"
```

---

### Task 2: Host API — Skillhub 列表代理

**Files:**
- Create: `electron/api/routes/cloud-skillhub.ts`
- Modify: `electron/api/server.ts`（import + `routeHandlers` 数组）

- [ ] **Step 1: 实现路由处理函数**

新建 `electron/api/routes/cloud-skillhub.ts` 核心逻辑要点：

- 仅当 `req.method === 'GET'` 且 `pathname === '/api/cloud/skillhub/skills'` 时处理，否则 `return false`。
- 目标 URL：`const base = getCloudApiBaseUrl()`（来自 `electron/utils/cloud-config`），再 `const upstream = `${base}/app-api/skillhub/skills${url.search}``（**保留**调用方传入的 `q`、`pageNo`、`pageSize` query；渲染进程固定 `pageSize=15`）。
- 使用 `cloudFetchLogged('skillhub.skills', upstream, { method: 'GET' })`，**不要**设置 `Authorization`。
- 读取 `response.text()`，`Content-Type: application/json` 时用 `sendJson(res, response.status, JSON.parse(text))`；非 JSON 时 `sendText` 或 `sendJson` 包装错误信息（与现有路由风格一致）。
- `response.ok` 为 false 时仍可将 body 转发给前端，或统一 502 + 简短错误；**推荐**：HTTP 状态与云端一致，body 为云端原文，便于前端解析 `code`。

- [ ] **Step 2: 注册 handler**

在 `electron/api/server.ts` 中：

```ts
import { handleCloudSkillhubRoutes } from './routes/cloud-skillhub';
```

将 `handleCloudSkillhubRoutes` 紧接在 `handleCloudAuthRoutes` 之后加入 `routeHandlers` 数组。

- [ ] **Step 3: 手动验证（开发机）**

启动应用后，用带 Host Bearer 的方式（与 `hostApiFetch` 相同）请求：

`GET http://127.0.0.1:13210/api/cloud/skillhub/skills?pageNo=1&pageSize=15&q=`  

（需从 Electron 日志或 DevTools 拿到 token，或使用 renderer 内临时 `hostApiFetch` 调用。）

Expected: JSON 与 `temp/res.json` 结构一致，`code === 0` 时 `data.list` 为数组。

- [ ] **Step 4: Commit**

```bash
git add electron/api/routes/cloud-skillhub.ts electron/api/server.ts
git commit -m "feat(electron): 代理 GET /api/cloud/skillhub/skills 至业务云"
```

---

### Task 3: 类型与 API 封装

**Files:**
- Create: `src/types/skillhub.ts`
- Create: `src/lib/skillhub-api.ts`

- [ ] **Step 1: 定义类型**

`src/types/skillhub.ts` 示例（字段以 `temp/res.json` 为准，可精简 UI 未用字段）：

```ts
export type SkillhubVersionInfo = {
  id: number;
  version: string;
  status: string;
};

export type SkillhubListItem = {
  id: number;
  slug: string;
  displayName: string;
  summary: string;
  status: string;
  namespace: string;
  updatedAt: string;
  publishedVersion?: SkillhubVersionInfo | null;
  headlineVersion?: SkillhubVersionInfo | null;
  // ... 按需补充 downloadCount 等
};

export type SkillhubListResponse = {
  code: number;
  msg: string;
  data: {
    total: number;
    list: SkillhubListItem[];
  };
};
```

- [ ] **Step 2: `fetchSkillhubPage`**

`src/lib/skillhub-api.ts`：

```ts
import { hostApiFetch } from '@/lib/host-api';
import type { SkillhubListResponse } from '@/types/skillhub';

const PAGE_SIZE = 15;

export function getSkillhubPageSize(): number {
  return PAGE_SIZE;
}

export async function fetchSkillhubPage(q: string, pageNo: number): Promise<SkillhubListResponse> {
  const params = new URLSearchParams();
  params.set('pageNo', String(pageNo));
  params.set('pageSize', String(PAGE_SIZE));
  if (q.trim()) params.set('q', q.trim());
  return hostApiFetch<SkillhubListResponse>(`/api/cloud/skillhub/skills?${params.toString()}`);
}
```

- [ ] **Step 3: Commit**

```bash
git add src/types/skillhub.ts src/lib/skillhub-api.ts
git commit -m "feat: Skillhub 列表类型与 hostApiFetch 封装"
```

---

### Task 4: Skill Hub 外链工具与单元测试

**Files:**
- Create: `src/lib/skillhub-url.ts`
- Create: `tests/unit/skillhub-url.test.ts`

- [ ] **Step 1: 实现 `getSkillHubSkillPageUrl`**

```ts
// src/lib/skillhub-url.ts
export function getSkillHubSkillPageUrl(slug: string): string | null {
  const raw = import.meta.env.VITE_SKILL_HUB_BASE_URL?.trim();
  if (!raw) return null;
  const base = raw.replace(/\/+$/, '');
  const path = `/skills/${encodeURIComponent(slug)}`;
  return `${base}${path}`;
}
```

- [ ] **Step 2: Vitest**

```ts
// tests/unit/skillhub-url.test.ts
import { describe, expect, it, vi } from 'vitest';

describe('getSkillHubSkillPageUrl', () => {
  it('joins base without double slashes', async () => {
    vi.stubEnv('VITE_SKILL_HUB_BASE_URL', 'https://hub.example.com/');
    const { getSkillHubSkillPageUrl } = await import('@/lib/skillhub-url');
    expect(getSkillHubSkillPageUrl('my-skill')).toBe('https://hub.example.com/skills/my-skill');
  });
});
```

（若项目 vitest 不用 `vi.stubEnv`，改为 mock `import.meta.env` 的既有模式。）

Run: `pnpm test tests/unit/skillhub-url.test.ts`  
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/lib/skillhub-url.ts tests/unit/skillhub-url.test.ts
git commit -m "feat: Skill Hub 技能页外链拼接与单测"
```

---

### Task 5: 环境变量

**Files:**
- Modify: `.env.example`
- Modify: `.env.development`、`.env.production`（若仓库已提交）

- [ ] **Step 1: 文档与示例值**

在 `.env.example` 增加：

```env
# Skill Hub 前端站点根（卡片打开技能详情页：{base}/skills/{slug}）
VITE_SKILL_HUB_BASE_URL=https://your-skill-hub.example.com
```

预发/生产填入真实 Skill Hub 根地址（与产品一致；**不含** `/skills` 后缀）。

- [ ] **Step 2: Commit**

```bash
git add .env.example .env.development .env.production
git commit -m "chore(env): 增加 VITE_SKILL_HUB_BASE_URL"
```

---

### Task 6: Skillhub 列表状态（store 或 hook）

**Files:**
- Create: `src/stores/skillhub-list.ts`（推荐 Zustand，与项目一致）

状态字段建议：`items: SkillhubListItem[]`、`total: number`、`pageNo: number`（下一页请求用）、`loading: boolean`、`loadingMore: boolean`、`error: string | null`、`searchQuery: string`（与工具栏 input 同步）。

Actions：

- `setSearchQuery(q: string)` + **debounce 300～500ms** 后 `resetAndFetch()`。
- `resetAndFetch()`：`pageNo=1`，替换 `items`，`fetchSkillhubPage(q, 1)`。
- `loadMore()`：若 `items.length >= total` 则 return；否则 `pageNo+1`，**追加** `data.list`。
- 若 `response.code !== 0`，设置 `error` 为 `msg` 或固定中文提示。

- [ ] **Step 1: 实现 store**

（完整实现略；确保 **pageSize 仅由 `fetchSkillhubPage` 固定 15**。）

- [ ] **Step 2: Commit**

```bash
git add src/stores/skillhub-list.ts
git commit -m "feat: Skillhub 列表分页与搜索状态"
```

---

### Task 7: Skills 页面 UI 改造

**Files:**
- Modify: `src/pages/Skills/index.tsx`
- Optional: `src/pages/Skills/SkillhubCard.tsx`

- [ ] **Step 1: 移除 Sheet**

删除 `installSheetOpen`、`installQuery`、`openMarketplaceSheet`、`closeMarketplaceSheet`、以及整个「技能商店」`Sheet`/`SheetContent` 块；删除对 `searchSkills` / `clearSearchResults` 的 **商店专用** 调用（若 `searchSkills` 仅用于 Sheet，可从页面移除；`skills.ts` 中 `searchSkills` 可保留供他处或后续删除，**YAGNI**：无引用则再删 store 方法）。

- [ ] **Step 2: Tab 行为**

`Tabs` 的 `value` 为 `mySkills` | `marketplace` 时：

- **`marketplace`**：不再调用 `openMarketplaceSheet()`；仅切换 `activeTab`，主内容区渲染 Skillhub 网格。
- **`mySkills`**：保持现有「我的技能」网格。

- [ ] **Step 3: 工具栏**

当 `activeTab === 'marketplace'`：

- **隐藏**「全部 / 内置 / 市场」三个按钮（`data-testid` 可增 `skills-filter-*` 便于 E2E）。
- **保留**搜索框：与 Skillhub `searchQuery` 绑定（可与「我的技能」的 `searchQuery` **分两个 state**，避免互相覆盖；或同一 input 但分 tab 记忆——**推荐两路 state**：`localSearchQuery` vs `skillhubSearchQuery`）。

- [ ] **Step 4: Skillhub 卡片**

- 布局复用「我的技能」卡片结构（`rounded-2xl`、`grid` 等）。
- **右上角**：`localInstalled = skills.some(s => s.slug === item.slug || s.id === item.slug)`  
  - 已安装：`Badge` 文案「已添加」（i18n key 如 `skills.skillhub.added`）。  
  - 未安装：`<Button variant="ghost" size="icon">` + `Download` 图标，`onClick` 调用 `installSkill(item.slug)`，`installing[item.slug]` 时 `LoadingSpinner`。
- **底部**：不渲染「立即使用」「删除」行。
- **卡片主体 `onClick`**：`invokeIpc('shell:openExternal', url)`，`url` 为 `getSkillHubSkillPageUrl(slug)`；若返回 `null`，toast 提示未配置 `VITE_SKILL_HUB_BASE_URL`。
- `stopPropagation` 在下载按钮上，避免触发打开外链。

- [ ] **Step 5: 虚拟化 + 加载更多**

- 容器 `flex-1 overflow-y-auto` 作为 virtualizer 的 scrollElement。
- 使用多列时：将 `items` 按 **`columnsPerRow`**（如 `window.matchMedia` 或 Tailwind 断点对应 1/2/3）**分组成行**，`virtualizer` 对「行」计数；每行内渲染 `columnsPerRow` 个 `SkillhubCard`。
- 滚动到底：`virtualizer.getVirtualItems()` 与 `scrollElement` 的 `scrollHeight` 判断，触发 `loadMore()`（**防抖**避免重复请求）。

- [ ] **Step 6: i18n**

在 `src/i18n/locales/*/skills.json` 增加商店相关键：已添加、加载更多失败、未配置外链等。

- [ ] **Step 7: Commit**

```bash
git add src/pages/Skills/index.tsx src/i18n/locales/zh/skills.json src/i18n/locales/en/skills.json
git commit -m "feat(skills): 技能商店改为云端卡片列表与虚拟滚动"
```

（若拆出 `SkillhubCard.tsx`，一并 `git add`。）

---

### Task 8: 清理 `skills` store（可选，独立 commit）

**Files:**
- Modify: `src/stores/skills.ts`

- [ ] **Step 1:** 若 `searchSkills`、`searchResults`、`searching`、`searchError` 已无引用，删除相关 state 与 action，并更新 `Skills/index.tsx` 以外的引用（grep 全仓库）。

- [ ] **Step 2: Commit**

```bash
git add src/stores/skills.ts
git commit -m "refactor(skills): 移除未使用的 ClawHub 搜索状态"
```

---

### Task 9: 文档 `docs/api-docs`

**Files:**
- Create: `docs/api-docs/06_Skillhub_API.md`（若索引文件存在则更新索引）

- [ ] **Step 1:** 记录：

- 路径：`GET /app-api/skillhub/skills`
- Query：`q`（可选）、`pageNo`、`pageSize`（客户端 **固定 15**）
- 响应：`code`、`msg`、`data.total`、`data.list[]`（字段表与 `temp/res.json` 对齐）

- [ ] **Step 2: Commit**

```bash
git add docs/api-docs/06_Skillhub_API.md
git commit -m "docs(api): 补充 Skillhub 列表接口说明"
```

（若仓库要求同步 `README*.md` 索引链接，按 AGENTS.md 一并更新。）

---

### Task 10: E2E 更新

**Files:**
- Modify: `tests/e2e/skills-store-grid-cards.spec.ts`

- [ ] **Step 1: 替换 Sheet 用例**

将「点击技能商店打开 `skills-install-sheet`」改为：

- 点击 `skills-tab-marketplace`；
- 期望 **不存在** `skills-install-sheet`（或 `toBeHidden`）；
- 期望分类按钮不可见（通过 `data-testid="skills-source-filters"` 包裹分类区，`hidden` 或 `not.toBeVisible()`）；
- 若预发可访问：期望出现 `data-testid="skillhub-grid"` 或 `skillhub-card`（实现时请加稳定 testid）；若 CI 无网络，可对**无卡片**情况 `test.skip()`（与现有「无 skills 则 skip」风格一致）。

- [ ] **Step 2: Run**

Run: `pnpm run test:e2e -- tests/e2e/skills-store-grid-cards.spec.ts`  
Expected: PASS 或可接受的 skip。

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/skills-store-grid-cards.spec.ts
git commit -m "test(e2e): 技能商店改为内联视图并更新断言"
```

---

### Task 11: 全量校验

- [ ] **Step 1:** `pnpm run lint`  
- [ ] **Step 2:** `pnpm run typecheck`  
- [ ] **Step 3:** `pnpm test`  
- [ ] **Step 4:** `pnpm run test:e2e`（时间允许时）

---

## Spec 自检（plan vs `2026-04-15-skillhub-marketplace-design.md`）

| Spec 要求 | Plan 覆盖 |
|-----------|-----------|
| GET 代理、无鉴权 | Task 2 |
| pageSize=15、pageNo 递增 | Task 3 + 6 |
| 与我的技能同卡片风、隐藏分类、保留搜索与打开文件夹 | Task 7 |
| 已添加 / 下载、无立即使用与删除 | Task 7 |
| 外链 `VITE_SKILL_HUB_BASE_URL/skills/{slug}` | Task 4 + 7 |
| 虚拟化 + 分页加载 | Task 1 + 7 |
| api-docs | Task 9 |
| E2E | Task 10 |

无未覆盖项。

---

## Execution handoff

**Plan complete and saved to `docs/superpowers/plans/2026-04-15-skillhub-marketplace.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — 每个 Task 派生子代理执行，任务间人工/主代理复核，迭代快。

**2. Inline Execution** — 本会话按 Task 顺序实现，在 Task 7/10 等大块处设检查点。

**Which approach?**
