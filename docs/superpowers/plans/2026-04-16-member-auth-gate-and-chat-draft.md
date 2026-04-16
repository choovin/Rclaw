# 会员登录预检、全局会话失效与聊天草稿保留 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在本地 `isLoggedIn` 为假时拦截安装技能、员工开通/更新与聊天发送并弹出登录；在 `hostApiFetch` 对会员相关路径上统一处理服务端鉴权失败（清 UI 登录态、弹登录、可 debounce 的 toast）；修复聊天发送先清空再鉴权导致草稿丢失的问题。

**Architecture:** 纯函数模块 `src/lib/host-api-member-session.ts` 维护路径允许/排除规则；`auth` store 新增 `invalidateMemberSessionAndOpenLogin()`（含 debounce，避免并行 401 刷屏）；`hostApiFetch` 在抛错前调用该逻辑，并修正 unified IPC 在 `data.status >= 400` 时改为抛错（与 legacy 行为一致，否则全局处理无法触发）；`skills`/`employees` store 在变更操作入口调用 `requireAuth()`；`ChatInput` 在清空与 `onSend` 之前 `await requireAuth()`，父组件去掉重复门控。

**Tech Stack:** TypeScript、Zustand、Vitest、Playwright；设计规格见 `docs/superpowers/specs/2026-04-16-member-auth-gate-and-chat-draft-design.md`。

---

## 文件结构

| 路径 | 职责 |
|------|------|
| `src/lib/host-api-member-session.ts` | `pathMatchesMemberSessionInvalidation(path, method)`（或等价命名）：允许列表（`/api/cloud/`、`/api/employees/provision`、`/api/employees/update`、`/api/clawhub/`）与排除列表（登录 POST、logout 等） |
| `src/lib/host-api.ts` | unified 响应在 `data.status >= 400` 时抛错；catch 中在重抛前调用会话失效处理 |
| `src/stores/auth.ts` | `invalidateMemberSessionAndOpenLogin()`；内部 `set({ isLoggedIn: false, userInfo: null, loginModalOpen: true })`，toast 可选且 debounce |
| `src/stores/skills.ts` | `installSkill` 开头 `requireAuth` |
| `src/stores/employees.ts` | `addEmployee`、`updateEmployee` 开头 `requireAuth` |
| `src/pages/Chat/ChatInput.tsx` | `handleSend` 先 `await requireAuth()`，通过后再清空并 `onSend` |
| `src/pages/Chat/index.tsx` | 移除 `handleSend` 内重复 `requireAuth`（避免双重弹窗） |
| `src/components/common/LoginModal.tsx` | 根内容区增加 `data-testid="login-modal"` 供 E2E |
| `tests/unit/host-api-member-session.test.ts` | 路径匹配表驱动测试 |
| `tests/unit/host-api.test.ts` | unified 信封 `status: 401` 时 `hostApiFetch` 抛错 |
| `tests/e2e/chat-auth-gate-draft.spec.ts`（或并入现有 chat spec） | 未登录发送后草稿仍在且出现登录 UI |

---

### Task 1: 路径规则纯函数 + 单元测试

**Files:**
- Create: `src/lib/host-api-member-session.ts`
- Create: `tests/unit/host-api-member-session.test.ts`

- [ ] **Step 1: 实现 `host-api-member-session.ts`**

约定：`path` 可先 `split('?')[0]` 再去匹配；`method` 统一 `toUpperCase()`，缺省视为 `GET`。

**返回 `true`（应对该请求的鉴权失败做「清会员态 + 弹登录」）当且仅当：**

1. 路径以 `/api/cloud/` 开头，**且**不满足排除项。
2. 或路径（无 query）等于 `/api/employees/provision`、`/api/employees/update`（方法以实际调用为准，一般为 `POST`）。
3. 或路径以 `/api/clawhub/` 开头。

**排除（永远 `false`）：**

- `POST` 且路径为 `/api/cloud/auth/login`、`/api/cloud/auth/sms-login`、`/api/cloud/auth/wechat-login`。
- `POST` 且路径为 `/api/cloud/auth/logout`（登出失败不应当作「请重新登录当前会话」链路的唯一语义；与 spec 一致）。

导出例如：

```typescript
export function shouldInvalidateMemberSessionOnAuthError(path: string, method: string): boolean {
  const p = path.split('?')[0] ?? '';
  const m = (method || 'GET').toUpperCase();

  if (m === 'POST' && (
    p === '/api/cloud/auth/login'
    || p === '/api/cloud/auth/sms-login'
    || p === '/api/cloud/auth/wechat-login'
    || p === '/api/cloud/auth/logout'
  )) {
    return false;
  }

  if (p.startsWith('/api/cloud/')) return true;
  if (p === '/api/employees/provision' || p === '/api/employees/update') return true;
  if (p.startsWith('/api/clawhub/')) return true;

  return false;
}
```

- [ ] **Step 2: 编写 Vitest 表驱动测试**

覆盖：cloud 下普通 GET= true；三个登录 POST= false；logout POST= false；`/api/employees/provision`= true；`/api/cloud/auth/status?x=1` 去掉 query 后仍命中 cloud 前缀= true；`/api/agents` = false。

运行：

```bash
pnpm test tests/unit/host-api-member-session.test.ts
```

预期：全部通过。

- [ ] **Step 3: 提交**

```bash
git add src/lib/host-api-member-session.ts tests/unit/host-api-member-session.test.ts
git commit -m "feat: 会员会话失效全局处理的路径匹配纯函数"
```

---

### Task 2: `parseUnifiedProxyResponse` 对 HTTP 4xx 抛错 + 单测

**Files:**
- Modify: `src/lib/host-api.ts`（`parseUnifiedProxyResponse`）
- Modify: `tests/unit/host-api.test.ts`

- [ ] **Step 1: 在 `parseUnifiedProxyResponse` 中，在 `trackUiEvent` 之后、解析 204/json 之前**，若 `data.status != null && data.status >= 400`，构造 `Error`：消息优先取 `data.json` 内 `error` 字符串，否则 `HTTP ${data.status}`，确保包含 `401` 或 `Unauthorized` 等以便 `normalizeAppError` 得到 `AUTH_INVALID`（与 legacy 路径一致）。

- [ ] **Step 2: 新增单测** `invokeIpcMock.mockResolvedValueOnce({ ok: true, data: { status: 401, ok: false, json: { error: 'Unauthorized' } } })`，期望 `hostApiFetch('/api/cloud/foo')` **rejects**，且 message 可被归类为鉴权失败。

运行：

```bash
pnpm test tests/unit/host-api.test.ts
pnpm run typecheck
```

预期：通过、无类型错误。

- [ ] **Step 3: 提交**

```bash
git add src/lib/host-api.ts tests/unit/host-api.test.ts
git commit -m "fix(host-api): unified IPC 对 4xx 抛错以统一错误处理"
```

---

### Task 3: `auth` store 与会话失效入口

**Files:**
- Modify: `src/stores/auth.ts`

- [ ] **Step 1: 扩展 `AuthState` 与实现 `invalidateMemberSessionAndOpenLogin`**

行为：

- `set({ isLoggedIn: false, userInfo: null, loginModalOpen: true })`。
- 使用模块级 `lastMemberSessionToastAt`（或 store 外闭包）：若距离上次 toast 不足 2s 则跳过 `toast.error`；否则提示一条简短中文，例如「登录已失效，请重新登录」。
- 若 `loginModalOpen` 已为 `true`，仍可更新 `userInfo`/`isLoggedIn`，避免重复创建弹窗层（仅一次 `set` 即可）。

- [ ] **Step 2: 类型检查**

```bash
pnpm run typecheck
```

- [ ] **Step 3: 提交**

```bash
git add src/stores/auth.ts
git commit -m "feat(auth): 会员会话失效时清状态并打开登录"
```

---

### Task 4: `hostApiFetch` 全局鉴权失败分支

**Files:**
- Modify: `src/lib/host-api.ts`
- Import: `AppError` from `@/lib/error-model`（若需 `instanceof` 判断）
- Import: `shouldInvalidateMemberSessionOnAuthError` from `@/lib/host-api-member-session`

- [ ] **Step 1: 新增内部函数 `handleMemberSessionInvalidIfNeeded(err: unknown, path: string, method: string): void`**

逻辑：

- 若 `err` 不是 `AppError`，return。
- 若 `err.code !== 'AUTH_INVALID'`（若后续对 401 增强 `details.status`，可在此放宽条件），return。
- 若 `!shouldInvalidateMemberSessionOnAuthError(path, method)`，return。
- `void import('@/stores/auth').then((m) => { m.useAuthStore.getState().invalidateMemberSessionAndOpenLogin(); })`，避免静态 import 循环依赖。

- [ ] **Step 2: 在 `hostApiFetch` 的两处 `catch` 中**（IPC 与 browser fallback），在 `throw normalized` 之前调用 `handleMemberSessionInvalidIfNeeded(normalized, path, method)`。

- [ ] **Step 3: 单元测试（可选但推荐）**

在 `tests/unit/host-api.test.ts` 中 mock `auth` store 或 spy `invalidateMemberSessionAndOpenLogin`：IPC 返回 legacy 401、`path` 为 `/api/cloud/platform-provider/sync` 时，断言调用了失效处理（可通过 vi.mock `@/stores/auth` 导出 spy）。

运行：

```bash
pnpm test tests/unit/host-api.test.ts
pnpm run typecheck
```

- [ ] **Step 4: 提交**

```bash
git add src/lib/host-api.ts tests/unit/host-api.test.ts
git commit -m "feat(host-api): 会员相关路径鉴权失败时统一清会话并弹登录"
```

---

### Task 5: `skills` / `employees` store 本地 `requireAuth`

**Files:**
- Modify: `src/stores/skills.ts`
- Modify: `src/stores/employees.ts`

- [ ] **Step 1: 在 `installSkill` 第一行**（在修改 `installing` state 之前）：

```typescript
if (!(await useAuthStore.getState().requireAuth())) return;
```

顶部增加：`import { useAuthStore } from '@/stores/auth';`

- [ ] **Step 2: 在 `addEmployee` 与 `updateEmployee` 开头**（在现有 early return 之后、发起网络前）同样 `await requireAuth()`，失败则 `return false`（与现有失败语义一致）。

- [ ] **Step 3: 运行 typecheck**

```bash
pnpm run typecheck
```

- [ ] **Step 4: 提交**

```bash
git add src/stores/skills.ts src/stores/employees.ts
git commit -m "feat: 安装技能与员工开通前校验本地登录态"
```

---

### Task 6: 聊天 `ChatInput` 门控顺序与父组件去重

**Files:**
- Modify: `src/pages/Chat/ChatInput.tsx`
- Modify: `src/pages/Chat/index.tsx`

- [ ] **Step 1: 在 `ChatInput.tsx` 中**给 `handleSend` 增加 `async`，在现有 `if (!canSend) return` 之后、**任何** `setInput('')` / `setAttachments([])` / `composerRef.setPlainText` 之前：

```typescript
if (!(await useAuthStore.getState().requireAuth())) return;
```

文件顶部确保已 `import { useAuthStore } from '@/stores/auth';`。

- [ ] **Step 2: 在 `Chat/index.tsx` 的 `handleSend` 中**删除对 `requireAuth` 的调用，直接调用 `sendMessage(...)`（门控仅在 `ChatInput` 一处，避免重复弹窗）。

- [ ] **Step 3: 确认 `handleSend` 传递链**：`ChatInput` 的 `onSend` 仍指向父级包装函数即可；若父级 `handleSend` 变为纯 `sendMessage`，类型保持 `(text, attachments?, target?) => void` 或 `Promise<void>` 与 `ChatInput` 一致（若 `onSend` 类型为同步，异步 `handleSend` 仍可作为 prop 传入，TypeScript 通常允许 Promise 赋给 void 返回）。

运行：

```bash
pnpm run typecheck
pnpm test tests/unit/chat-*.test.ts
```

（若无相关单测可跳过第二行。）

- [ ] **Step 4: 提交**

```bash
git add src/pages/Chat/ChatInput.tsx src/pages/Chat/index.tsx
git commit -m "fix(chat): 发送前先 requireAuth，未登录时保留输入草稿"
```

---

### Task 7: E2E — 未登录发送保留草稿

**Files:**
- Modify: `src/components/common/LoginModal.tsx`
- Create: `tests/e2e/chat-auth-gate-draft.spec.ts`

- [ ] **Step 1: `LoginModal` 内层卡片**（`relative bg-background rounded-2xl` 的 div）增加 `data-testid="login-modal"`。

- [ ] **Step 2: 新 E2E 用例**（参考 `tests/e2e/chat-skill-picker.spec.ts` 的 `skipSetupAndGoToChat`）：

1. 进入 Chat，对 `chat-composer` `fill('draft-kept-123')`。
2. `page.evaluate` 清除 `localStorage` 中 key `auth-storage`（或写入 `{ state: { isLoggedIn: false, userInfo: null }, version: 0 }` 等 zustand persist 兼容结构 —— 以实际 persist 序列化为准，优先 **removeItem('auth-storage')** 后 **reload**，再导航回 Chat）。
3. 再次 `fill` 同文案，点击发送（使用现有发送按钮 `data-testid` 或 role，与 `chat-skill-picker` 一致）。
4. 断言 `getByTestId('login-modal')` visible。
5. 断言 `chat-composer` 仍包含 `draft-kept-123`（`toContainText` 或 `inputValue` 视 composer 实现而定）。

若 reload 后 setup 重现，可仅用 `evaluate` 设置 persist 而不 reload —— 以实现稳定为准。

`test.setTimeout(180_000)` 与技能 picker 用例一致。

运行：

```bash
pnpm run test:e2e tests/e2e/chat-auth-gate-draft.spec.ts
```

预期：通过（本地需 Electron 构建产物；与仓库 CI 一致）。

- [ ] **Step 3: 提交**

```bash
git add src/components/common/LoginModal.tsx tests/e2e/chat-auth-gate-draft.spec.ts
git commit -m "test(e2e): 未登录发送保留聊天草稿并展示登录弹窗"
```

---

## Self-review（对照 spec）

| Spec 要求 | 对应任务 |
|-----------|----------|
| 本地预检：安装技能、员工开通/更新 | Task 5 |
| 全局会话失效 + 路径允许/排除 | Task 1 + 4 |
| 聊天草稿：先门控再清空 | Task 6 |
| unified 401 须抛错否则全局无效 | Task 2 |
| E2E 覆盖 UI 变更 | Task 7 |

无 TBD 占位；路径与 `docs/superpowers/specs/2026-04-16-member-auth-gate-and-chat-draft-design.md` 一致。

---

## Execution Handoff

**计划已保存至 `docs/superpowers/plans/2026-04-16-member-auth-gate-and-chat-draft.md`。可选执行方式：**

1. **Subagent-Driven（推荐）** — 每任务派生子代理，任务间评审，迭代快。需配合 **superpowers:subagent-driven-development**。
2. **Inline Execution** — 本会话内按任务执行，配合 **superpowers:executing-plans** 与检查点。

**你希望采用哪一种？**
