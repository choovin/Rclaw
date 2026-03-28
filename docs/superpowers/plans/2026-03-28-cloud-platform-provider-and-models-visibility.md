# 登录下发唯一 Custom 供应商与 Models 可见性 — 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 登录业务云后自动拉取 `GET /app-api/member/new-api/config`，将 `baseUrl`（或 `apiUrl`）与 `apiKey` 写入**唯一**一条 `custom` 供应商账号（密钥进密钥库，不明文进 `openclaw.json`），并同步 OpenClaw 运行时；登出时清除该配置；生产环境隐藏「安全模型」路由与侧栏入口。

**Architecture:**
- Main：`CloudAuthService` 用 `getValidToken()` + `cloudFetchLogged` 请求会员 config（与 `fetchMemberUser` 相同鉴权头：`Authorization: Bearer`、`tenant-id: 1`）。
- 新模块 `electron/services/cloud-platform-provider.ts`（或等价命名）封装：解析 JSON、`listProviderAccounts` 扫出需删除的其它 `vendorId === 'custom'` 账号、`createAccount`/`updateAccount` + `setDefaultAccount`，并调用 `syncSavedProviderToRuntime` / `syncUpdatedProviderToRuntime` / `syncDeletedProviderToRuntime`（与 `electron/api/routes/providers.ts` 一致），需 `GatewayManager`。
- Renderer：`cloud-api.ts` 增加 `syncPlatformProvider()` → `POST /api/cloud/platform-provider/sync`；在登录成功与 `syncAuthFromHost` 判定已登录后调用；失败 toast，不覆盖上次成功配置。
- UI：`import.meta.env.DEV` 控制侧栏项与 `/models` 路由；生产下 `Navigate` 重定向到 `/` 或 `/chat`。

**Tech Stack:** TypeScript, Electron Main Host API, React/Vite, Zustand, 现有 `ProviderService` / `provider-runtime-sync`。

**设计依据：** `docs/superpowers/specs/2026-03-28-cloud-custom-provider-and-models-visibility-design.md`

---

## 文件结构

```
新增:
  electron/shared/cloud-platform-provider-constants.ts   # ACCOUNT_ID、主模型、fallback、label
  electron/services/cloud-platform-provider.ts            # fetch config、upsert、删其它 custom、logout 清理
  tests/unit/cloud-platform-provider.test.ts              # 解析与常量（可选 env 纯函数）

修改:
  electron/services/cloud-auth.ts                         # 可选：仅导出常量路径；logout 不直接改 provider（由 route 编排）
  electron/api/routes/cloud-auth.ts                       # POST sync、logout 传 ctx，调用 cloud-platform-provider
  src/lib/cloud-api.ts                                    # syncPlatformProvider()
  src/components/common/LoginModal.tsx                    # 登录成功后 await sync
  src/stores/auth.ts                                      # syncAuthFromHost 内已登录分支调用 sync
  src/App.tsx                                             # 路由：DEV 注册 /models，PROD Redirect
  src/components/layout/Sidebar.tsx                       # nav 项按 DEV 过滤
  src/components/settings/ProvidersSettings.tsx           # PROD 禁止新增第二条 custom（过滤 vendor 或禁用「Custom」）
  docs/api-docs/04_Member_API.md                          # 补充 new-api/config 响应字段说明（若仓库尚无）
```

---

## Task 1: 共享常量

**Files:**
- Create: `electron/shared/cloud-platform-provider-constants.ts`

- [ ] **Step 1: 添加常量**

```typescript
/** 业务云下发的唯一 custom 账号 id（稳定，全仓库引用此常量） */
export const CLOUD_PLATFORM_CUSTOM_ACCOUNT_ID = 'runnode-cloud-custom';

export const CLOUD_PLATFORM_CUSTOM_LABEL = 'RunNode';

export const CLOUD_PLATFORM_PRIMARY_MODEL = 'MiniMax-M2.7-highspeed';

export const CLOUD_PLATFORM_FALLBACK_MODELS: readonly string[] = [
  'MiniMax-M2.5-highspeed',
  'MiniMax-M2.7',
  'minimax-m2.5',
  'kimi-k2.5',
  'glm-5',
] as const;

export const CLOUD_PLATFORM_API_PATH = '/app-api/member/new-api/config';
```

- [ ] **Step 2: Commit**

```bash
git add -f electron/shared/cloud-platform-provider-constants.ts
git commit -m "feat: 业务云 custom 供应商常量（账号 id、模型与回退）"
```

---

## Task 2: 解析会员 config 响应（可单测）

**Files:**
- Create: `electron/services/cloud-platform-provider.ts`（先只放解析函数）
- Create: `tests/unit/cloud-platform-provider.test.ts`

- [ ] **Step 1: 实现 `parseMemberNewApiConfig(json: unknown): { baseUrl: string; apiKey: string } | null`**

规则：HTTP 层由调用方处理；此处只解析 body。兼容常见 RunNode 包裹：`{ code: 0, data: { baseUrl, apiKey } }`；若 `data` 扁平也可。密钥字段 **`apiKey` 优先**，`platformAccessToken` 仅兼容旧文档。`baseUrl`/`apiUrl` 与密钥非空字符串才算成功。

- [ ] **Step 2: Vitest 用例**

```typescript
import { describe, it, expect } from 'vitest';
import { parseMemberNewApiConfig } from '@electron/services/cloud-platform-provider';

describe('parseMemberNewApiConfig', () => {
  it('accepts code+data wrapper', () => {
    const r = parseMemberNewApiConfig({
      code: 0,
      data: { baseUrl: 'https://api.example/v1', apiKey: 'tok' },
    });
    expect(r).toEqual({ baseUrl: 'https://api.example/v1', apiKey: 'tok' });
  });
  it('returns null if token missing', () => {
    expect(parseMemberNewApiConfig({ code: 0, data: { baseUrl: 'x' } })).toBeNull();
  });
});
```

（若将解析函数拆到 `cloud-platform-provider-parse.ts` 以减少 mock，可调整 import 路径。）

- [ ] **Step 3: 运行测试**

```bash
pnpm test -- tests/unit/cloud-platform-provider.test.ts
```

预期：全部 PASS。

- [ ] **Step 4: Commit**

```bash
git add -f electron/services/cloud-platform-provider.ts tests/unit/cloud-platform-provider.test.ts
git commit -m "feat: 解析会员 new-api/config 响应"
```

---

## Task 3: 核心同步逻辑（Main）

**Files:**
- Modify: `electron/services/cloud-platform-provider.ts`

- [ ] **Step 1: 实现 `syncCloudPlatformProviderFromMemberApi(options: { gatewayManager: GatewayManager }): Promise<{ ok: boolean; error?: string }>`**

流程：

1. `const token = await cloudAuthService.getValidToken()`；若无 token 返回 `{ ok: false, error: 'not_logged_in' }`。
2. `GET ${getCloudApiBaseUrl()}${CLOUD_PLATFORM_API_PATH}`，headers 与 `fetchMemberUser` 一致（`Authorization: Bearer ${accessToken}`、`tenant-id: 1`），使用 `cloudFetchLogged`。
3. `parseMemberNewApiConfig(await response.json())`；失败返回 `{ ok: false, error: 'invalid_config' }`。
4. `const rawAccounts = await listProviderAccounts()`（**provider-store**，非 `ProviderService.listAccounts`）。
5. 删除所有 `a.vendorId === 'custom' && a.id !== CLOUD_PLATFORM_CUSTOM_ACCOUNT_ID`：对每个调用 `getProviderService().deleteAccount(id)`，然后 **`await syncDeletedProviderToRuntime(providerAccountToConfig(existing), id, gatewayManager, undefined)`**（与 `providers.ts` DELETE 分支一致；`existing` 在 delete 前读取）。
6. 构建 `ProviderAccount`：`id: CLOUD_PLATFORM_CUSTOM_ACCOUNT_ID`，`vendorId: 'custom'`，`label: CLOUD_PLATFORM_CUSTOM_LABEL`，`authMode: 'api_key'`，`apiProtocol: 'openai-completions'`，`baseUrl`，`model: CLOUD_PLATFORM_PRIMARY_MODEL`，`fallbackModels: [...CLOUD_PLATFORM_FALLBACK_MODELS]`，`enabled: true`，`createdAt`/`updatedAt` ISO。
7. 若 `getProviderAccount(CLOUD_PLATFORM_CUSTOM_ACCOUNT_ID)` 存在：`updateAccount(id, patch, apiKey)`；否则 `createAccount(account, apiKey)`。
8. `await providerService.setDefaultAccount(CLOUD_PLATFORM_CUSTOM_ACCOUNT_ID)`；内部已 `syncDefaultProviderToRuntime`（通过现有 `PUT /api/provider-accounts/default` 路径）；此处直接调 service 后需 **`await syncDefaultProviderToRuntime(CLOUD_PLATFORM_CUSTOM_ACCOUNT_ID, gatewayManager)`**（与 routes 中 `PUT default` 一致）。请对照 `electron/api/routes/providers.ts` 中 `setDefault` 的 `syncDefaultProviderToRuntime` 调用，避免漏同步。
9. 第 7 步创建/更新时已由 Host 路由习惯调用 `syncSavedProviderToRuntime`/`syncUpdatedProviderToRuntime`——若在 service 层直接调用 `createAccount`/`updateAccount` **不会**自动 sync。因此本任务必须在 `createAccount`/`updateAccount` 之后**显式**调用与 `providers.ts` POST/PUT 相同的 `syncSavedProviderToRuntime` / `syncUpdatedProviderToRuntime`（传入 `providerAccountToConfig` 结果与 `apiKey`）。从 `electron/api/routes/providers.ts` 复制调用模式。

- [ ] **Step 2: 实现 `removeCloudPlatformProvider(gatewayManager: GatewayManager): Promise<void>`**

若 `getProviderAccount(CLOUD_PLATFORM_CUSTOM_ACCOUNT_ID)` 存在：`providerService.deleteAccount(id)` + `syncDeletedProviderToRuntime(...)`（同 DELETE 路由）。若当前默认指向该 id，`deleteProviderAccount` 已清 default（见 `provider-store.deleteProviderAccount`）；若需回退到其它供应商，调用 `pickNextDefault` 策略：**若仍有其它账号**（通过 `listProviderAccounts` 非空且非本 id）可设第一个为默认并 `syncDefaultProviderToRuntime`；**若无**，仅清空（与 spec「避免幽灵 id」一致）。具体以现有 `ProviderService`/`openclaw` 行为为准，在实现时读 `syncDeletedProviderToRuntime` 是否已处理 default model。

- [ ] **Step 3: Commit**

```bash
git add -f electron/services/cloud-platform-provider.ts
git commit -m "feat: 业务云 custom 供应商同步与移除（OpenClaw 运行时）"
```

---

## Task 4: Host API 路由

**Files:**
- Modify: `electron/api/routes/cloud-auth.ts`

- [ ] **Step 1: `handleCloudAuthRoutes` 使用 `ctx: HostApiContext`（去掉 `_ctx` 前缀）**

- [ ] **Step 2: 新增 `POST /api/cloud/platform-provider/sync`**

未登录：`sendJson` 401，`{ success: false, error: 'not_logged_in' }`。已登录：`await syncCloudPlatformProviderFromMemberApi({ gatewayManager: ctx.gatewayManager })`，返回 200 + `{ success: true }` 或 502 + `error` 消息（勿返回密钥）。

- [ ] **Step 3: 修改 `POST /api/cloud/auth/logout`**

在 `cloudAuthService.logout()` **之前或之后**调用 `await removeCloudPlatformProvider(ctx.gatewayManager)`（建议先移除 provider 再清 token，避免短暂窗口）。若移除抛错，记录 logger，仍执行 `logout()` 清 token。

- [ ] **Step 4: 手动 smoke**

启动 `pnpm dev`，登录后抓包或看日志确认请求 `new-api/config`；检查 OpenClaw / 聊天是否指向新模型。

- [ ] **Step 5: Commit**

```bash
git add -f electron/api/routes/cloud-auth.ts
git commit -m "feat(api): 业务云供应商同步与登出清理"
```

---

## Task 5: Renderer 调用与错误提示

**Files:**
- Modify: `src/lib/cloud-api.ts`
- Modify: `src/components/common/LoginModal.tsx`
- Modify: `src/stores/auth.ts`

- [ ] **Step 1: `cloudApi.syncPlatformProvider(): Promise<{ success: boolean; error?: string }>`**

`hostApiFetch('/api/cloud/platform-provider/sync', { method: 'POST' })`。

- [ ] **Step 2: `LoginModal` 在 `setLoggedIn` 成功后 `void cloudApi.syncPlatformProvider().then((r) => { if (!r.success) toast.error(...) })`**

文案可用简短中文：「模型网关配置同步失败，可稍后重试」。

- [ ] **Step 3: `auth.ts` 的 `syncAuthFromHost` 在 `status.isLoggedIn` 为 true 时 `await cloudApi.syncPlatformProvider()`**（同样失败仅 toast，不登出）。

- [ ] **Step 4: Commit**

```bash
git add src/lib/cloud-api.ts src/components/common/LoginModal.tsx src/stores/auth.ts
git commit -m "feat: 登录与启动时同步业务云模型供应商"
```

---

## Task 6: Models 页 — 仅 DEV

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/layout/Sidebar.tsx`
- Create（可选）: `src/lib/models-page-env.ts` 导出 `export const isModelsPageEnabled = import.meta.env.DEV;`

- [ ] **Step 1: `Sidebar` 中 nav 数组过滤掉 `to === '/models'` 当 `!import.meta.env.DEV`**

- [ ] **Step 2: `App.tsx` 路由**

```tsx
{import.meta.env.DEV ? (
  <Route path="/models" element={<Models />} />
) : (
  <Route path="/models" element={<Navigate to="/" replace />} />
)}
```

确保 `Navigate` 已从 `react-router-dom` 导入。

- [ ] **Step 3: 确认 `devModeUnlocked` 不会在 PROD 暴露 Models**（不新增任何 PROD 分支指向 `/models`）。

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx src/components/layout/Sidebar.tsx
git commit -m "fix: 生产环境隐藏安全模型页与侧栏入口"
```

---

## Task 7: 禁止生产环境第二条 Custom

**Files:**
- Modify: `src/components/settings/ProvidersSettings.tsx`（及 AddProviderDialog 内选择 vendor 的逻辑）

- [ ] **Step 1: 当 `import.meta.env.PROD` 且已存在 `vendorId === 'custom'` 账号（从 store 列表判断）时，禁用或隐藏「Custom / 自定义」供应商选项**

若产品要求「永远只有云端一条」，PROD 下只要有 custom（即云端那条）即不可再添加 Custom；无 custom 时仅允许由登录同步创建，则 **PROD 下完全隐藏「添加 Custom」**，仅 DEV 可手动添加第二条（与 spec「开发环境是否放宽」：本 plan 采用 **DEV 可手动、PROD 不可添加 custom**）。

- [ ] **Step 2: Commit**

```bash
git add src/components/settings/ProvidersSettings.tsx
git commit -m "fix: 生产环境禁止手动新增 Custom 供应商"
```

---

## Task 8: API 文档与验证

**Files:**
- Modify: `docs/api-docs/04_Member_API.md`（若需补充响应示例）

- [ ] **Step 1: 在 `AppConsumerApiController` 的 `new-api/config` 下增加响应字段说明：`baseUrl`/`apiUrl`、`apiKey`（及 `code`/`data` 包裹）**

- [ ] **Step 2: 全量校验**

```bash
pnpm run typecheck
pnpm test
pnpm run lint
```

- [ ] **Step 3: Commit**

```bash
git add -f docs/api-docs/04_Member_API.md
git commit -m "docs: 补充 member new-api/config 响应字段"
```

---

## 风险与注意点

1. **`ProviderService.listAccounts` 与 openclaw.json**：列表展示依赖 OpenClaw 活跃供应商；同步逻辑必须调用与 HTTP 路由相同的 **runtime sync**，否则 UI 或 Gateway 仍显示旧配置。
2. **默认模型字符串**：OpenClaw 可能使用 `custom-xxxx/modelId` 形式；依赖现有 `syncSavedProviderToRuntime` 内 `setOpenClawDefaultModel` 逻辑，若集成测试失败需对照 `provider-runtime-sync.ts`。
3. **日志脱敏**：`cloud-fetch-log` 已对 `apiKey`/`platformAccessToken` 等字段脱敏。
4. **`git add -f docs/...`**：仓库 `.gitignore` 忽略 `docs/`，与既有 superpowers 文档相同需 `-f`。

---

## 完成定义

- [ ] 登录后自动出现一条 `runnode-cloud-custom`（或所选常量 id）且为默认供应商，聊天可用。
- [ ] 登出后该账号与密钥消失，OpenClaw 中对应项移除。
- [ ] 生产构建无 Models 入口、访问 `/models` 重定向首页。
- [ ] 生产设置中无法手动添加第二条 custom。
- [ ] `pnpm run typecheck` && `pnpm test` && `pnpm run lint` 通过。
