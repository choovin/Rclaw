# Claw 用户设备注册与心跳 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 Electron Main 进程中实现业务云 Claw 用户设备的 **register**、**5 分钟 heartbeat**、本地持久化、登录后再次 register、失败恢复与日志脱敏，行为对齐 [`docs/superpowers/specs/2026-04-24-claw-user-device-design.md`](../specs/2026-04-24-claw-user-device-design.md) 与 [`docs/api-docs/08_Claw_User_Device_API.md`](../../api-docs/08_Claw_User_Device_API.md)。

**Architecture:** Main 单例服务调用 `getCloudApiBaseUrl()` + `cloudFetchLogged` 直连 RunNode；`deviceId`/`fingerprint` 来自设置中的 `machineId` 与确定性 SHA-256；`serverDeviceId`/`deviceToken` 存入独立 `electron-store`；会员登录成功后在 `CloudAuthService` 内用 **动态 import** 触发二次 register，避免与 `cloudAuthService` 循环依赖；E2E 模式下不启动定时器（与 `initTelemetry` 等一致）。

**Tech Stack:** Electron Main、`electron-store`、`node-machine-id`、`cloudFetchLogged` / `proxyAwareFetch`、Vitest、`typescript`。

---

## 文件结构（创建 / 修改）

| 文件 | 职责 |
|------|------|
| **Create** `electron/utils/cloud-user-device-helpers.ts` | 纯函数：`isRunNodeSuccessCode`、`computeDeviceFingerprint`、`parseClawUserDeviceRegisterJson`、`nextHeartbeatFailureState`（失败计数 + 是否触发清空重登） |
| **Create** `electron/services/cloud-user-device-store.ts` | `electron-store`（`name: 'cloud-user-device'`，**不**与 `cloud-auth` 加密库混用），读写/清空 `serverDeviceId`、`deviceToken` |
| **Create** `electron/services/cloud-user-device-service.ts` | 单例：`ensureMachineId`、`registerDevice`、`sendHeartbeat`、定时器、`start`/`stop`、失败恢复与 register 退避 |
| **Modify** `electron/main/index.ts` | 非 E2E：`initialize()` 中在 `initTelemetry()` 之后（或并行 `void`）调用 `cloudUserDeviceService.start()`；`will-quit` 中 `stop()` |
| **Modify** `electron/services/cloud-auth.ts` | `loginWithPassword` / `loginWithSms` / `loginWithWechat` 在 `storeTokenData` 成功且即将 `return { success: true` 前，动态 import 并 `void cloudUserDeviceService.afterMemberLogin()` |
| **Modify** `electron/utils/cloud-fetch-log.ts` | `sanitizeForLog` / `headersForLog`：脱敏 `deviceToken`、`X-Device-Token`（大小写不敏感键名） |
| **Create** `tests/unit/cloud-user-device-helpers.test.ts` | 覆盖解析与失败状态机 |
| （无） | 无需改已锁定 spec；若后端仅接受 `code===0`，在实现代码注释中说明即可 |

---

## 常量（在服务内集中定义）

```typescript
const HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000;
const HEARTBEAT_FAIL_THRESHOLD = 3;
const REGISTER_RETRY_MAX_ATTEMPTS = 3;
const REGISTER_RETRY_DELAY_MS = 45_000;
const FINGERPRINT_SALT = 'rclaw-claw-user-device-v1';
const DEVICE_REGISTER_PATH = '/app-api/claw/user/device/register';
```

---

### Task 1: 纯函数与单元测试（TDD）

**Files:**
- Create: `electron/utils/cloud-user-device-helpers.ts`
- Create: `tests/unit/cloud-user-device-helpers.test.ts`

- [ ] **Step 1: 编写失败测试（解析 register 成功体）**

```typescript
// tests/unit/cloud-user-device-helpers.test.ts
import { describe, expect, it } from 'vitest';
import {
  isRunNodeSuccessCode,
  parseClawUserDeviceRegisterJson,
  nextHeartbeatFailureState,
  computeDeviceFingerprint,
} from '@electron/utils/cloud-user-device-helpers';

describe('cloud-user-device-helpers', () => {
  it('isRunNodeSuccessCode accepts 0 and 200 only', () => {
    expect(isRunNodeSuccessCode(0)).toBe(true);
    expect(isRunNodeSuccessCode(200)).toBe(true);
    expect(isRunNodeSuccessCode(401)).toBe(false);
    expect(isRunNodeSuccessCode('0')).toBe(false);
  });

  it('parseClawUserDeviceRegisterJson extracts id and deviceToken', () => {
    const r = parseClawUserDeviceRegisterJson({
      code: 0,
      data: { id: 7, deviceToken: 'abc', newlyCreated: true },
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.id).toBe(7);
      expect(r.deviceToken).toBe('abc');
    }
  });

  it('nextHeartbeatFailureState: 2xx + 业务成功 resets', () => {
    const s = nextHeartbeatFailureState({ consecutiveFailures: 2, httpStatus: 200, businessCode: 0 });
    expect(s.action).toBe('reset');
    expect(s.consecutiveFailures).toBe(0);
  });

  it('nextHeartbeatFailureState: HTTP 错误递增，满 3 次则清空重登', () => {
    let s = nextHeartbeatFailureState({ consecutiveFailures: 0, httpStatus: 503, businessCode: null });
    expect(s.action).toBe('increment');
    expect(s.consecutiveFailures).toBe(1);
    s = nextHeartbeatFailureState({ consecutiveFailures: 1, httpStatus: 503, businessCode: null });
    expect(s.action).toBe('increment');
    expect(s.consecutiveFailures).toBe(2);
    s = nextHeartbeatFailureState({ consecutiveFailures: 2, httpStatus: 503, businessCode: null });
    expect(s.action).toBe('clear_and_reregister');
  });

  it('nextHeartbeatFailureState: 401 立即清空重登', () => {
    const s = nextHeartbeatFailureState({ consecutiveFailures: 0, httpStatus: 401, businessCode: null });
    expect(s.action).toBe('clear_and_reregister');
  });

  it('nextHeartbeatFailureState: 2xx 但业务 code 失败则清空重登', () => {
    const s = nextHeartbeatFailureState({ consecutiveFailures: 0, httpStatus: 200, businessCode: 401 });
    expect(s.action).toBe('clear_and_reregister');
  });

  it('computeDeviceFingerprint is stable hex', () => {
    const a = computeDeviceFingerprint('mid-1', 'rclaw-claw-user-device-v1');
    const b = computeDeviceFingerprint('mid-1', 'rclaw-claw-user-device-v1');
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm exec vitest run tests/unit/cloud-user-device-helpers.test.ts`  
Expected: FAIL（模块不存在或导出未定义）

- [ ] **Step 3: 实现 `electron/utils/cloud-user-device-helpers.ts`**

```typescript
import { createHash } from 'crypto';

export function isRunNodeSuccessCode(code: unknown): boolean {
  return code === 0 || code === 200;
}

export function computeDeviceFingerprint(machineId: string, salt: string): string {
  return createHash('sha256').update(`${machineId}\0${salt}`, 'utf8').digest('hex');
}

export type RegisterParseResult =
  | { ok: true; id: number; deviceToken: string }
  | { ok: false };

export function parseClawUserDeviceRegisterJson(raw: unknown): RegisterParseResult {
  if (raw === null || typeof raw !== 'object') return { ok: false };
  const o = raw as Record<string, unknown>;
  if (!isRunNodeSuccessCode(o.code)) return { ok: false };
  const data = o.data;
  if (data === null || typeof data !== 'object') return { ok: false };
  const d = data as Record<string, unknown>;
  const id = d.id;
  const deviceToken = d.deviceToken;
  if (typeof id !== 'number' || typeof deviceToken !== 'string' || !deviceToken) return { ok: false };
  return { ok: true, id, deviceToken };
}

export type HeartbeatFailureInput = {
  consecutiveFailures: number;
  httpStatus: number;
  businessCode: unknown;
};

export type HeartbeatFailureOutput = {
  action: 'reset' | 'increment' | 'clear_and_reregister';
  consecutiveFailures: number;
};

const THRESHOLD = 3;

export function nextHeartbeatFailureState(input: HeartbeatFailureInput): HeartbeatFailureOutput {
  if (input.httpStatus === 401 || input.httpStatus === 403) {
    return { action: 'clear_and_reregister', consecutiveFailures: 0 };
  }
  if (input.httpStatus < 200 || input.httpStatus >= 300) {
    const next = input.consecutiveFailures + 1;
    if (next >= THRESHOLD) {
      return { action: 'clear_and_reregister', consecutiveFailures: 0 };
    }
    return { action: 'increment', consecutiveFailures: next };
  }
  // HTTP 2xx：再判业务包装 code
  if (!isRunNodeSuccessCode(input.businessCode)) {
    return { action: 'clear_and_reregister', consecutiveFailures: 0 };
  }
  return { action: 'reset', consecutiveFailures: 0 };
}
```

`heartbeat` 的 `tick` 在 Task 3 中解析 JSON 后把 **HTTP status** 与 **body.code** 传入此函数；网络异常可视为 `httpStatus: 0` 走递增分支。

- [ ] **Step 4: 再次运行 Vitest**

Run: `pnpm exec vitest run tests/unit/cloud-user-device-helpers.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add electron/utils/cloud-user-device-helpers.ts tests/unit/cloud-user-device-helpers.test.ts
git commit -m "feat: 新增 Claw 用户设备 API 解析与失败状态纯函数"
```

---

### Task 2: 持久化 store

**Files:**
- Create: `electron/services/cloud-user-device-store.ts`

- [ ] **Step 1: 实现 store 模块**

```typescript
import { app } from 'electron';

export interface CloudUserDevicePersisted {
  serverDeviceId: number | null;
  deviceToken: string | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let storeInstance: any = null;

async function getStore() {
  if (!storeInstance) {
    const Store = (await import('electron-store')).default;
    storeInstance = new Store<CloudUserDevicePersisted>({
      name: 'cloud-user-device',
      defaults: { serverDeviceId: null, deviceToken: null },
    });
  }
  return storeInstance;
}

export async function getCloudUserDevicePersisted(): Promise<CloudUserDevicePersisted> {
  const s = await getStore();
  return {
    serverDeviceId: s.get('serverDeviceId') ?? null,
    deviceToken: s.get('deviceToken') ?? null,
  };
}

export async function setCloudUserDevicePersisted(p: CloudUserDevicePersisted): Promise<void> {
  const s = await getStore();
  s.set('serverDeviceId', p.serverDeviceId);
  s.set('deviceToken', p.deviceToken);
}

export async function clearCloudUserDevicePersisted(): Promise<void> {
  await setCloudUserDevicePersisted({ serverDeviceId: null, deviceToken: null });
}

/** 供 vitest / 特殊场景；Main 正常路径依赖 app.ready */
export function __resetCloudUserDeviceStoreForTests(): void {
  storeInstance = null;
}
```

- [ ] **Step 2: Commit**

```bash
git add electron/services/cloud-user-device-store.ts
git commit -m "feat: 新增 Claw 用户设备云端凭据本地存储"
```

---

### Task 3: CloudUserDeviceService 核心逻辑

**Files:**
- Create: `electron/services/cloud-user-device-service.ts`
- Modify: `electron/utils/cloud-user-device-helpers.ts`（若需与真实响应分支对齐）

- [ ] **Step 1: 实现服务类（要点清单）**

1. `ensureMachineId()`：`getSetting('machineId')`，若空则 `machineIdSync()` + `setSetting('machineId', ...)`（与 `telemetry.ts` 一致）。  
2. `buildRegisterBody()`：`deviceId`（machineId）、`deviceName`（`os.hostname()`）、`fingerprint`（`computeDeviceFingerprint(machineId, FINGERPRINT_SALT)`）、`platform`、`osVersion`（`os.release()`）、`appVersion`（`app.getVersion()`）。  
3. `registerDevice()`：  
   - URL：`getCloudApiBaseUrl() + DEVICE_REGISTER_PATH`  
   - Headers：`Content-Type: application/json`；若有本地 `deviceToken` 则 `X-Device-Token`；若 `await cloudAuthService.getValidToken()` 非空则 `Authorization: Bearer ...`（**仅在有 token 时**）  
   - 使用 `cloudFetchLogged('claw.user.device:register', url, { method: 'POST', headers, body })`  
   - `response.text()` + `JSON.parse`，`parseClawUserDeviceRegisterJson`；成功则 `setCloudUserDevicePersisted`  
4. `registerWithRetries()`：失败则最多 `REGISTER_RETRY_MAX_ATTEMPTS` 次，间隔 `REGISTER_RETRY_DELAY_MS`（`setTimeout` + `await` Promise）。  
5. `sendHeartbeat()`：`PUT ${base}/app-api/claw/user/device/${id}/heartbeat`，头：`X-Device-Token` 必填；有会员 token 则 `Authorization`。解析 body：若 HTTP 401/403 或业务 `code` 失败 → 触发恢复。成功可 `logger.debug`。  
6. `onHeartbeatFailureDecision`：使用 `nextHeartbeatFailureState`（必要时扩展参数，例如传入 `httpOk` 与 `businessCode`）。  
7. `recoverClearAndRegister()`：`await clearCloudUserDevicePersisted()`，立刻 `registerWithRetries()`。  
8. `start()`：若 `process.env.CLAWX_E2E === '1'` 则 return；`void` 链：`await registerWithRetries()` → `setInterval` 每 `HEARTBEAT_INTERVAL_MS` 调 `tickHeartbeat`（内部：若无 id/token 则尝试 `registerWithRetries` 并 return）。  
9. `stop()`：`clearInterval`，可选 `this.started = false`。  
10. `afterMemberLogin()`：`void this.registerWithRetries()`（不阻塞 IPC）。  

导出单例：`export const cloudUserDeviceService = new CloudUserDeviceService();`

- [ ] **Step 2: 手工自检**

Run: `pnpm run typecheck`  
Expected: 无新增错误

- [ ] **Step 3: Commit**

```bash
git add electron/services/cloud-user-device-service.ts electron/utils/cloud-user-device-helpers.ts
git commit -m "feat: Main 侧 Claw 用户设备注册与定时心跳服务"
```

---

### Task 4: 接入 Main 生命周期

**Files:**
- Modify: `electron/main/index.ts`

- [ ] **Step 1: 在 `initialize()` 中，`!isE2EMode` 分支里 `await initTelemetry()` 之后增加**

```typescript
import { cloudUserDeviceService } from '../services/cloud-user-device-service';

// 在 await initTelemetry(); 之后：
void cloudUserDeviceService.start().catch((err) => {
  logger.warn('Cloud user device service start failed:', err);
});
```

- [ ] **Step 2: 在 `app.on('will-quit', ...)` 中**（与 `releaseProcessInstanceFileLock` 同级）**增加**

```typescript
cloudUserDeviceService.stop();
```

若 `will-quit` 早于模块加载失败，确保 `stop()` 空操作安全。

- [ ] **Step 3: Run typecheck**

Run: `pnpm run typecheck`

- [ ] **Step 4: Commit**

```bash
git add electron/main/index.ts
git commit -m "feat: 启动与退出时挂载 Claw 用户设备服务"
```

---

### Task 5: 登录成功后二次 register

**Files:**
- Modify: `electron/services/cloud-auth.ts`

- [ ] **Step 1: 在三个登录成功分支中，`await this.storeTokenData(...)` 之后、`resolveUserProfileAfterLogin` 之前或之后插入（不阻塞用户资料）**

```typescript
void import('./cloud-user-device-service')
  .then(({ cloudUserDeviceService }) => cloudUserDeviceService.afterMemberLogin())
  .catch((err) => logger.warn('[CloudAuth] cloud user device register after login:', err));
```

需覆盖：`loginWithPassword`、`loginWithSms`、`loginWithWechat`。

- [ ] **Step 2: Commit**

```bash
git add electron/services/cloud-auth.ts
git commit -m "feat: 会员登录成功后再次登记 Claw 用户设备"
```

---

### Task 6: 日志脱敏

**Files:**
- Modify: `electron/utils/cloud-fetch-log.ts`

- [ ] **Step 1: 在 `sanitizeForLog` 中增加键名匹配**（小写比较）：`devicetoken`、`x-device-token` → `[redacted]`  

- [ ] **Step 2: 在 `headersForLog` 中**：若存在 `X-Device-Token` / `x-device-token`，输出 `[redacted]`  

- [ ] **Step 3: 本地打一条 register 日志 spot-check**（可选，手工）  

- [ ] **Step 4: Commit**

```bash
git add electron/utils/cloud-fetch-log.ts
git commit -m "chore: 云 API 日志脱敏 device token 请求头与字段"
```

---

### Task 7: 全量验证

- [ ] **Step 1: Lint**

Run: `pnpm run lint`  
Expected: PASS

- [ ] **Step 2: 单元测试**

Run: `pnpm test`  
Expected: PASS

- [ ] **Step 3: Typecheck**

Run: `pnpm run typecheck`  
Expected: PASS

- [ ] **Step 4: 若有 comms 相关改动则跑 replay/compare**（本功能仅 HTTP 直连业务云，**通常可跳过**；若误触共享工具再跑）

- [ ] **Step 5: 提交计划或收尾 commit（若尚未提交）**

```bash
git add docs/superpowers/plans/2026-04-24-claw-user-device.md
git commit -m "docs: 新增 Claw 用户设备注册与心跳实现计划"
```

---

## Plan 自检

| Spec 章节 | 对应 Task |
|-----------|-----------|
| Register/Heartbeat 路径与头 | Task 3 |
| machineId + fingerprint | Task 3 + Task 1 |
| 启动 / 登录时序 | Task 4 + Task 5 |
| 5 分钟间隔、失败阈值、清空并立即 register、register 退避 | Task 3 |
| 持久化分区 | Task 2 |
| 日志脱敏 | Task 6 |
| E2E 不强制 | Task 4（跳过 start） |

**占位符扫描：** 无 TBD。  
**类型一致：** `serverDeviceId` 全篇使用 `number`；与 API `data.id` 一致。

---

Plan complete and saved to `docs/superpowers/plans/2026-04-24-claw-user-device.md`. Two execution options:

**1. Subagent-Driven (recommended)** — 每个 Task 派生子代理，任务间人工快速复核。  
**2. Inline Execution** — 本会话内按 Task 顺序执行，.checkpoint 复核。

你更倾向哪一种？
