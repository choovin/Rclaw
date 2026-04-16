# 编辑前读取工作区 SOUL/AGENTS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用户点击员工详情「编辑内容」时，先从 `~/.openclaw/workspace-${linkedAgentId}` 读取 `SOUL.md` / `AGENTS.md`，成功则合并进 `myEmployees`（及 `selectedEmployee`）后再打开编辑弹窗；失败则 toast 降级打开。

**Architecture:** Electron `agents` 路由增加只读 `GET`；主进程用 `fs.readFile`（或 promises）按路径读 UTF-8；前端 `hostApiFetch` + 小封装函数；`useEmployeesStore` 增加纯合并 action；`EmployeeDetail` 异步处理点击与 loading。

**Tech Stack:** Node `fs`/`fs/promises`、`expandPath`、`listConfiguredAgentIds`、`hostApiFetch`、Zustand、Vitest。

**权威规格：** `docs/superpowers/specs/2026-04-16-employee-edit-read-soul-agents-from-disk-design.md`

---

## 文件映射

| 职责 | 路径 |
|------|------|
| HTTP 路由 | `electron/api/routes/agents.ts`（或集中路由注册处，与现有 `POST` 并列） |
| 读盘逻辑（可选独立） | `electron/utils/digital-employee-workspace.ts` 新增 `readWorkspaceSoulAgentsMd(agentId)` 返回 `{ soulContent, agentsContent }` |
| Store action | `src/stores/employees.ts` |
| API 封装 | `src/lib/employee-workspace-md.ts`（新建）或 `src/lib/host-api` 旁 |
| UI | `src/pages/Agents/EmployeeDetail.tsx` |
| i18n | `src/i18n/locales/zh|en|ja/employees.json` |
| 单元测试 | `tests/unit/employees-store.test.ts` 若已有则扩展，否则新建轻量测试；可选 `EmployeeDetail` 行为 mock |

---

### Task 1: 主进程读文件 + GET 路由

**Files:**
- Modify: `electron/api/routes/agents.ts`
- Modify or create: `electron/utils/digital-employee-workspace.ts`

- [ ] **Step 1:** 在 `digital-employee-workspace.ts` 导出异步函数（示例签名）：

```ts
export async function readWorkspaceSoulAgentsMd(agentId: string): Promise<{
  soulContent: string;
  agentsContent: string;
}> {
  const dir = expandPath(`~/.openclaw/workspace-${agentId.trim()}`);
  const soulPath = join(dir, 'SOUL.md');
  const agentsPath = join(dir, 'AGENTS.md');
  const readUtf8 = async (p: string): Promise<string> => {
    try {
      return await readFile(p, 'utf8');
    } catch (e: unknown) {
      const code = (e as NodeJS.ErrnoException)?.code;
      if (code === 'ENOENT') return '';
      throw e;
    }
  };
  const [soulContent, agentsContent] = await Promise.all([readUtf8(soulPath), readUtf8(agentsPath)]);
  return { soulContent, agentsContent };
}
```

（按需补充 `join`、`readFile` 来源 `fs/promises`。）

- [ ] **Step 2:** 在 `agents.ts` 中处理 `GET /api/employees/workspace-md`：`URL` 解析 `linkedAgentId` query；`mustTrimNonEmpty`；`listConfiguredAgentIds()` 校验包含该 id；调用 `readWorkspaceSoulAgentsMd`；`sendJson(200, { success: true, soulContent, agentsContent })`。异常时 `success: false` + `error`。

- [ ] **Step 3:** `pnpm run typecheck`

- [ ] **Step 4:** Commit

```bash
git add electron/utils/digital-employee-workspace.ts electron/api/routes/agents.ts
git commit -m "feat(agents): GET workspace-md 读取 SOUL/AGENTS"
```

---

### Task 2: Zustand `applyWorkspaceSoulAgentsFromDisk`

**Files:**
- Modify: `src/stores/employees.ts`

- [ ] **Step 1:** 扩展 `EmployeesState`：

```ts
applyWorkspaceSoulAgentsFromDisk: (
  employeeId: string,
  payload: { soulContent: string; agentsContent: string },
) => void;
```

- [ ] **Step 2:** 实现：`set` 内 `myEmployees.map` 合并 `id === employeeId` 的 `soulContent`/`agentsContent`；若 `selectedEmployee?.id === employeeId` 则同样合并到 `selectedEmployee`。

- [ ] **Step 3:** `pnpm run typecheck`

- [ ] **Step 4:** Commit

```bash
git add src/stores/employees.ts
git commit -m "feat(employees): applyWorkspaceSoulAgentsFromDisk"
```

---

### Task 3: 前端封装与 i18n

**Files:**
- Create: `src/lib/employee-workspace-md.ts`
- Modify: `src/i18n/locales/zh/employees.json` 等

- [ ] **Step 1:** 封装：

```ts
export async function fetchEmployeeWorkspaceMd(linkedAgentId: string): Promise<{
  success: boolean;
  soulContent?: string;
  agentsContent?: string;
  error?: string;
}> {
  const q = new URLSearchParams({ linkedAgentId: linkedAgentId.trim() }).toString();
  return hostApiFetch(`/api/employees/workspace-md?${q}`) as Promise<...>;
}
```

- [ ] **Step 2:** 新增 i18n key，例如 `workspaceMdReadFailed`（中/英/日一句说明读盘失败已用缓存）。

- [ ] **Step 3:** Commit

---

### Task 4: `EmployeeDetail` 异步打开编辑

**Files:**
- Modify: `src/pages/Agents/EmployeeDetail.tsx`

- [ ] **Step 1:** 增加 state：`editMdLoading`（boolean）。

- [ ] **Step 2:** 将「编辑内容」`onClick` 改为 `async`：`setEditMdLoading(true)` → `fetchEmployeeWorkspaceMd(linkedAgentId)` → 若 `success` 则 `applyWorkspaceSoulAgentsFromDisk(employee.id, { soulContent, agentsContent })` → `setEditDialogOpen(true)`；否则 `toast.error(t('workspaceMdReadFailed'))` 并仍 `setEditDialogOpen(true)`。`finally` 中 `setEditMdLoading(false)`。

- [ ] **Step 3:** 编辑按钮 `disabled={editMdLoading}`，loading 时显示 `Loader2`（与现有按钮风格一致）。

- [ ] **Step 4:** 确认 `editTarget` 在 store 更新后由 `useEmployeesStore` 订阅拿到新 `linkedRow`：`editTarget` 已用 `useMemo` 依赖 `myEmployees` 时，打开弹窗 step 应在 `apply` 之后，React 重渲染后 `editTarget` 含新 soul/agents；若 `editTarget` 仅从 props 的 `employee` 派生，需改为优先 `myEmployees.find`（与规格「来自更新后的 store」一致）。

- [ ] **Step 5:** `pnpm run typecheck` + `pnpm test`（相关单测）

- [ ] **Step 6:** Commit

```bash
git add src/pages/Agents/EmployeeDetail.tsx src/lib/employee-workspace-md.ts src/i18n/...
git commit -m "feat(employees): 编辑前读盘并合并 store 后打开弹窗"
```

---

### Task 5: 测试与自检

- [ ] **Step 1:** Store 单元测试：`applyWorkspaceSoulAgentsFromDisk` 合并字段与 `selectedEmployee` 分支。

- [ ] **Step 2:** 可选：mock `fetchEmployeeWorkspaceMd` 测 `EmployeeDetail` 点击流程（若成本过高可仅保留 store 测）。

- [ ] **Step 3:** `pnpm run lint`（或仅 touched 文件）与 `pnpm run typecheck`。

---

## Spec 覆盖核对

| 规格 | Task |
|------|------|
| GET 读 SOUL/AGENTS | Task 1 |
| 成功写回 myEmployees | Task 2 + 4 |
| 失败 toast + 仍打开 | Task 3 + 4 |
| 不解析 IDENTITY | Task 1 仅两文件 |

---

## Execution handoff

计划保存于 `docs/superpowers/plans/2026-04-16-employee-edit-read-soul-agents-from-disk.md`。

**1. Subagent-Driven（推荐）** — 按 Task 分步实现并复核  

**2. Inline** — 本会话连续实现  

需要我直接在仓库里按该计划实现代码时，回复即可。
