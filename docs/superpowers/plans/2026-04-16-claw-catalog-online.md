# Claw Catalog 线上数字员工市场 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 Agents 页「数字员工库」的部门分类、分页列表与详情展示改为经 Main 代理调用业务云 Claw Catalog API；移除本地 `src/data/employees` 目录数据；仅在添加员工时拉取详情并用于 `POST /api/employees/provision`。

**Architecture:** Electron Host 增加与 `cloud-skillhub` 同构的 `/api/cloud/claw/catalog/*` 转发至 `{getCloudApiBaseUrl()}/app-api/claw/catalog/*`。渲染进程用 `src/lib/claw-catalog-api.ts` + 独立 Zustand store 管理部门、分页列表与搜索防抖；`useEmployeesStore` 保留「我的员工」持久化与 `addEmployee`/`removeEmployee`，去掉全量本地 `employees` 目录数组；市场列表项与 `myEmployees` 在 UI 层合并 `isAdded`。

**Tech Stack:** TypeScript、React 19、Zustand、`hostApiFetch`、Vitest、Playwright、现有 Host HTTP 路由模式。

---

## 文件结构（创建 / 修改一览）

| 路径 | 职责 |
|------|------|
| `electron/api/routes/cloud-claw-catalog.ts`（新建） | 转发 `departments`、`agents`（透传 query）、`agent/{bundleId}` |
| `electron/api/server.ts` | `import` 并插入 `handleCloudClawCatalogRoutes`（建议紧挨 `handleCloudSkillhubRoutes`） |
| `src/lib/claw-catalog-api.ts`（新建） | `hostApiFetch` 封装三类 GET，导出 `PAGE_SIZE` 等常量 |
| `src/types/claw-catalog.ts`（新建） | 接口原始类型与 `code/msg/data` 包装类型 |
| `src/lib/claw-catalog-map.ts`（新建） | `mapCatalogAgentToEmployee`：云端条目 → `Employee` / `EmployeeWithStatus`（`id` = `bundleId`） |
| `src/stores/claw-catalog-market.ts`（新建，名称可微调） | `departments`、`items`、`total`、`keyword` 防抖、`selectedDepartmentId`、`loading`/`loadMore`、`errors`、`resetAndFetch`、`loadMore`、滚动触底 |
| `src/types/employee.ts` | 为 `Employee` 增加 `skipCatalogDetailFetch?: boolean`（或等价命名）；`department` 可放宽为 `string`（与云端 `department` 代码一致）；保留 `Department` 仅给「创建数字员工」等仍用枚举处 |
| `src/stores/employees.ts` | 移除 `employees`/`setEmployees`/`getFilteredEmployees`/`getEmployeesByDepartment`（若已无引用）；`addEmployee` 内在 **`skipCatalogDetailFetch` 不为 true** 时先 `fetchClawCatalogAgent(bundleId)`，失败则 toast 并 return false，成功用 **详情 `data`** 字段调用 provision；精简 `reconcileWithOpenClawAgentIds` 不再依赖目录数组 |
| `src/pages/Agents/Marketplace.tsx` | 删除 `index.json` import；接入 catalog store + 部门条 + 无限滚动；搜索绑定 `keyword`（与父级 `searchQuery` 同步方式见下） |
| `src/pages/Agents/index.tsx` | `searchQuery` onChange 同时驱动 catalog store 的 `setKeyword`（或 Marketplace `useEffect` 同步 props），保证输入即重置列表 |
| `src/pages/Agents/CreateDigitalEmployeeDialog.tsx` | 构造的 `Employee` 设置 **`skipCatalogDetailFetch: true`**，避免对随机 `id` 请求 catalog 详情 |
| `src/pages/Agents/EmployeeDetail.tsx` | 无需请求详情；添加流程走 store 的 `addEmployee`（已含拉详情） |
| `src/data/employees/**` | 删除不再引用的资源（整目录若仅服务市场则删除） |
| `docs/api-docs/01_Claw_API.md`（或索引约定位置） | 增加三节 API 说明（与 `temp/claw-catalog-*.md` 一致） |
| `tests/e2e/*.spec.ts`（新建或扩展） | Agents 市场 Tab：mock `hostapi:fetch` 返回部门 + 列表，断言可见分类与卡片 |
| `tests/unit/claw-catalog-map.test.ts`（新建） | 映射函数对 `bundleId`、`department` 字符串、`requiredSkills` JSON 字符串的解析 |

---

### Task 1: Main — Claw Catalog 转发路由

**Files:**
- Create: `electron/api/routes/cloud-claw-catalog.ts`
- Modify: `electron/api/server.ts`

- [ ] **Step 1.1：新建 `cloud-claw-catalog.ts`**

实现 `handleCloudClawCatalogRoutes(req, res, url, ctx)`，仅处理 **GET**，且 `url.pathname` 为以下之一：

1. `/api/cloud/claw/catalog/departments` → `{base}/app-api/claw/catalog/departments`
2. `/api/cloud/claw/catalog/agents` → `{base}/app-api/claw/catalog/agents` + `url.search` 原样拼接
3. `/api/cloud/claw/catalog/agent/<bundleId>` → `{base}/app-api/claw/catalog/agent/<bundleId>`（`bundleId` 用 `decodeURIComponent` 从 path 取出后再 `encodeURIComponent` 拼上游，避免重复编码）

响应处理照抄 `electron/api/routes/cloud-skillhub.ts`：`cloudFetchLogged`、`response.text()`、JSON 则 `sendJson` 否则 `sendText`。

- [ ] **Step 1.2：注册路由**

在 `electron/api/server.ts` 的 `routeHandlers` 数组中，在 `handleCloudSkillhubRoutes` 之后加入 `handleCloudClawCatalogRoutes`。

- [ ] **Step 1.3：提交**

```bash
git add electron/api/routes/cloud-claw-catalog.ts electron/api/server.ts
git commit -m "feat(electron): 转发业务云 Claw Catalog 部门/列表/详情 API"
```

---

### Task 2: 类型与 API 封装

**Files:**
- Create: `src/types/claw-catalog.ts`
- Create: `src/lib/claw-catalog-api.ts`

- [ ] **Step 2.1：定义响应类型**

在 `claw-catalog.ts` 中定义（字段与 `temp/claw-catalog-*.md` 对齐，可用 `interface`）：

- `ClawCatalogDepartment`：`id`、`department`、`departmentNameZh`、`logo`、`parentId`、`sort`、`children`、`createTime`、`updateTime`
- `ClawCatalogAgent`：文档中的列表/详情字段（含 `bundleId`、`systemPrompt`、`soulContent` 等）
- `ClawCatalogDepartmentsResponse`：`{ code; msg; data: ClawCatalogDepartment[] }`
- `ClawCatalogAgentsResponse`：`{ code; msg; data: { total; list: ClawCatalogAgent[] } }`
- `ClawCatalogAgentDetailResponse`：`{ code; msg; data: ClawCatalogAgent }`

- [ ] **Step 2.2：实现 `claw-catalog-api.ts`**

```ts
import { hostApiFetch } from '@/lib/host-api';

export const CLAW_CATALOG_PAGE_SIZE = 20; // ≤100，与 spec 一致即可

export async function fetchClawCatalogDepartments() {
  return hostApiFetch<ClawCatalogDepartmentsResponse>('/api/cloud/claw/catalog/departments');
}

export async function fetchClawCatalogAgents(params: {
  pageNo: number;
  pageSize?: number;
  keyword?: string;
  departmentId?: number;
  tier?: string;
}) {
  const q = new URLSearchParams();
  q.set('pageNo', String(params.pageNo));
  q.set('pageSize', String(params.pageSize ?? CLAW_CATALOG_PAGE_SIZE));
  if (params.keyword?.trim()) q.set('keyword', params.keyword.trim());
  if (params.departmentId != null) q.set('departmentId', String(params.departmentId));
  if (params.tier?.trim()) q.set('tier', params.tier.trim());
  return hostApiFetch<ClawCatalogAgentsResponse>(`/api/cloud/claw/catalog/agents?${q.toString()}`);
}

export async function fetchClawCatalogAgentDetail(bundleId: string) {
  const id = encodeURIComponent(bundleId.trim());
  return hostApiFetch<ClawCatalogAgentDetailResponse>(`/api/cloud/claw/catalog/agent/${id}`);
}
```

- [ ] **Step 2.3：提交**

```bash
git add src/types/claw-catalog.ts src/lib/claw-catalog-api.ts
git commit -m "feat: Claw Catalog 类型与 hostApi 封装"
```

---

### Task 3: 映射函数与单元测试

**Files:**
- Create: `src/lib/claw-catalog-map.ts`
- Create: `tests/unit/claw-catalog-map.test.ts`

- [ ] **Step 3.1：实现 `mapCatalogAgentToEmployee(agent: ClawCatalogAgent): EmployeeWithStatus`**

规则要点：

- `id` = `agent.bundleId`（必填）
- `name` / `nameZh` / `description` / `descriptionZh` / `emoji` / `color` / `vibe` / `vibeZh` / `department`（字符串） / `departmentId`（若 `Employee` 需扩展字段则加入 `departmentId?: number`）
- `soulContent` / `agentsContent` / `identityContent` 从接口字符串原样带入（列表项可能已有）
- `skills` / `channels`：若 UI 需要数组，对 `requiredSkills`、`requiredChannels` 做 `JSON.parse` 容错，失败则 `[]`
- `isAdded: false`（外层合并 `myEmployees` 时覆盖）

- [ ] **Step 3.2：Vitest**

在 `tests/unit/claw-catalog-map.test.ts` 中构造最小 `ClawCatalogAgent` 对象，断言 `id === bundleId`、`department` 为代码字符串。

运行：`pnpm test tests/unit/claw-catalog-map.test.ts`

- [ ] **Step 3.3：提交**

```bash
git add src/lib/claw-catalog-map.ts tests/unit/claw-catalog-map.test.ts
git commit -m "feat: Claw Catalog 条目映射为员工卡片模型并加单测"
```

---

### Task 4: Zustand — 市场列表 Store

**Files:**
- Create: `src/stores/claw-catalog-market.ts`

- [ ] **Step 4.1：状态与行为**

参考 `src/stores/skillhub-list.ts`：

- `departments: ClawCatalogDepartment[]`、`departmentsError: string | null`、`loadDepartments: () => Promise<void>`
- `items: EmployeeWithStatus[]`（由 `mapCatalogAgentToEmployee` 得到后再合并 `isAdded` 可在组件内做，或 store 内订阅 `myEmployees` —— **推荐组件内 merge，避免循环依赖**）
- `total`、`nextPageToFetch`、`loading`、`loadingMore`、`listError`、`keyword`、`setKeyword`（防抖 `400ms` 后 `resetAndFetch`）
- `selectedDepartmentId: 'all' | number`、`setSelectedDepartmentId`
- `resetAndFetch`：`pageNo=1`，清空 `items`，请求 `fetchClawCatalogAgents`（带 `keyword`、`departmentId`）
- `loadMore`：条件与 skillhub 相同，`pageNo` 递增
- 首次进入：`loadDepartments` + `resetAndFetch`

导出 `CLAW_CATALOG_PAGE_SIZE` 供 UI 使用（或从 api 文件 re-export）。

- [ ] **Step 4.2：提交**

```bash
git add src/stores/claw-catalog-market.ts
git commit -m "feat: Claw Catalog 市场分页与部门状态 store"
```

---

### Task 5: 精简 `useEmployeesStore` 与 `addEmployee` 拉详情

**Files:**
- Modify: `src/types/employee.ts`
- Modify: `src/stores/employees.ts`
- Modify: `src/pages/Agents/CreateDigitalEmployeeDialog.tsx`

- [ ] **Step 5.1：扩展 `Employee`**

在 `Employee` 上增加可选字段：

```ts
/** 为 true 时添加员工不请求 Claw Catalog 详情（自定义创建） */
skipCatalogDetailFetch?: boolean;
```

如需承载 `departmentId`，增加 `departmentId?: number`。将 `department` 类型改为 **`string`**（仍可用 `Department` 作为自定义场景的窄类型，通过 `as` 兼容）。

- [ ] **Step 5.2：重写 `addEmployee`**

伪代码逻辑（需落地为真实 TypeScript）：

```ts
import { fetchClawCatalogAgentDetail } from '@/lib/claw-catalog-api';
import { mapCatalogAgentToEmployee } from '@/lib/claw-catalog-map';

addEmployee: async (employee, onProvisionStage) => {
  // ... 前置 guard、ipc 订阅不变

  let payload = employee as EmployeeWithStatus;

  if (!employee.skipCatalogDetailFetch) {
    const bundleId = employee.id.trim();
    const res = await fetchClawCatalogAgentDetail(bundleId);
    if (res.code !== 0) {
      set({ isLoading: false });
      // toast 由调用方或此处统一处理；至少 return false
      return false;
    }
    const mapped = mapCatalogAgentToEmployee(res.data);
    payload = { ...employee, ...mapped }; // 详情覆盖列表行，保证 soul/agents/identity 等为最新
  }

  const res = await hostApiFetch('/api/employees/provision', {
    method: 'POST',
    body: JSON.stringify({
      employeeId: payload.id,
      nameZh: payload.nameZh,
      nameEn: payload.name,
      soulContent: payload.soulContent ?? '',
      agentsContent: payload.agentsContent ?? '',
      identityContent: payload.identityContent ?? '',
      emoji: payload.emoji,
      ...(vibePayload ? { vibe: vibePayload } : {}),
    }),
  });
  // ... 成功则更新 myEmployees；不再维护全量 employees 数组
};
```

从 store 中 **删除** `employees`、`setEmployees`、`getFilteredEmployees`、`getEmployeesByDepartment`。`addEmployee` / `removeEmployee` 中凡更新 `employees` 映射的代码删除；`reconcileWithOpenClawAgentIds` 仅修剪 `myEmployees` 与 `selectedEmployee`，**不再** patch 目录 `isAdded`（目录由 Market 组件根据 `myEmployees` 计算 `isAdded`）。

- [ ] **Step 5.3：`CreateDigitalEmployeeDialog`**

在 `Employee` 字面量中增加 `skipCatalogDetailFetch: true`。

- [ ] **Step 5.4：运行测试**

`pnpm run typecheck` 与 `pnpm test`（修复受影响的 `stores` 单测，如 `tests/unit/stores.test.ts` 若引用已删字段）。

- [ ] **Step 5.5：提交**

```bash
git add src/types/employee.ts src/stores/employees.ts src/pages/Agents/CreateDigitalEmployeeDialog.tsx tests/unit/stores.test.ts
git commit -m "feat(employees): 添加员工前拉取 Claw Catalog 详情并精简 store"
```

---

### Task 6: `Marketplace.tsx` 与市场 UI

**Files:**
- Modify: `src/pages/Agents/Marketplace.tsx`
- Modify: `src/pages/Agents/index.tsx`（搜索与 keyword 同步）

- [ ] **Step 6.1：删除本地 JSON 加载**

移除 `import('@/data/employees/index.json')`、`isLoaded`/`cached` 等与本地目录相关逻辑。

- [ ] **Step 6.2：接入 store**

- `useEffect`：挂载时 `loadDepartments` + `resetAndFetch`（若尚未加载）。
- 部门条：`departments.map` 渲染 `departmentNameZh`（与 `logo` 可选）；「全部」→ `setSelectedDepartmentId('all')` 并 `resetAndFetch`。
- 列表：`items` 映射 `EmployeeCard`；`isAdded`：`useEmployeesStore(s => s.myEmployees)` 计算 `myEmployees.some(m => m.id === emp.id)` 传入或使用包装类型。
- 滚动容器上监听 scroll，触底调用 `loadMore`（复制 `SkillhubMarketplace.tsx` 中 `ResizeObserver` + 近底判断模式）。
- `searchQuery`（来自 props）：`useEffect(() => { setKeyword(searchQuery); }, [searchQuery])` 或在父组件同时 `setKeyword`。

- [ ] **Step 6.3：错误 UI**

`departmentsError` / `listError` 分别展示行内错误 +「重试」按钮（调用 `loadDepartments` 或 `resetAndFetch`）。

- [ ] **Step 6.4：提交**

```bash
git add src/pages/Agents/Marketplace.tsx src/pages/Agents/index.tsx
git commit -m "feat(agents): 数字员工库市场改为 Claw Catalog 分页与线上部门"
```

---

### Task 7: 其它引用与静态资源清理

**Files:**
- Delete: `src/data/employees/**`（含 `index.json` 若存在）
- Modify: 任意仍 import `data/employees` 的文件
- Modify: `src/stores/employees.ts` 中的 `getAllDepartments`、`getDepartmentInfo`（若仅市场使用则删除或改为基于 catalog departments 的 helper）

- [ ] **Step 7.1：全局搜索**

`rg "data/employees" src` 与 `rg "DEPARTMENT_MAP" src`，删除死代码或改为字符串部门色表（`EmployeeCard` / `EmployeeDetail` 中 `DEPARTMENT_COLORS` 已用 `Record<string, ...>`，保留 fallback 即可）。

- [ ] **Step 7.2：提交**

```bash
git add -A src/data/employees src/stores/employees.ts src/pages/Agents/
git commit -m "chore: 移除本地数字员工 JSON 数据源"
```

---

### Task 8: 文档与 E2E

**Files:**
- Modify: `docs/api-docs/01_Claw_API.md`（或项目约定文件）
- Create/Modify: `tests/e2e/claw-catalog-marketplace.spec.ts`（文件名自定）

- [ ] **Step 8.1：`docs/api-docs`**

追加三节：**departments**、**agents（query 表）**、**agent/{bundleId}**，与 `temp/claw-catalog-*.md` 一致；注明经 **`/api/cloud/claw/catalog/...`** 代理。

- [ ] **Step 8.2：E2E**

参考 `tests/e2e/skills-store-grid-cards.spec.ts` 与 `tests/e2e/fixtures/electron.ts` 中对 `hostapi:fetch` 的 mock：在测试中 `page.goto` 到 `#/employees`，mock 返回 `departments` 与 `agents` 的 JSON，断言市场 Tab 下出现部门 chip 与至少一张卡片（`data-testid` 可在 `Marketplace` 为部门条/列表根节点增加稳定 id）。

运行：`pnpm run test:e2e -- tests/e2e/claw-catalog-marketplace.spec.ts`

- [ ] **Step 8.3：提交**

```bash
git add docs/api-docs/01_Claw_API.md tests/e2e/claw-catalog-marketplace.spec.ts
git commit -m "docs+test: Claw Catalog API 说明与员工市场 E2E"
```

---

### Task 9: 全量验证

- [ ] 运行 `pnpm run lint`、`pnpm run typecheck`、`pnpm test`、`pnpm run test:e2e`（或受影响子集），全部通过后合并分支。

---

## Spec 对照自检

| Spec 要求 | 对应任务 |
|-----------|----------|
| 部门 `GET .../departments` | Task 1–2、4、6 |
| 列表分页 + keyword + departmentId | Task 2、4、6 |
| 详情展示不请求；仅列表数据 | Task 6（无详情 fetch） |
| 添加前 `GET .../agent/{bundleId}` 再 provision | Task 5 |
| 无本地 JSON 兜底 | Task 6–7 |
| 匿名可读（代理无额外鉴权） | Task 1（与 skillhub 一致） |
| `bundleId` 作为 `employeeId` | Task 3–5 |
| docs/api-docs + E2E | Task 8 |

**占位符扫描：** 无 TBD；`PAGE_SIZE` 在 Task 2 固定为常数需与 Task 4 store 一致。

---

## 执行方式

Plan 已保存至 `docs/superpowers/plans/2026-04-16-claw-catalog-online.md`。

**可选执行方式：**

1. **Subagent-Driven（推荐）** — 每任务独立子代理，任务间审查，迭代快。需配合 **subagent-driven-development** skill。  
2. **Inline Execution** — 本会话按任务顺序实现，配合 **executing-plans** skill 与检查点。

你更倾向哪一种？
