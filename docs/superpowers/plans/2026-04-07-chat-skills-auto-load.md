# Chat 技能自动加载与同步 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 Gateway 未就绪时仍能合并磁盘与配置拉取本地技能；聊天页在挂载、Gateway running、回到首页路由、窗口可见/聚焦时刷新 `fetchSkills`；磁盘合并项的 `enabled` 遵循规格中的 Gateway → config → 默认 `true` 规则。

**Architecture:** `src/stores/skills.ts` 中将 `skills.status`、ClawHub list、configs 分步 `try/catch`，失败不阻断后续步骤；合并时移除「从旧 store 复制整表」的旧分支以符合规格。`src/pages/Chat/` 增加专用 hook（或等价内联逻辑）集中处理 `useEffect` 与 `visibilitychange`/`focus` 防抖及 30s 最短间隔。单元测试扩展现有 `vi.mock` 模式；E2E 在无技能环境仍可 skip，不强制依赖本机安装。

**Tech Stack:** React 19、react-router `useLocation`、Zustand、`vitest` + `vi.mock`、`Playwright`（现有 Electron fixture）。

**规格依据:** `docs/superpowers/specs/2026-04-07-chat-skills-auto-load-design.md`

---

## 文件结构（将修改 / 新增）

| 路径 | 职责 |
|------|------|
| `src/stores/skills.ts` | 分步容错、`enabled` 解析、合并逻辑；`configResult` 类型含 `enabled` |
| `src/pages/Chat/index.tsx` 或 `src/pages/Chat/useChatSkillsRefresh.ts`（新建） | 挂载 / Gateway / 路由 / 可见性 / 焦点触发 `fetchSkills` |
| `tests/unit/skills-errors.test.ts` 或 `tests/unit/skills-fetch-resilience.test.ts`（新建） | Gateway 失败仍合并 ClawHub；config `enabled: false` 过滤 |
| `tests/e2e/chat-skill-picker.spec.ts` | 可选：仅当能增加稳定断言时更新；否则保持 skip 行为并文档说明 |

路由说明：主应用聊天页路由为 **`/`**（`src/App.tsx`），不是 `/chat`。`useLocation().pathname === '/'` 表示在聊天页。

---

### Task 1: 单元测试 — Gateway `rpc` 失败时仍拉取磁盘并合并

**Files:**
- Create: `tests/unit/skills-fetch-resilience.test.ts`
- Modify:（本任务仅新增测试文件；实现前测试应失败）

- [ ] **Step 1: 新建测试文件（先失败）**

```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest';

const hostApiFetchMock = vi.fn();
const rpcMock = vi.fn();

vi.mock('@/lib/host-api', () => ({
  hostApiFetch: (...args: unknown[]) => hostApiFetchMock(...args),
}));

vi.mock('@/stores/gateway', () => ({
  useGatewayStore: {
    getState: () => ({
      rpc: (...args: unknown[]) => rpcMock(...args),
    }),
  },
}));

describe('fetchSkills resilience', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('continues when skills.status rejects and merges ClawHub list', async () => {
    rpcMock.mockRejectedValueOnce(new Error('gateway down'));
    hostApiFetchMock.mockImplementation(async (path: string) => {
      if (path === '/api/clawhub/list') {
        return { success: true, results: [{ slug: 'disk-only', version: '1', baseDir: '/x' }] };
      }
      if (path === '/api/skills/configs') {
        return { 'disk-only': {} };
      }
      return {};
    });

    const { useSkillsStore } = await import('@/stores/skills');
    await useSkillsStore.getState().fetchSkills();

    expect(hostApiFetchMock).toHaveBeenCalledWith('/api/clawhub/list');
    expect(hostApiFetchMock).toHaveBeenCalledWith('/api/skills/configs');
    const skills = useSkillsStore.getState().skills;
    expect(skills.some((s) => s.id === 'disk-only')).toBe(true);
    expect(skills.find((s) => s.id === 'disk-only')?.enabled).toBe(true);
  });

  it('respects config enabled false for disk-only skill', async () => {
    rpcMock.mockRejectedValueOnce(new Error('gateway down'));
    hostApiFetchMock.mockImplementation(async (path: string) => {
      if (path === '/api/clawhub/list') {
        return { success: true, results: [{ slug: 'off-skill', version: '1' }] };
      }
      if (path === '/api/skills/configs') {
        return { 'off-skill': { enabled: false } };
      }
      return {};
    });

    const { useSkillsStore } = await import('@/stores/skills');
    await useSkillsStore.getState().fetchSkills();

    const skill = useSkillsStore.getState().skills.find((s) => s.id === 'off-skill');
    expect(skill?.enabled).toBe(false);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm exec vitest run tests/unit/skills-fetch-resilience.test.ts`

Expected: FAIL（`fetchSkills` 仍在 `rpc` 抛错时整体失败，或 `enabled` 不符合）

- [ ] **Step 3: Commit**

```bash
git add tests/unit/skills-fetch-resilience.test.ts
git commit -m "test: 为 fetchSkills Gateway 失败场景添加失败用例"
```

---

### Task 2: 实现 `fetchSkills` 分步容错与 `enabled` 规则

**Files:**
- Modify: `src/stores/skills.ts`

- [ ] **Step 1: 扩展 config 类型**

将 `hostApiFetch<...>('/api/skills/configs')` 的泛型改为包含可选字段：

```typescript
type SkillConfigEntry = {
  apiKey?: string;
  env?: Record<string, string>;
  enabled?: boolean;
};
// ...
const configResult = await hostApiFetch<Record<string, SkillConfigEntry>>(...);
```

（`electron` 侧 `getAllSkillConfigs` 已返回 `enabled`，无需改 main。）

- [ ] **Step 2: 拆分 Gateway / ClawHub / configs 请求**

伪代码结构（实现时保持与现有字段映射一致）：

```typescript
let gatewayData: GatewaySkillsStatusResult = {};
try {
  gatewayData = await useGatewayStore.getState().rpc<GatewaySkillsStatusResult>('skills.status');
} catch (e) {
  console.warn('[skills] skills.status failed', e);
}

let clawhubResult: { success: boolean; results?: ClawHubListResult[]; error?: string } = {
  success: false,
};
try {
  clawhubResult = await hostApiFetch('/api/clawhub/list');
} catch (e) {
  console.warn('[skills] clawhub list failed', e);
}

let configResult: Record<string, SkillConfigEntry> = {};
try {
  configResult = await hostApiFetch('/api/skills/configs');
} catch (e) {
  console.warn('[skills] configs failed', e);
}
```

- [ ] **Step 3: 合并逻辑**

1. 若 `gatewayData.skills` 存在且为数组：按现有 `map` 生成 `combinedSkills`，`enabled: !s.disabled`，config 合并进 `config`。
2. **删除** 原 `else if (currentSkills.length > 0) combinedSkills = [...currentSkills]` 分支（与规格「不与旧 store 深合并 Gateway 行」一致）。
3. 若 Gateway 无数组或为空：`combinedSkills` 从 `[]` 开始。
4. ClawHub `forEach` 追加时，对**仅磁盘**项计算 `enabled`：

```typescript
function enabledForDiskOnly(slug: string, cfg: SkillConfigEntry | undefined): boolean {
  if (cfg && typeof cfg.enabled === 'boolean') return cfg.enabled;
  return true;
}
```

5. Gateway 已存在的 slug 仍只用 Gateway 的 `disabled`，不应用磁盘 `enabled` 覆盖（规格顺序 1 优先）。

- [ ] **Step 4: 错误码 `set({ error })` 策略**

仅当三步均失败且 `combinedSkills.length === 0` 时设置 `fetch` 相关 `error`；若至少有一路数据则 `error: null` 或清除旧错误（二选一，建议成功合并后 `error: null`）。与现有 `skills-errors.test.ts` 中「rate limit」用例对齐：若改为「部分成功」，需更新该测试的 mock 顺序与期望。

- [ ] **Step 5: 运行单元测试**

Run: `pnpm exec vitest run tests/unit/skills-fetch-resilience.test.ts tests/unit/skills-errors.test.ts`

Expected: PASS

- [ ] **Step 6: Typecheck**

Run: `pnpm run typecheck`

Expected: 无错误

- [ ] **Step 7: Commit**

```bash
git add src/stores/skills.ts tests/unit/skills-errors.test.ts
git commit -m "fix(skills): fetchSkills 分步容错与磁盘项启用态"
```

---

### Task 3: Chat 页触发 `fetchSkills`（挂载、Gateway、路由、可见性、焦点）

**Files:**
- Create: `src/pages/Chat/useChatSkillsRefresh.ts`（推荐，避免 `index.tsx` 过长）
- Modify: `src/pages/Chat/index.tsx`（挂载 hook）

- [ ] **Step 1: 实现 hook**

```typescript
import { useCallback, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useGatewayStore } from '@/stores/gateway';
import { useSkillsStore } from '@/stores/skills';

const DEBOUNCE_MS = 300;
const MIN_INTERVAL_MS = 30_000;

export function useChatSkillsRefresh() {
  const fetchSkills = useSkillsStore((s) => s.fetchSkills);
  const gatewayState = useGatewayStore((s) => s.status.state);
  const location = useLocation();
  const lastRunRef = useRef(0);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runFetchThrottled = useCallback(() => {
    const now = Date.now();
    if (now - lastRunRef.current < MIN_INTERVAL_MS) return;
    lastRunRef.current = now;
    void fetchSkills();
  }, [fetchSkills]);

  const scheduleFetch = useCallback(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;
      runFetchThrottled();
    }, DEBOUNCE_MS);
  }, [runFetchThrottled]);

  // 首次进入聊天：立即拉取，不经过防抖与 MIN_INTERVAL
  useEffect(() => {
    void fetchSkills();
  }, [fetchSkills]);

  useEffect(() => {
    if (gatewayState === 'running') {
      scheduleFetch();
    }
  }, [gatewayState, scheduleFetch]);

  useEffect(() => {
    if (location.pathname === '/') {
      scheduleFetch();
    }
  }, [location.pathname, scheduleFetch]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') scheduleFetch();
    };
    window.addEventListener('focus', scheduleFetch);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('focus', scheduleFetch);
      document.removeEventListener('visibilitychange', onVisible);
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [scheduleFetch]);
}
```

**注意:** 首次挂载的 `fetchSkills()` 与后续 `scheduleFetch`（Gateway / 路由 / 焦点）可能短时间连续触发；`MIN_INTERVAL` 仅作用于 `runFetchThrottled`，减轻焦点抖动；首屏仍保证尽快有一次无节流拉取。

- [ ] **Step 2: 在 `Chat` 组件顶层调用 `useChatSkillsRefresh()`**

在 `export function Chat()` 内、`useEffect` 区域之前：`useChatSkillsRefresh();`

- [ ] **Step 3: Lint**

Run: `pnpm run lint`

- [ ] **Step 4: 单元测试（可选）**

若项目已有 `@testing-library/react` hook 测试，可为 hook 加轻量测试；否则依赖手测 + E2E。

- [ ] **Step 5: Commit**

```bash
git add src/pages/Chat/useChatSkillsRefresh.ts src/pages/Chat/index.tsx
git commit -m "feat(chat): 挂载与焦点时自动同步技能列表"
```

---

### Task 4: E2E 与回归

- [ ] **Step 1: 跑 E2E（本地）**

Run: `pnpm run test:e2e -- tests/e2e/chat-skill-picker.spec.ts`

Expected: 与改动前一致（无技能时仍可能 `test.skip`）

- [ ] **Step 2: 若需稳定覆盖「进入聊天即拉取」**

仅在能 **不依赖本机技能安装** 的前提下增加断言（例如通过 E2E 专用 IPC mock 返回固定 `skills`）；若做不到，在计划/PR 说明中注明「由单元测试覆盖 fetch 容错」。

- [ ] **Step 3: 全量**

Run: `pnpm test` && `pnpm run typecheck`

- [ ] **Step 4: Commit**（若有测试改动）

---

## 规格自检（计划 vs spec）

| 规格条款 | 任务 |
|----------|------|
| Gateway 失败不阻断 ClawHub/configs | Task 2 |
| 不与旧 store 深合并 Gateway | Task 2 删除分支 |
| enabled：Gateway → config → 默认 true | Task 2 |
| Chat 挂载、running、路由、可见性/焦点 | Task 3 |
| 保留 ChatInput 内 `fetchSkills` | 无删除（本计划不改 `ChatInput.tsx`） |
| 单元测试 | Task 1–2 |
| E2E | Task 4 |

**占位符扫描:** 本计划无 TBD；路由以 `/` 为准已写明。

---

## 执行方式

Plan complete and saved to `docs/superpowers/plans/2026-04-07-chat-skills-auto-load.md`. Two execution options:

**1. Subagent-Driven (recommended)** — 每个 Task 派生子代理，任务间评审，迭代快  

**2. Inline Execution** — 本会话按 Task 顺序实现，批量变更并在检查点复核  

你更倾向哪一种？（若未指定，默认按 Task 1→4 在本会话或新会话中连续实现。）
