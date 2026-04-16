# 员工详情编辑数字员工 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在已添加且已关联 OpenClaw Agent 的员工详情中提供「编辑」入口，弹出与「创建数字员工」同结构的弹窗，保存后单次 API 更新工作区文件、展示名、技能白名单与 Gateway 重载，并同步 `myEmployees` 持久化。

**Architecture:** 在 `electron/utils/agent-config.ts`（或并列模块）新增「对已存在 `linkedAgentId` 写工作区 + 改名」的纯函数；在 `electron/api/routes/agents.ts` 增加 `POST /api/employees/update`，复用 `agent-skill-allowlist` 与 provision 相同的 slug 解析逻辑，并对「空白名单」显式 `applyAgentSkillAllowlist(agentId, null)`。前端扩展 `CreateDigitalEmployeeDialog` 支持 `mode: 'edit'` 与初始 `Employee`，`EmployeeDetail` 增加入口；`useEmployeesStore` 新增 `updateEmployee` 调用新 API。

**Tech Stack:** Electron main HTTP 路由、`hostApiFetch`、Zustand persist、React、Vitest、Playwright、i18next（`employees` / `common`）。

**权威规格：** `docs/superpowers/specs/2026-04-16-employee-detail-edit-digital-employee-design.md`

---

## 文件映射（创建 / 修改）

| 职责 | 路径 |
|------|------|
| 更新已 provision 员工的核心逻辑（写 `~/.openclaw/workspace-${id}`、调用 `updateAgentName`） | 新建或扩展 `electron/utils/agent-config.ts`（例如导出 `updateDigitalEmployeeAgentFiles`） |
| HTTP 路由、技能白名单分支、`scheduleGatewayReload` | 修改 `electron/api/routes/agents.ts` |
| Store：`updateEmployee` | 修改 `src/stores/employees.ts` |
| 弹窗 create/edit | 修改 `src/pages/Agents/CreateDigitalEmployeeDialog.tsx` |
| 详情入口 | 修改 `src/pages/Agents/EmployeeDetail.tsx` |
| 文案 | 修改 `src/i18n/locales/zh/employees.json`、`en/employees.json`、`ja/employees.json` |
| 单元测试（对话框） | 修改或新增 `tests/unit/create-digital-employee-dialog.test.tsx` |
| E2E | 新增或扩展 `tests/e2e/` 下员工相关 spec（命名与现有 `employees-*.spec.ts` 一致） |

---

### Task 1: Main 进程 — 写工作区 + 展示名

**Files:**
- Modify: `electron/utils/agent-config.ts`
- Reference: `electron/utils/digital-employee-workspace.ts`（`writeDigitalEmployeeWorkspaceFiles`、`DigitalEmployeeWorkspacePayload`）
- Reference: 现有 `updateAgentName`（约 702 行）

- [ ] **Step 1: 新增导出函数**

在 `agent-config.ts` 中新增异步函数（名称可微调，但需导出供路由调用），签名概念如下：

```ts
import { join } from 'node:path';
import { writeDigitalEmployeeWorkspaceFiles } from './digital-employee-workspace';
// expandPath 已存在

export async function updateDigitalEmployeeAgentWorkspace(
  agentId: string,
  payload: ProvisionDigitalEmployeePayload,
): Promise<{ workspacePath: string }> {
  const trimmedId = agentId.trim();
  if (!trimmedId) throw new Error('agentId must be non-empty');

  const workspacePath = expandPath(`~/.openclaw/workspace-${trimmedId}`);
  writeDigitalEmployeeWorkspaceFiles(workspacePath, {
    nameZh: payload.nameZh.trim(),
    roleTitle: payload.nameEn.trim(),
    soulContent: payload.soulContent,
    agentsContent: payload.agentsContent,
    identityContent: typeof payload.identityContent === 'string' ? payload.identityContent : '',
    emoji: payload.emoji,
    vibe: payload.vibe?.trim() ? payload.vibe.trim() : undefined,
  });

  await updateAgentName(trimmedId, payload.nameZh.trim());

  return { workspacePath };
}
```

注意：`updateAgentName` 已在同文件；若 `listAgentsSnapshot` 中不存在该 `agentId` 应先抛错（可在 Step 2 路由层用 `listConfiguredAgentIds` 或读 config 校验）。

- [ ] **Step 2: 编译检查**

Run: `pnpm run typecheck`  
Expected: 无新增类型错误。

- [ ] **Step 3: Commit**

```bash
git add electron/utils/agent-config.ts
git commit -m "feat(agent-config): 支持更新已 provision 数字员工工作区与展示名"
```

---

### Task 2: HTTP 路由 `POST /api/employees/update`

**Files:**
- Modify: `electron/api/routes/agents.ts`
- Reuse: `normalizeProvisionSkillSlugs`、`ensureSlugsViaClawHub`、`applyAgentSkillAllowlist`（已 import）
- Reuse: `syncAllProviderAuthToRuntime`、`scheduleGatewayReload`

- [ ] **Step 1: 在 `POST /api/employees/provision` 同文件内、`return true` 之前增加新分支**

`url.pathname === '/api/employees/update' && req.method === 'POST'`：

1. `parseJsonBody` 字段：`employeeId`、`linkedAgentId`、`nameZh`、`nameEn`、`soulContent`、`agentsContent`、`identityContent`、`emoji`、`vibe`、`skills`（可选），校验规则与 provision 对齐（非空 trim 等）。
2. 确认 `linkedAgentId` 在 OpenClaw 配置中存在（与删除 agent 前校验方式一致即可）。
3. 调用 Task 1 的 `updateDigitalEmployeeAgentWorkspace(linkedAgentId, { ... })`。
4. 技能：

```ts
const requested = normalizeProvisionSkillSlugs(body.skills);
if (requested.length > 0) {
  const resolved = await ensureSlugsViaClawHub(requested, ctx.clawHubService, {
    employeeId,
    agentId: linkedAgentId,
  });
  if (resolved.length > 0) {
    await applyAgentSkillAllowlist(linkedAgentId, resolved);
  } else {
    await applyAgentSkillAllowlist(linkedAgentId, null);
    console.warn('[agents] All skill slugs failed on employee update; clearing per-agent allowlist', {
      employeeId,
      agentId: linkedAgentId,
    });
  }
} else {
  await applyAgentSkillAllowlist(linkedAgentId, null);
}
```

（空数组表示用户清空白名单、恢复继承，与规格一致。）

5. `syncAllProviderAuthToRuntime().catch(...)` 与 `scheduleGatewayReload(ctx, 'update-employee')`。
6. `sendJson(res, 200, { success: true, employeeId, agentId: linkedAgentId })`。

- [ ] **Step 2: 运行 typecheck**

Run: `pnpm run typecheck`

- [ ] **Step 3: Commit**

```bash
git add electron/api/routes/agents.ts
git commit -m "feat(agents): POST /api/employees/update 更新数字员工与技能白名单"
```

---

### Task 3: Zustand `updateEmployee`

**Files:**
- Modify: `src/stores/employees.ts`

- [ ] **Step 1: 扩展 `EmployeesState` 与实现体**

新增：

```ts
updateEmployee: (
  employeeId: string,
  patch: Employee,
) => Promise<boolean>;
```

实现要点：

1. `hostApiFetch('/api/employees/update', { method: 'POST', body: JSON.stringify({ employeeId, linkedAgentId: patch.linkedAgentId, nameZh: patch.nameZh, nameEn: patch.name, soulContent: patch.soulContent ?? '', agentsContent: patch.agentsContent ?? '', identityContent: patch.identityContent ?? '', emoji: patch.emoji, vibe: patch.vibeZh ?? patch.vibe, skills: patch.skills }) })`（字段名与路由 `parseJsonBody` 一致；`nameEn` 使用 `patch.name`，与创建时 `name`/`nameZh` 同源逻辑一致）。
2. 成功后将 `myEmployees` 中 `id === employeeId` 的项替换为合并后的 `Employee`（保留 `id`、`linkedAgentId` 不变）。
3. `useAgentsStore.getState().fetchAgents()`。
4. 返回 `true`/`false`，错误时 `console.error`。

- [ ] **Step 2: 单元测试（可选轻量）**

若已有 `employees` store 测试文件则扩展；否则以 Task 6 对话框测试为主。

- [ ] **Step 3: Commit**

```bash
git add src/stores/employees.ts
git commit -m "feat(employees): store 支持 updateEmployee 调用更新 API"
```

---

### Task 4: `CreateDigitalEmployeeDialog` 编辑模式

**Files:**
- Modify: `src/pages/Agents/CreateDigitalEmployeeDialog.tsx`
- May modify: `src/pages/Agents/index.tsx` 或调用方，传入 props

- [ ] **Step 1: Props**

```ts
export type CreateDigitalEmployeeDialogProps = {
  onClose: () => void;
  mode?: 'create' | 'edit';
  initialEmployee?: Employee | null;
};
```

`mode === 'edit'` 时要求 `initialEmployee?.linkedAgentId`。

- [ ] **Step 2: `useState` 初始值**

`useMemo`/`useEffect` 在 `edit` 下用 `initialEmployee` 填充 `nameZh`、`vibe`、`soulContent`、`agentsContent`、`emoji`、`color`、`skillSelections`（由 `initialEmployee.skills` 映射为 `SelectedEmployeeSkill[]` 时，若仅有 slug 可只填 slug，与 `CreateEmployeeSkillField` 兼容方式查阅该组件）。

- [ ] **Step 3: `handleSubmit` 分支**

- `create`：保持现有 `addEmployee`。
- `edit`：构造 `Employee` 对象（与创建分支相同字段赋值），**强制** `id: initialEmployee.id`、`linkedAgentId: initialEmployee.linkedAgentId`，调用 `updateEmployee`，成功则 `toast.success` + `onClose()`。

- [ ] **Step 4: 标题与按钮 i18n key**

新增 key 如 `createDigitalEmployee.editTitle`、`editSave`（中英日）。

- [ ] **Step 5: Commit**

```bash
git add src/pages/Agents/CreateDigitalEmployeeDialog.tsx src/i18n/locales/zh/employees.json src/i18n/locales/en/employees.json src/i18n/locales/ja/employees.json
git commit -m "feat(ui): 创建数字员工弹窗支持编辑模式"
```

---

### Task 5: `EmployeeDetail` 入口与状态

**Files:**
- Modify: `src/pages/Agents/EmployeeDetail.tsx`

- [ ] **Step 1: 条件渲染**

当 `isAdded && linkedAgentId` 为真时，增加按钮（在「运行时设置」附近或上方），`onClick` 设置 `editDialogOpen` 为 true。

- [ ] **Step 2: 挂载弹窗**

`editDialogOpen && <CreateDigitalEmployeeDialog mode="edit" initialEmployee={linkedRow ?? employee} onClose={() => setEditDialogOpen(false)} />`（优先 `myEmployees` 行）。

- [ ] **Step 3: `data-testid`**

为按钮与编辑弹窗根节点增加 testid，供 E2E 使用。

- [ ] **Step 4: Commit**

```bash
git add src/pages/Agents/EmployeeDetail.tsx
git commit -m "feat(ui): 员工详情已添加员工可打开编辑弹窗"
```

---

### Task 6: 单元测试 — 对话框编辑模式

**Files:**
- Modify: `tests/unit/create-digital-employee-dialog.test.tsx`

- [ ] **Step 1: Mock `updateEmployee`**

```ts
const updateEmployee = vi.fn().mockResolvedValue(true);
vi.mock('@/stores/employees', () => ({
  useEmployeesStore: () => ({
    addEmployee: vi.fn(),
    updateEmployee,
  }),
}));
```

- [ ] **Step 2: 用例 `edit mode calls updateEmployee`**

渲染 `mode="edit"` + 带 `linkedAgentId` 的 `initialEmployee`，修改名称后提交，断言 `updateEmployee` 被调用且 payload 含 `linkedAgentId`。

- [ ] **Step 3: Run**

Run: `pnpm test tests/unit/create-digital-employee-dialog.test.tsx`

- [ ] **Step 4: Commit**

```bash
git add tests/unit/create-digital-employee-dialog.test.tsx
git commit -m "test: CreateDigitalEmployeeDialog 编辑模式提交"
```

---

### Task 7: E2E（Playwright）

**Files:**
- Create or modify: `tests/e2e/employees-edit-digital-employee.spec.ts`（若项目要求合并到现有文件则并入 `tests/e2e/employees-create-digital-employee.spec.ts`）

- [ ] **Step 1: 用例骨架**

1. 导航到 Agents → 我的员工（与现有 employees E2E 相同的 `beforeEach` / 登录假设）。
2. 准备一条已添加员工（可通过 UI 创建数字员工或与现有 spec 相同的 fixture）。
3. 打开详情 → 点击编辑 → 断言弹窗 `data-testid` 可见。
4. 修改名称或 vibe → 保存 → 断言成功 toast 或详情展示更新（择一稳定断言）。

- [ ] **Step 2: Run**

Run: `pnpm run test:e2e -- tests/e2e/employees-edit-digital-employee.spec.ts`

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/employees-edit-digital-employee.spec.ts
git commit -m "test(e2e): 数字员工详情编辑弹窗"
```

---

### Task 8: 自检与收尾

- [ ] **Step 1:** `pnpm run lint` 与 `pnpm run typecheck` 通过。
- [ ] **Step 2:** 对照规格 `2026-04-16-employee-detail-edit-digital-employee-design.md` 逐条勾选（API、不变更 `linkedAgentId`、技能清空、`fetchAgents`）。
- [ ] **Step 3:** 若功能或流程有用户可见变化，按 `AGENTS.md` 检查 `README.md` / `README.zh-CN.md` / `README.ja-JP.md` 是否需要一句说明（本需求多为子功能，可不改）。

---

## Spec 覆盖核对（自检）

| 规格要点 | Task |
|----------|------|
| 仅已添加且 `linkedAgentId` 存在可编辑 | Task 5 |
| 弹窗与创建同结构 | Task 4、5 |
| 单次 API 写文件 + 改名 + 技能 + reload | Task 1、2 |
| `linkedAgentId` 不变 | Task 2、3、4 |
| 技能清空 → `applyAgentSkillAllowlist(null)` | Task 2 |
| i18n | Task 4、5 |
| Vitest + Playwright | Task 6、7 |

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-16-employee-detail-edit-digital-employee.md`. Two execution options:

**1. Subagent-Driven (recommended)** — 每个 Task 派生子代理，任务间人工复核，迭代快  

**2. Inline Execution** — 本会话内按 `executing-plans` 批量执行并设检查点  

你更倾向哪一种？
