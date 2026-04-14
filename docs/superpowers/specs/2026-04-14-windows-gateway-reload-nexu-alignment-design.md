# Windows Gateway 进程内重载（向 Nexu 靠拢，范围 A）设计

## 背景

当前 `GatewayManager.reload()`（`electron/gateway/manager.ts`）在 **非 Windows** 上通过向子进程发送 **SIGUSR1** 触发 OpenClaw Gateway 进程内配置重载；在 **Windows** 上因无等价 POSIX 信号，实现直接 **fallback 为全量 `restart()`**，导致与「手动/CLI 启动」相比，用户在保存 provider、模型等配置时体感等待明显偏长。

参考 [nexu-io/nexu](https://github.com/nexu-io/nexu) 的 controller-first 模型：配置写入后优先依赖 **OpenClaw 侧 hot-reload / 文件监视**，避免不必要的进程替换。本设计仅在 **RClaw 现有架构**（Electron 主进程托管 Gateway）下，为 **Windows** 补齐「能 reload 则不 restart」的等价路径，**不**引入独立 controller 进程（该方向为更大架构项，不在范围 A）。

## 目标

1. 在 **Windows** 上，当业务通过 `debouncedReload()` → `reload()` 请求刷新时，**优先**使用进程内重载（RPC 与/或配置 touch），**避免**默认执行全量 `restart()`。
2. 若进程内重载无法完成或 OpenClaw 未支持所需能力，行为与现网一致：**回退全量 `restart()`**，保证可靠性。
3. 保留现有 **`GatewayReloadPolicy`**（`~/.openclaw/openclaw.json` 中 `gateway.reload`）语义：`mode === 'off'` / `'restart'` 仍走 `debouncedRestart`，不改变。

## 非目标（本阶段明确不做）

- **不**在本阶段缩小 `FORCE_RESTART_CHANNELS` 或调整 IPC/`channels.ts` 中「频道插件必须 restart」的策略（对应 brainstorming 选项 **B**，单独立项）。
- **不**改变 Agent 删除等已约定为 **kill + respawn** 的路径。
- **不**将 Gateway 生命周期迁出主进程或引入 Nexu 式 `apps/controller` sidecar（可选未来架构，非本 spec）。

## 方案结论（brainstorming 已确认）

采用 **路线 1（优先）+ 路线 2（补充）**，且 **实施前必须做 spike**：

| 路线 | 内容 | 说明 |
|------|------|------|
| **1. Gateway JSON-RPC** | 在已连接 Gateway WebSocket 的前提下，若 OpenClaw 暴露与「运行时配置/快照」重载等价的 RPC，则 Windows 上 **优先调用该方法**，成功则 **不** `restart()`。 | 文档中已有类似 **`secrets.reload`** 的先例；需对照当前捆绑的 `openclaw` 版本列出可用方法与语义，确认是否覆盖「保存 provider/模型」后的需求，或是否需组合调用。 |
| **2. 配置 touch（Nexu 式）** | 在配置已写入磁盘的前提下，对 **`OPENCLAW_CONFIG_PATH`** 对应文件做 **no-op 写（更新 mtime）**，依赖 Gateway 内 **文件监视** 触发重载。 | 与 Nexu `OpenClawWatchTrigger.touchConfig()` 同思路；**仅在 spike 证明 OpenClaw 在 Windows 上可靠监视该路径时**作为正式路径；需与路线 1 协调 **去抖**，避免双重触发。 |
| **3. 仅优化 restart 耗时** | 不采纳为范围 A 的核心方案。 | 不能替代「进程内重载」目标。 |

**推荐调用顺序（实现时以 spike 结果为准）**：Windows 分支内先尝试 **RPC（若存在且适用）** → 再 **touch（若 watcher 成立）** → 任一环节判定失败或超时则 **`restart()`**。

## 详细设计

### 1. Spike（必须先完成）

- **输入**：仓库当前依赖的 `openclaw` 版本（`package.json` / lockfile）。
- **输出**（写入实现计划或本仓库简短 `docs/` 备注均可，但结论必须可追溯）：
  - 与 reload 相关的 **RPC 方法名、参数、成功/失败语义**（至少核对 `secrets.reload` 及是否存在更通用的 config/gateway reload）。
  - Gateway 是否对 **`OPENCLAW_CONFIG_PATH`**（或 OpenClaw 实际解析路径）做 **fs.watch** 或等价机制，**Windows 行为**是否与 macOS/Linux 一致。
- **决策**：据上表确定 Windows 上 **默认顺序** 与 **fallback 条件**。

### 2. `GatewayManager.reload()` 行为变更（仅 Windows 分支）

- **替换**现有逻辑：`if (process.platform === 'win32') { await this.restart(); return; }`。
- **新逻辑**（伪代码级）：
  - 若 `reloadPolicy` 强制 restart、或未运行、或 `restartController` 要求 defer：保持 **现有分支** 不变。
  - 若 `connectedForMs < 8000`：**保持跳过**（与 SIGUSR1 路径一致，避免刚连上就重载）。
  - 否则：执行 **Windows 重载策略**（RPC → touch，顺序以 spike 为准）；若策略报告成功，打日志 `[gateway-refresh] mode=reload result=applied_win ...`，**不**调用 `restart()`。
  - 若策略失败或健康检查不满足：打 `cause=fallback_restart`，调用现有 **`restart()`**。
- **可选**：抽取 **`electron/gateway/windows-reload.ts`**（或同级命名），集中 RPC 名称、超时、touch 路径解析，避免 `manager.ts` 继续膨胀。

### 3. 可观测性

- 日志区分：`cause=windows_rpc` / `cause=windows_touch` / `cause=fallback_restart`；**禁止**在「方法不存在」时高频重试拖长时间（一次降级即可）。
- 不改变现有 telemetry 事件名；若新增字段，需与现有 `gateway.restart.*` 指标兼容说明。

### 4. 测试

- **单元测试**：Mock `process.platform === 'win32'`、`reload()` 在 RPC 成功时不调用 `restart`；RPC 失败或抛错时调用 `restart`（与现有 `reload` 单测风格对齐）。
- **手动**：Windows 上保存 provider/模型后，确认日志为 `applied_win` 或明确 fallback；必要时对比进程 PID（以产品验证清单为准）。

## 相关文件（预期）

- `electron/gateway/manager.ts` — `reload()` Windows 分支。
- 新增（可选）：`electron/gateway/windows-reload.ts`。
- 测试：`tests/unit/gateway-manager-reload-policy-*.test.ts` 或新增专用用例（以现有目录为准）。

## 实现后检查清单

- [ ] `pnpm run typecheck`、`pnpm test` 通过。
- [ ] 若对外行为或排障说明有变，按 `AGENTS.md` 评估是否更新 `README.md` / `README.zh-CN.md` / `README.ja-JP.md`。

## 后续（不在本 spec 范围）

- 选项 **B**：按 OpenClaw 能力与实测，收紧 `FORCE_RESTART_CHANNELS`。
- 架构级：独立 controller sidecar（Nexu 完整对齐）。
