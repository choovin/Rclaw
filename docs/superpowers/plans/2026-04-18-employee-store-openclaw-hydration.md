# Employee store hydration from OpenClaw Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After renderer localStorage is cleared (e.g. reinstall), rebuild `myEmployees` from OpenClaw workspaces and agent list so the UI matches disk; write sidecar metadata on provision/update; prevent duplicate catalog provisions when a workspace already claims that catalog id.

**Architecture:** Add `electron/utils/digital-employee-hydration.ts` for sidecar I/O, workspace classification (sidecar strong / TODO+SOUL+AGENTS weak), IDENTITY parsing, and assembling hydrate records. Expose `GET /api/employees/hydrate` in `electron/api/routes/agents.ts` using `listAgentsSnapshot()`. Extend provision handler to reject duplicates via workspace scan and to write sidecar after success; extend update handler to refresh sidecar. In `src/stores/employees.ts`, add a merge API; in `src/stores/agents.ts` `fetchAgents`, call hydrate then merge then existing `reconcileWithOpenClawAgentIds`.

**Tech Stack:** TypeScript, Vitest, Zustand, existing Host HTTP API patterns in `electron/api/routes/agents.ts`.

**Spec:** [2026-04-18-employee-store-openclaw-hydration-design.md](../specs/2026-04-18-employee-store-openclaw-hydration-design.md)

---

## File map

| File | Responsibility |
|------|----------------|
| `electron/utils/digital-employee-hydration.ts` | Constants, sidecar read/write, `parseIdentityMdForHydrate`, `classifyDigitalEmployeeWorkspace`, `collectDigitalEmployeesForHydrate`, `findAgentIdForCatalogEmployeeId` |
| `electron/utils/digital-employee-workspace.ts` | Optional: re-export sidecar write if you prefer colocation; otherwise keep new logic only in hydration module |
| `electron/utils/agent-config.ts` | Call sidecar writer at end of `provisionDigitalEmployeeAgent` / `updateDigitalEmployeeAgentWorkspace` **or** keep writes only in routes (plan: **routes + shared helper** to avoid circular imports — implement writer in `digital-employee-hydration.ts` and invoke from routes after `provisionDigitalEmployeeAgent` / `updateDigitalEmployeeAgentWorkspace`) |
| `electron/api/routes/agents.ts` | `GET /api/employees/hydrate`; provision pre-check + post sidecar; update post sidecar; provision `409` response |
| `src/stores/employees.ts` | `mergeHydratedEmployees` + export `mergeHydratedEmployeesRows` pure function for tests |
| `src/stores/agents.ts` | `fetchAgents`: hydrate → merge → reconcile; catch hydrate errors without blocking reconcile |
| `src/stores/employees.ts` `addEmployee` | On provision response `409` + `existingAgentId`, trigger `fetchAgents()` (or hydrate-only) and toast i18n message |
| `tests/unit/digital-employee-hydration.test.ts` | FS fixtures under temp dir, classification, parse, dedupe, catalog scan |
| `tests/unit/employees-hydrate-merge.test.ts` | Pure merge + reconcile ordering |

---

### Task 1: `digital-employee-hydration` core (sidecar + classification + parse)

**Files:**
- Create: `electron/utils/digital-employee-hydration.ts`
- Test: `tests/unit/digital-employee-hydration.test.ts`

**Constants (exact strings for tests):**

```ts
export const RCLAW_DIGITAL_EMPLOYEE_SIDECAR_FILENAME = '.rclaw-digital-employee.json';
export const RCLAW_TODO_MARKER = '由 RClaw 数字员工系统生成';
export const HYDRATE_SYNTHETIC_ID_PREFIX = 'local-openclaw:';
```

**Sidecar type:**

```ts
export type DigitalEmployeeSidecarV1 = {
  version: 1;
  catalogEmployeeId: string;
  skills?: string[];
};
```

**Functions to implement:**

1. `readDigitalEmployeeSidecar(absWorkspaceDir: string): Promise<DigitalEmployeeSidecarV1 | null>` — read JSON; validate `version === 1` and non-empty `catalogEmployeeId`; on malformed return `null` and log warn.

2. `writeDigitalEmployeeSidecar(absWorkspaceDir: string, payload: DigitalEmployeeSidecarV1): void` — `mkdirSync` recursive, `writeFileSync` UTF-8.

3. `async function workspaceLooksLikeDigitalEmployeeWeak(absWorkspaceDir: string): Promise<boolean>` — return true iff:
   - `TODO.md` exists and contains `RCLAW_TODO_MARKER`, and
   - `SOUL.md` exists with `trim().length > 0`, and
   - `AGENTS.md` exists with `trim().length > 0`.  
   Use `readFile` with `ENOENT` → false for each path (no full-file read of huge files needed for first check: for SOUL/AGENTS you may read once and check trim).

4. `parseIdentityMdForHydrate(content: string): { nameZh: string; name: string; emoji: string; vibe: string } | null` — parse lines matching `buildIdentityMd` in `digital-employee-workspace.ts`:
   - `- Name: ...` → nameZh
   - `- Creature: 数字员工（职能角色：...）` — extract role inside `职能角色：` and `）` → `name` (role title)
   - `- Vibe: ...` → vibe (allow `（可随对话补充）` as default)
   - `- Emoji: ...` → emoji (allow `—`)  
   If `Name` line missing, return `null`.

5. `export async function classifyDigitalEmployeeWorkspace(agentId: string, absWorkspaceDir: string): Promise<'strong' | 'weak' | 'none'>` — strong if sidecar readable; else weak if weak check passes; else none.

- [ ] **Step 1:** Add `digital-employee-hydration.ts` with the above exports (stubs throwing are OK until Step 3).

- [ ] **Step 2:** Add failing tests: (a) `classifyDigitalEmployeeWorkspace` strong with only sidecar + empty TODO; (b) weak with TODO marker + SOUL + AGENTS no sidecar; (c) none for `main`-like folder with none; (d) `parseIdentityMdForHydrate` happy path and null.

```bash
pnpm exec vitest run tests/unit/digital-employee-hydration.test.ts
```

Expected: FAIL until implementations exist.

- [ ] **Step 3:** Implement until tests pass.

- [ ] **Step 4:** Commit: `git add electron/utils/digital-employee-hydration.ts tests/unit/digital-employee-hydration.test.ts && git commit -m "feat(electron): digital employee workspace classification and sidecar"`

---

### Task 2: `collectDigitalEmployeesForHydrate` + `findAgentIdForCatalogEmployeeId`

**Files:**
- Modify: `electron/utils/digital-employee-hydration.ts`
- Modify: `tests/unit/digital-employee-hydration.test.ts`

**Import** `readWorkspaceSoulAgentsMd` from `./digital-employee-workspace`, `readFile` for `IDENTITY.md`.

**Implement:**

```ts
import type { AgentsSnapshot } from './agent-config';

export type HydratedEmployeePayload = {
  linkedAgentId: string;
  id: string;
  name: string;
  nameZh: string;
  description: string;
  descriptionZh?: string;
  color: string;
  emoji: string;
  vibe: string;
  vibeZh?: string;
  department: string;
  soulContent?: string;
  agentsContent?: string;
  identityContent?: string;
  skills?: string[];
  skipCatalogDetailFetch: boolean;
};

const HYDRATE_FALLBACK_COLOR = '#6366f1';
```

`buildMinimalEmployeeRow(linkedAgentId: string, snapshotDisplayName: string): HydratedEmployeePayload` — synthetic id `HYDRATE_SYNTHETIC_ID_PREFIX + linkedAgentId`, `name` and `nameZh` = `snapshotDisplayName`, `description` `''`, `emoji` `'—'`, `vibe` `'（可随对话补充）'`, `department` `'custom'`, `skipCatalogDetailFetch` true.

`export async function collectDigitalEmployeesForHydrate(snapshot: AgentsSnapshot): Promise<HydratedEmployeePayload[]>`:

- Iterate `snapshot.agents`.
- Resolve `absWorkspaceDir` from `entry.workspace` (already absolute or expand — **match existing code**: use same resolution as `readWorkspaceSoulAgentsMd` which uses `expandPath(\`~/.openclaw/workspace-${id}\`)` — prefer **agent `id` + expandPath** for consistency with `readWorkspaceSoulAgentsMd`, and use `entry.workspace` only if you verify it matches project patterns; **simplest safe approach**: use `expandPath(\`~/.openclaw/workspace-${entry.id}\`)` like `readWorkspaceSoulAgentsMd`).

- `const cls = await classifyDigitalEmployeeWorkspace(entry.id, absWorkspaceDir)`; if `none` continue.

- Read sidecar if strong; read soul/agents via `readWorkspaceSoulAgentsMd(entry.id)`; read `IDENTITY.md` full text for `identityContent` and parse fields.

- Build row:
  - **strong:** `id = sidecar.catalogEmployeeId`, `skills = sidecar.skills`, `skipCatalogDetailFetch: false` (catalog id known — safe to allow catalog fetches if UI needs; spec allows; **set false** when real catalog id present).
  - **weak:** `id = HYDRATE_SYNTHETIC_ID_PREFIX + entry.id`, `skipCatalogDetailFetch: true`.
  - Fill `nameZh`, `name` from parse or fallback `entry.name`; `identityContent` = full IDENTITY file string or `''` if missing.

- Dedupe by `linkedAgentId` (keep first); if duplicate in input log `console.warn`.

`export async function findAgentIdForCatalogEmployeeId(catalogEmployeeId: string, snapshot: AgentsSnapshot): Promise<string | null>` — trim catalog id; for each agent, resolve workspace dir, read sidecar; if `catalogEmployeeId` matches return `entry.id`; else null.

- [ ] **Step 1:** Test `findAgentIdForCatalogEmployeeId` with two workspaces, one sidecar matching.

- [ ] **Step 2:** Test `collectDigitalEmployeesForHydrate` returns one row for weak workspace and correct synthetic id.

- [ ] **Step 3:** Run `pnpm exec vitest run tests/unit/digital-employee-hydration.test.ts` — PASS.

- [ ] **Step 4:** Commit.

---

### Task 3: `GET /api/employees/hydrate`

**Files:**
- Modify: `electron/api/routes/agents.ts` (before `return false`, after workspace-md handler or grouped with employees routes)
- Test: extend `tests/unit/agents-routes.test.ts` **or** add `tests/unit/employees-hydrate-route.test.ts` that imports handler with mocks

**Behavior:**

```ts
if (url.pathname === '/api/employees/hydrate' && req.method === 'GET') {
  try {
    const snapshot = await listAgentsSnapshot();
    const { collectDigitalEmployeesForHydrate } = await import('@electron/utils/digital-employee-hydration');
    const employees = await collectDigitalEmployeesForHydrate(snapshot);
    sendJson(res, 200, { success: true, employees });
  } catch (error) {
    console.error('[agents] GET /api/employees/hydrate failed:', error);
    sendJson(res, 500, { success: false, error: String(error) });
  }
  return true;
}
```

- [ ] **Step 1:** Implement route.

- [ ] **Step 2:** Manual or unit test: mock `listAgentsSnapshot` + mock `collectDigitalEmployeesForHydrate` if needed; assert 200 shape.

- [ ] **Step 3:** Commit.

---

### Task 4: Sidecar writes on provision / update + duplicate provision guard

**Files:**
- Modify: `electron/api/routes/agents.ts`
- Modify: `electron/utils/digital-employee-hydration.ts` (reuse `writeDigitalEmployeeSidecar`)

**Provision `POST /api/employees/provision`:**

- After parsing `employeeId`, before `provisionDigitalEmployeeAgent`:

```ts
const snapshot = await listAgentsSnapshot();
const existing = await findAgentIdForCatalogEmployeeId(employeeId, snapshot);
if (existing) {
  sendJson(res, 409, {
    success: false,
    error: 'catalog_employee_already_provisioned',
    existingAgentId: existing,
  });
  return true;
}
```

- After successful `provisionDigitalEmployeeAgent` (you have `result.agentId` and `result.workspacePath`):

```ts
writeDigitalEmployeeSidecar(result.workspacePath, {
  version: 1,
  catalogEmployeeId: employeeId,
  skills: requested.length > 0 ? requested : undefined,
});
```

Use the **same** `requested` / normalized skills array already computed for allowlist.

**Update `POST /api/employees/update`:**

- After `updateDigitalEmployeeAgentWorkspace` succeeds, `writeDigitalEmployeeSidecar(expandPath(\`~/.openclaw/workspace-${linkedAgentId}\`), { version: 1, catalogEmployeeId: body.employeeId.trim(), skills: ... })` — use normalized skill slugs if you have them; if skills omitted in body, either read current allowlist or omit `skills` field in sidecar (spec optional).

- [ ] **Step 1:** Implement duplicate guard + sidecar writes.

- [ ] **Step 2:** Unit test `findAgentIdForCatalogEmployeeId` already covers scan; add route-level test with mocked snapshot + mock provision path optional.

- [ ] **Step 3:** Commit.

---

### Task 5: Renderer merge + `fetchAgents` ordering

**Files:**
- Modify: `src/stores/employees.ts`
- Modify: `src/stores/agents.ts`
- Create: `tests/unit/employees-hydrate-merge.test.ts`

**Pure merge** (export from `employees.ts`):

```ts
import type { Employee, HostHydratedEmployee } from '@/types/employee';

export function mergeHydratedEmployeesRows(current: Employee[], hydrated: HostHydratedEmployee[]): Employee[] {
  const byLinked = new Map<string, Employee>();
  for (const e of current) {
    const lid = e.linkedAgentId?.trim();
    if (lid) byLinked.set(lid, e);
  }
  for (const h of hydrated) {
    const lid = h.linkedAgentId.trim();
    if (!lid) continue;
    const prev = byLinked.get(lid);
    const merged: Employee = {
      ...(prev ?? {}),
      ...h,
      linkedAgentId: lid,
    } as Employee;
    byLinked.set(lid, merged);
  }
  return Array.from(byLinked.values());
}
```

Adjust `HydratedEmployeePayload` — either duplicate type in renderer or share via small `types` module; **pragmatic**: define a `HostHydratedEmployee` interface in `src/types/employee.ts` mirroring payload fields, cast API response.

Add to `src/types/employee.ts` an interface `HostHydratedEmployee` with the same fields as `HydratedEmployeePayload` from the electron module (copy field list to avoid cross-layer imports).

**Store action:**

```ts
mergeHydratedEmployees: (hydrated: HostHydratedEmployee[]) => void;
```

Implementation: `set((s) => ({ myEmployees: mergeHydratedEmployeesRows(s.myEmployees, hydrated) }));` — do **not** clear `selectedEmployee` here; reconcile may adjust.

**`fetchAgents` in `src/stores/agents.ts`:**

After successful `hostApiFetch('/api/agents')` and `set({...applySnapshot})`:

```ts
try {
  const hydrateRes = await hostApiFetch<{ success?: boolean; employees?: HostHydratedEmployee[] }>('/api/employees/hydrate');
  if (hydrateRes.success && Array.isArray(hydrateRes.employees)) {
    useEmployeesStore.getState().mergeHydratedEmployees(hydrateRes.employees);
  }
} catch (e) {
  console.warn('[agents] hydrate failed:', e);
}
const agentIds = (snapshot.agents ?? []).map((a) => a.id);
useEmployeesStore.getState().reconcileWithOpenClawAgentIds(agentIds);
```

Remove duplicate `reconcile` call — **replace** the single post-fetch reconcile with the above block so order is always hydrate → reconcile.

- [ ] **Step 1:** Add failing merge test (two rows merge by linked id).

- [ ] **Step 2:** Implement merge + `fetchAgents` change.

- [ ] **Step 3:** `pnpm exec vitest run tests/unit/employees-hydrate-merge.test.ts` and `pnpm run typecheck`.

- [ ] **Step 4:** Commit.

---

### Task 6: `addEmployee` handles `409` duplicate provision

**Files:**
- Modify: `src/stores/employees.ts`

After `hostApiFetch('/api/employees/provision', ...)`:

- If response status 409 or body `error === 'catalog_employee_already_provisioned'` and `existingAgentId`:

```ts
toast.message(/* i18n: already added, syncing */);
void useAgentsStore.getState().fetchAgents();
return false;
```

Use existing toast patterns (`sonner`). Add i18n keys if the project uses `t()` for employee errors.

- [ ] **Step 1:** Implement (parse JSON body on failure — may need `hostApiFetch` to expose status; if wrapper only throws, extend wrapper or use raw fetch for this path).

- [ ] **Step 2:** Manual smoke: duplicate provision attempt shows toast + list fills after fetch.

- [ ] **Step 3:** Commit.

---

### Task 7: Verification gate

- [ ] **Step 1:** `pnpm run typecheck` — expect exit 0.

- [ ] **Step 2:** `pnpm test` — expect all pass.

- [ ] **Step 3:** `pnpm run lint` — fix any new issues in touched files.

- [ ] **Step 4:** Final commit if fixes needed.

---

## Plan self-review (spec coverage)

| Spec section | Task |
|--------------|------|
| GET hydrate API | Task 3 |
| Order: hydrate → reconcile | Task 5 |
| Strong/weak workspace | Tasks 1–2 |
| Sidecar + provision/update | Task 4 |
| Synthetic id prefix | Task 2 |
| Merge by linkedAgentId | Task 5 |
| Duplicate catalog provision | Tasks 4, 6 |
| Errors: skip agent, parse fallback | Task 2 (implementation), Task 5 hydrate catch |
| Tests | Tasks 1–2, 5, 7 |

**Placeholder scan:** None intentional; all file paths concrete.

**Type consistency:** Use one `HostHydratedEmployee` / `HydratedEmployeePayload` name pair across electron vs renderer with matching fields to satisfy `Employee`.

---

**Plan complete and saved to `docs/superpowers/plans/2026-04-18-employee-store-openclaw-hydration.md`. Two execution options:**

1. **Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration  
2. **Inline Execution** — execute tasks in this session using executing-plans, batch execution with checkpoints  

**Which approach?**
