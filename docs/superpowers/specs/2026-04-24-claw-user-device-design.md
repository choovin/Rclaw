# Claw 用户设备注册与心跳（业务云）设计

## 背景与依据

- 接口契约见仓库内 [`docs/api-docs/08_Claw_User_Device_API.md`](../../api-docs/08_Claw_User_Device_API.md)：  
  `POST /app-api/claw/user/device/register`、`PUT /app-api/claw/user/device/{id}/heartbeat`。  
- RClaw 侧业务云请求应经 Main 进程发起（`getCloudApiBaseUrl()` + `cloudFetchLogged` 等），与 AGENTS.md 中「渲染进程不直连业务云」一致。

## 已确认产品策略（评审锁定）

| 项 | 决策 |
|----|------|
| 注册时机 | **C**：应用启动后 register 一次（可免登录）；会员 **登录成功** 后再 register 一次并携带 `Authorization`，便于服务端关联用户与设备。 |
| 未登录心跳 | **A**：只要本地已有服务端 `id` 与 `deviceToken`，**未登录也**按固定间隔发 heartbeat（不带 `Authorization`）。 |
| 心跳间隔 | **C**：约 **5 分钟**。 |
| deviceId / fingerprint | **A**：`deviceId` = 与遥测一致的持久化 **`machineId`**（缺失则用 `node-machine-id` 生成并写回）；`fingerprint` = 对 `machineId` 的 **确定性哈希**（如 SHA-256 十六进制 + 固定应用级盐串 `rclaw-claw-user-device-v1`），**不把裸 machineId 作为 fingerprint 上传**。 |
| 心跳失败恢复 | **C**：连续失败达到阈值或判定令牌/设备无效时 **清空** 本地 `deviceToken` 与服务端 `id`，并 **立即** 再执行 register；成功后再恢复心跳节奏。 |

## 范围

- **在范围内**：Main 进程内设备登记、定时心跳、持久化、登录后带 Bearer 的再次 register、日志脱敏、失败恢复与有限退避重试。  
- **不在范围内**：用户可见设置项或状态展示（若后续增加，需按 AGENTS.md 补 E2E）；Gateway WebSocket 心跳（与本文「业务云设备在线」无关）。

## 方案选型

| 方案 | 说明 | 结论 |
|------|------|------|
| 1 Main 单例服务 | register/heartbeat、定时器、持久化均在 Main；登录路径挂载二次 register。 | **采用** |
| 2 Renderer 驱动 Host API | 依赖渲染进程定时或页面可见性。 | 不采用：易在关窗/重载时中断心跳。 |
| 3 绑定 Gateway 生命周期 | 与网关连接耦合。 | 不采用：业务云设备语义与本地网关就绪解耦。 |

## 架构

- 新增 **Main 侧**服务模块（实现时命名可如 `CloudUserDeviceService`）：  
  - 使用 `getCloudApiBaseUrl()` 拼接 `08` 文档中的路径；  
  - 使用 `cloudFetchLogged`，日志上下文标签可如 `claw.user.device`。  
- **不强制**新增供 Renderer 调用的 Host API 路由；若日后需要「开发者手动触发登记」再按需增加 `hostApiFetch` 封装（YAGNI）。

## 请求构造

### Register（POST）

- **Headers**：`Content-Type: application/json`；若本地已有 `deviceToken` 则带 `X-Device-Token`；若 `cloudAuthService.getValidToken()` 存在且当前策略允许带会员头（仅已登录的二次 register）则带 `Authorization: Bearer ...`；**未登录时不得带 `Authorization`**。  
- **Body**：  
  - `deviceId`：持久化 `machineId`（字符串）。  
  - `deviceName`：优先 `os.hostname()`；若 Windows 存在项目内更友好的计算机名工具可复用。  
  - `fingerprint`：见上节确定性哈希。  
  - `platform`：`process.platform`（如 `win32` / `darwin` / `linux`）。  
  - `osVersion`：如 `os.release()` 等与现有依赖一致的来源。  
  - `appVersion`：`app.getVersion()`。

### Heartbeat（PUT）

- 路径中 `{id}` 为 **服务端设备主键**（register 响应 `data.id`），**不是**客户端 `deviceId` 字符串。  
- **Headers**：必填 `X-Device-Token`；已登录时带 `Authorization`（与 `08` 文档「已登录则应携带」一致）。  
- **Body**：无。

### 响应解析

- 与现有业务云接口一致：校验包装字段 **`code === 0` 或 `code === 200`**（与 `CloudAuthService` 中 `memberAuthApiSuccess` 语义对齐）；失败时记入失败逻辑，不将半解析状态写入持久化。

## 时序

1. **App ready**：确保 `machineId` → **register**（无 token 不带 `Authorization`）→ 持久化 `data.id` 与 `data.deviceToken` → 启动 **5 分钟** 心跳定时器。  
2. **会员登录成功**（密码 / 短信 / 微信等任一通路，且在 access token 已持久化之后）：再 **register** 一次，此时带 `Authorization` 与已有 `X-Device-Token`。  
3. **登出**：**不停止**心跳；后续请求 **不带** `Authorization`。不强制登出后立即 register（除非后续产品变更）。

## 持久化（Main）

- 与会员 token **分区隔离**（独立 `electron-store` 键空间或独立 store 文件，实现阶段与现有 `cloud-auth-token-store` / settings 模式对齐）。  
- 至少持久化：  
  - **`serverDeviceId`**：`number`（对应 API 的 `data.id`）；  
  - **`deviceToken`**：`string`。  
- 可选：`lastSuccessfulHeartbeatAt`（排障用）。

## 错误处理与重试

- **心跳**：每次成功将「连续失败计数」**清零**；失败则递增。  
- **需重登条件**（满足任一）：连续失败 **≥ 3**；或 HTTP **401 / 403**；或响应 body 表明令牌/设备无效（若后端有固定 `code`，实现时与 RunNode 约定对齐）。  
- **恢复动作**：删除本地 `serverDeviceId` 与 `deviceToken`，**立即**调用 **register**；成功则写回并维持 5 分钟心跳。  
- **register 失败退避**：立即重试若仍失败，采用 **有限次** 退避（建议最多 **3** 次、间隔 **30s～60s** 量级），避免 tight loop；期间不发 heartbeat（无有效 `id`/`token`）。  
- **启动阶段**：未取得有效 `id`+`deviceToken` 前不发送 heartbeat，仅 register（及退避重试）。

## 安全与日志

- 在 `electron/utils/cloud-fetch-log.ts` 的脱敏逻辑中增加对 **`deviceToken`、`X-Device-Token`**（及响应 JSON 中同名字段若出现）的屏蔽，避免明文写入日志。  
- 单元测试无需覆盖日志实现细节，但实现改动后应人工 spot-check 一条 register 响应日志。

## 登录挂钩（实现约束）

- 登录成功路径当前经 `electron/api/routes/cloud-auth.ts` → `cloudAuthService`。  
- 实现时任选一种低耦合方式：**在 `CloudAuthService` 登录成功写 token 之后调用设备服务**，或在 `main` 组装阶段向认证模块注册 **一次性回调**。  
- 需覆盖所有 **写入了会员 session** 的登录成功分支（密码、短信、微信）；**登出**不需调用设备 register。

## 测试

- **单元测试**：响应解析、失败计数、触发清空+立即 register 的判定、退避次数上限（mock `fetch` 或抽取纯函数）。  
- **E2E**：本 spec **无**用户可见 UI 变更时不强制 Playwright；若增加设置或状态展示则按 AGENTS.md 补测。

## 自检摘要

- 无占位符；阈值与间隔已写死为可实施数字；与 `08` 文档及 AGENTS 边界一致。  
- 若实现阶段发现后端仅接受 `code === 0`，可在不改动本策略的前提下收紧解析条件。
