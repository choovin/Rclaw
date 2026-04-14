# OpenClaw Gateway reload 能力 Spike（RClaw 捆绑版本）

## 版本

- 应用依赖：`package.json` → `"openclaw": "2026.4.11"`（日历版本号）。

## 文档结论（随包 `node_modules/openclaw`）

- `docs/cli/secrets.md`：CLI `openclaw secrets reload` 使用 Gateway WebSocket JSON-RPC 方法 **`secrets.reload`**，用于 **SecretRef 解析与运行时快照原子替换**，**不写**配置文件。
- 未发现与「整份 `openclaw.json` 模型/渠道配置」等价的独立 RPC 名称在本文档中列出（如 `config.reload` / `gateway.reload`）。

## 与 RClaw 现有行为的关系

- **macOS / Linux**：`GatewayManager.reload()` 向 Gateway 子进程发 **SIGUSR1**，由 OpenClaw 内部处理进程内重载（与 Nexu 的「写配置 + 热更新」目标一致，信号仅 Unix 可用）。
- **Windows**：无 SIGUSR1；需替代路径。

## 实现决策（范围 A）

1. **主路径**：对默认配置文件 **`~/.openclaw/openclaw.json`**（与 `electron/gateway/reload-policy.ts` 读取策略时使用的路径一致）执行 **`appendFile(path, '', 'utf8')`** 触发 mtime 更新，与 Nexu `touchConfig` 一致，依赖 OpenClaw Gateway 对配置文件的监视/重载逻辑。
2. **补充（最佳 effort）**：在 touch **成功之后**，**可选** `await rpc('secrets.reload', …)`；失败则忽略（不影响 `ok: true`），因 SecretRef 与明文配置变更可能同时存在，`secrets.reload` 仅覆盖密钥快照而非整份 JSON。
3. **不得**仅因 `secrets.reload` 成功且未 touch，即视为完成「保存 provider/模型」类全量配置刷新（与 spec 一致）。

## 检索说明

- 对 `node_modules/openclaw/dist` 大规模 `findstr`/`rg` 在 Windows 上可能较慢；上述结论以 **随包 Markdown 文档 + RClaw 既有 Unix SIGUSR1 行为** 为准。若未来 OpenClaw 增加显式 `config.reload` RPC，可在 `electron/gateway/windows-reload.ts` 中 **先于 touch** 探测并优先使用。
