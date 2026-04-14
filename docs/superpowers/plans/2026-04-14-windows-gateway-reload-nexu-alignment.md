# Windows Gateway 进程内重载（范围 A）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 Windows 上让 `GatewayManager.reload()` 优先通过 JSON-RPC（及经 spike 确认后的配置 touch）完成进程内重载，避免默认全量 `restart()`，失败时仍回退 `restart()`。

**Architecture:** 将「Windows 专用重载尝试」抽成独立模块（例如 `electron/gateway/windows-reload.ts`），由 `reload()` 在 `win32` 分支调用；顺序为 **RPC（若存在且适用）→ 配置 touch（若 spike 确认 watcher 可靠）→ `restart()`**。继续复用现有 `rpc()` WebSocket 通道与 `join(homedir(), '.openclaw', 'openclaw.json')` 与 Gateway 子进程默认配置路径一致（与 `reload-policy.ts` 读取策略文件路径对齐）。

**Tech Stack:** TypeScript、Electron、`ws`、Vitest、`vi.mock`（与现有 `gateway-manager-reload-policy-refresh.test.ts` 风格一致）。

**Design spec:** `docs/superpowers/specs/2026-04-14-windows-gateway-reload-nexu-alignment-design.md`

---

## 文件结构（创建 / 修改）

| 路径 | 职责 |
|------|------|
| `electron/gateway/windows-reload.ts`（新建） | 导出 `tryWindowsGatewayReload(options)`：内部依次尝试 RPC、touch；返回 `{ ok: true }` 或 `{ ok: false, reason: string }`。不含 `GatewayManager` 类状态。 |
| `electron/gateway/manager.ts`（修改） | `reload()` 中替换 `win32` 下 `await this.restart()` 块，改为调用 `tryWindowsGatewayReload`，失败再 `restart()`。 |
| `tests/unit/gateway-windows-reload.test.ts`（新建） | 对 `windows-reload.ts` 做纯函数级单测（mock `appendFile`、`rpc`）。 |
| `tests/unit/gateway-manager-windows-reload.test.ts`（新建）或扩展现有 manager 测 | Mock `process.platform`、`reload` 路径，断言 win32 + RPC 成功时不调用 `restart`。 |
| `docs/notes/openclaw-gateway-reload-spike.md`（新建，可选） | 记录 spike 发现的 RPC 方法名与是否启用 touch；若 spike 结果很短，可合并进本 plan 的「Spike 结论」一节而不单独建文件。 |

---

### Task 0: Spike — OpenClaw 捆绑版本中的 reload 能力

**Files:**
- Read: `package.json` / `pnpm-lock.yaml` 中 `openclaw` 版本
- Create（推荐）: `docs/notes/openclaw-gateway-reload-spike.md`

- [ ] **Step 1: 锁定版本并全文检索**

在仓库根目录执行（PowerShell 可用 `Select-String` 替代）：

```bash
rg -n "secrets\.reload|config\.reload|gateway\.reload" node_modules/openclaw --glob "*.{js,mjs,cjs,ts}" 2>nul || true
rg -n "\.reload" node_modules/openclaw/dist --glob "*.js" 2>nul | head -n 80
```

将**命中文件路径 + 片段**记入 spike 笔记。已知文档：`node_modules/openclaw/docs/cli/secrets.md` 写明 Gateway RPC **`secrets.reload`**（仅 secrets 快照，非全量配置）。

- [ ] **Step 2: 判定 Windows 主路径**

在笔记中写清二选或组合（实现按此执行）：

- **若**存在全量配置热重载 RPC（名称以 spike 为准）：Windows 优先只调该方法。
- **若否**：**主路径**为对 `openclaw.json` 的 **touch**（`fs.promises.appendFile(path, '', 'utf8')`），与 Nexu `touchConfig` 一致；**可选**在适用场景额外调用 `secrets.reload`（例如仅 SecretRef 变更，可与产品路径核对后决定是否在 v1 省略）。

- [ ] **Step 3: Commit spike 笔记（若单独文件）**

```bash
git add docs/notes/openclaw-gateway-reload-spike.md
git commit -m "docs: 记录 OpenClaw Gateway reload 能力 spike 结论"
```

---

### Task 1: 实现 `electron/gateway/windows-reload.ts`

**Files:**
- Create: `electron/gateway/windows-reload.ts`
- Modify: `electron/gateway/manager.ts`（Task 2 再改，本任务只新增模块）

- [ ] **Step 1: 新增模块实现**

新建 `windows-reload.ts`，导出：

- `WindowsReloadResult`：`{ ok: true; via: 'rpc' | 'touch' } | { ok: false; reason: string }`
- `WindowsReloadDeps`：`{ rpc: (method, params?, timeoutMs?) => Promise<unknown>; configPath?: string }`
- `tryWindowsGatewayReload(deps)`：默认配置路径为 `join(homedir(), '.openclaw', 'openclaw.json')`（与 `reload-policy.ts` 读取的 `gateway.reload` 所在文件同路径，勿写死盘符）。

**控制流（按 Task 0 笔记落地，禁止留 TODO）：**

1. 若 spike 给出 **全量配置** RPC 方法名：先 `await deps.rpc(<该方法>, …)`，成功则 `return { ok: true, via: 'rpc' }`；失败则进入步骤 2 或返回 `{ ok: false, reason }`（按笔记）。
2. 若 spike 给出 **仅** `secrets.reload`：可选择在 touch 之前调用；**不得**仅因 `secrets.reload` 成功就对「全量 openclaw.json 变更」标 `ok: true`，除非笔记证明其覆盖范围足够。
3. **touch**：`await appendFile(configPath, '', 'utf8')`，成功则 `return { ok: true, via: 'touch' }`；失败则 `{ ok: false, reason: … }`。

实现文件需包含完整 `import` 与错误处理，与上述分支一致。

- [ ] **Step 2: `pnpm run typecheck`**

```bash
pnpm run typecheck
```

Expected: 无新增错误。

- [ ] **Step 3: Commit**

```bash
git add electron/gateway/windows-reload.ts
git commit -m "feat(gateway): 新增 Windows 进程内重载尝试模块"
```

---

### Task 2: 接入 `GatewayManager.reload()`

**Files:**
- Modify: `electron/gateway/manager.ts`（`reload()` 方法内约 569–576 行 `win32` 分支）

- [ ] **Step 1: 替换 Windows 分支**

将：

```typescript
if (process.platform === 'win32') {
  logger.warn('[gateway-refresh] mode=reload result=fallback_restart cause=windows');
  await this.restart();
  return;
}
```

改为（示意，导入路径按项目别名调整）：

```typescript
if (process.platform === 'win32') {
  const result = await tryWindowsGatewayReload({
    rpc: (m, p, t) => this.rpc(m, p, t),
  });
  if (result.ok) {
    logger.info(
      `[gateway-refresh] mode=reload result=applied_win via=${result.via}`,
    );
    return;
  }
  logger.warn(
    `[gateway-refresh] mode=reload result=fallback_restart cause=windows_reload_failed reason=${result.reason}`,
  );
  await this.restart();
  return;
}
```

保留其前 **`connectedForMs < 8000`** 跳过逻辑不变。

- [ ] **Step 2: `pnpm run typecheck`**

```bash
pnpm run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add electron/gateway/manager.ts
git commit -m "feat(gateway): Windows 上 reload 优先进程内重载再回退 restart"
```

---

### Task 3: 单元测试 — `windows-reload.ts`

**Files:**
- Create: `tests/unit/gateway-windows-reload.test.ts`

- [ ] **Step 1: 写入测试**

```typescript
import { describe, expect, it, vi } from 'vitest';
import { tryWindowsGatewayReload } from '@electron/gateway/windows-reload';

vi.mock('node:fs/promises', () => ({
  appendFile: vi.fn().mockResolvedValue(undefined),
}));

describe('tryWindowsGatewayReload', () => {
  it('returns ok via touch when appendFile succeeds', async () => {
    const { appendFile } = await import('node:fs/promises');
    const rpc = vi.fn().mockRejectedValue(new Error('no rpc'));
    const result = await tryWindowsGatewayReload({
      rpc,
      configPath: 'C:\\tmp\\openclaw.json',
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.via).toBe('touch');
    expect(appendFile).toHaveBeenCalledWith('C:\\tmp\\openclaw.json', '', 'utf8');
  });
});
```

若实现中 **省略了 RPC 调用** 或 **RPC 成功即 return**，需同步调整断言（与最终 `windows-reload.ts` 行为一致）。

- [ ] **Step 2: 运行测试**

```bash
pnpm test tests/unit/gateway-windows-reload.test.ts
```

Expected: 全部 PASS。

- [ ] **Step 3: Commit**

```bash
git add tests/unit/gateway-windows-reload.test.ts
git commit -m "test(gateway): 覆盖 Windows reload touch 路径"
```

---

### Task 4: 单元测试 — `GatewayManager` Windows `reload` 不触发 `restart`

**Files:**
- Create: `tests/unit/gateway-manager-windows-reload.test.ts`

- [ ] **Step 1: Mock 与用例**

沿用 `tests/unit/gateway-manager-reload-policy-refresh.test.ts` 的 `vi.mock('electron', ...)` 模式；`vi.mock('@electron/gateway/windows-reload', () => ({ tryWindowsGatewayReload: vi.fn() }))`。

测试要点：

1. `Object.defineProperty(process, 'platform', { value: 'win32', configurable: true })`（在 `afterEach` 恢复）。
2. Mock `GatewayManager` 已连接：`status.state === 'running'`、`process.pid` 有值、`connectedAt` 设为 **9 秒前**（避免 `<8000ms` 跳过）。
3. `tryWindowsGatewayReload` resolve `{ ok: true, via: 'touch' }`。
4. 调用 `reload()` 后，**未**调用内部 `restart`（可对 `restart` 或 `terminateOwnedGatewayProcess` 等 spy，或 mock `windows-reload` 并断言 `reload` 提前 return）。

具体 spy 方式需与 `GatewayManager` 可测性一致；若 `restart` 难以 spy，可改为 **只断言 `tryWindowsGatewayReload` 被调用一次** 且 **无 `restart` 日志**（次优）。

- [ ] **Step 2: 运行测试**

```bash
pnpm test tests/unit/gateway-manager-windows-reload.test.ts
```

- [ ] **Step 3: Commit**

```bash
git add tests/unit/gateway-manager-windows-reload.test.ts
git commit -m "test(gateway): Windows reload 成功时不全量 restart"
```

---

### Task 5: 全量校验与文档

- [ ] **Step 1: 全量测试与 lint**

```bash
pnpm run typecheck
pnpm test
pnpm run lint
```

- [ ] **Step 2: 评估 README**

若用户可见行为变化（Windows 保存配置后更快、偶发仍 fallback），按 `AGENTS.md` 在 `README.zh-CN.md`（及必要时 `README.md` / `README.ja-JP.md`）增加一句「Windows 上优先热重载 Gateway 配置」。

- [ ] **Step 3: Commit**

```bash
git add README.zh-CN.md
git commit -m "docs: 说明 Windows Gateway 配置热重载行为"
```

（若无用户可见文案变更，可跳过 README 提交。）

---

## Spec 对照自检

| Spec 要求 | 对应任务 |
|-----------|----------|
| Spike 先于实现 | Task 0 |
| Windows 优先 RPC / touch，失败 `restart` | Task 1–2 |
| 日志区分 `applied_win` / fallback | Task 2（已实现 `applied_win` 与 `windows_reload_failed`） |
| 单元测试 | Task 3–4 |
| 非目标：不改 `FORCE_RESTART_CHANNELS` | 本 plan 不修改 `channels.ts` / IPC 列表 |

## Plan 自检（无占位符）

- 已避免「TBD」；Task 0 负责把 RPC 名称从代码库落地。
- `tryWindowsGatewayReload` 的最终分支必须以 Task 0 笔记为准更新 Task 1 的代码块。

---

## 执行方式选择

Plan 已保存至 `docs/superpowers/plans/2026-04-14-windows-gateway-reload-nexu-alignment.md`。

**两种执行方式：**

1. **Subagent-Driven（推荐）** — 每个 Task 派生子代理执行，任务间 review，迭代快。  
2. **Inline Execution** — 本会话按 Task 顺序执行，检查点处停顿 review。

请回复 **1** 或 **2**（或「自行在本会话实现」即选 2）。
