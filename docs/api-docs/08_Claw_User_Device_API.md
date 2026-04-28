# Claw 用户设备 API（注册与心跳）

业务云「Claw 用户设备」相关接口，用于客户端设备登记与在线心跳上报。完整 URL 为 `{业务云 API 根}/app-api/claw/user/device/...`（根地址与 RClaw 中 `getCloudApiBaseUrl()`、`VITE_CLOUD_API_BASE_URL` 对齐）。

## 通用约定

### 鉴权（`Authorization`）

- **未登录用户**：请求中**不要**携带会员 `Authorization`（Bearer access token）；接口支持**免登录**访问。
- **已登录用户**：若本地存在有效会员登录态，请求中**应**携带 `Authorization: Bearer <accessToken>`，便于服务端关联用户与设备（具体以后端策略为准）。

### 其它请求头

| 头名称 | 说明 |
|--------|------|
| `Content-Type` | 注册接口为 `application/json` |
| `accept` | 可选，如 `*/*` |

### 响应包装

成功时与其它业务云接口一致，常见为：

```json
{
  "code": 0,
  "msg": "SUCCESS",
  "data": { ... }
}
```

---

## POST `/app-api/claw/user/device/register`

注册或更新当前设备信息。

### 请求

- **方法**：`POST`
- **路径**：`/app-api/claw/user/device/register`

#### Headers

| 头名称 | 必填 | 说明 |
|--------|------|------|
| `Content-Type` | 是 | `application/json` |
| `Authorization` | 否 | 已登录则携带 `Bearer <accessToken>` |

#### Body（JSON）

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `deviceId` | string | 是 | 客户端侧稳定设备标识 |
| `deviceName` | string | 是 | 设备展示名，如 `MacBook Pro` |
| `fingerprint` | string | 是 | 设备指纹哈希等 |
| `platform` | string | 是 | 平台，如 `darwin`、`win32`、`linux` |
| `osVersion` | string | 是 | 操作系统版本，如 `14` |
| `appVersion` | string | 是 | 客户端应用版本，如 `1.0.0` |

#### 请求示例（curl）

```bash
curl -X 'POST' \
  'https://runnode-staging-runnode-backend.bytebroad.com/app-api/claw/user/device/register' \
  -H 'accept: */*' \
  -H 'Content-Type: application/json' \
  -d '{
  "deviceId": "device111111111111",
  "deviceName": "MacBook Pro",
  "fingerprint": "fingerprint-hash",
  "platform": "darwin",
  "osVersion": "14",
  "appVersion": "1.0.0"
}'
```

（按需增加 `Authorization`。）

### 响应

#### `data` 字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | number | 服务端设备记录 ID；心跳路径中的 `{id}` 使用该值 |
| `newlyCreated` | boolean | 是否本次为新建设备记录 |

#### 响应示例

```json
{
  "code": 0,
  "msg": "SUCCESS",
  "data": {
    "id": 7,
    "newlyCreated": true
  }
}
```

---

## PUT `/app-api/claw/user/device/{id}/heartbeat`

上报设备心跳，保持在线状态。路径参数 **`{id}`** 为注册接口返回的 **`data.id`**（服务端设备主键），不是客户端本地 `deviceId` 字符串。

### 请求

- **方法**：`PUT`
- **路径**：`/app-api/claw/user/device/{id}/heartbeat`

#### Headers

| 头名称 | 必填 | 说明 |
|--------|------|------|
| `Authorization` | 否 | 已登录则携带 `Bearer <accessToken>` |

#### Body

无请求体。

#### 请求示例（curl）

```bash
curl -X 'PUT' \
  'https://runnode-staging-runnode-backend.bytebroad.com/app-api/claw/user/device/7/heartbeat' \
  -H 'accept: */*'
```

（已登录时可增加 `Authorization`。）

### 响应

成功时 `data` 为布尔值，例如：

```json
{
  "code": 0,
  "msg": "string",
  "data": true
}
```

---

## RClaw 对接提示

- 渲染进程调用业务云接口应通过 Main 进程代理（`hostApiFetch` / `host-api` 约定路径），避免渲染层直连云端导致 CORS 或环境不一致；若尚未封装对应代理路由，实现时与现有 `/app-api/claw/*` 代理方式保持一致。
- 本地需持久化 **`data.id`**（用于拼心跳 URL `.../device/{id}/heartbeat`）。
