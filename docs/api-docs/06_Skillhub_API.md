# Skillhub API

业务云 Skillhub 相关接口。RClaw 桌面端在 Electron Main 中通过 **无鉴权** GET 代理转发至 `{业务云 API 根}/app-api/skillhub/skills`（业务云根地址来自 `getCloudApiBaseUrl()`，与渲染进程环境变量 `VITE_CLOUD_API_BASE_URL` 对齐）；渲染进程请使用 `hostApiFetch('/api/cloud/skillhub/skills?...')`，勿直连云端以免 CORS/环境不一致。

## GET `/app-api/skillhub/skills`

分页查询已发布的技能列表（公开列表，代理请求 **不** 携带 `Authorization`）。

### 请求

- **完整 URL**：`{VITE_CLOUD_API_BASE_URL}/app-api/skillhub/skills`
- **Query 参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `q` | string | 否 | 搜索关键词；不传或空表示不按关键词过滤 |
| `pageNo` | number | 是* | 页码，从 `1` 起 |
| `pageSize` | number | 是* | 每页条数；**RClaw 客户端固定为 `15`** |

\* 具体是否必填以网关校验为准；RClaw 始终传 `pageNo` 与 `pageSize`。

示例：

```http
GET /app-api/skillhub/skills?pageNo=1&pageSize=15&q=
```

### 响应

顶层为业务统一包装（与示例 `temp/res.json` 一致）：

| 字段 | 类型 | 说明 |
|------|------|------|
| `code` | number | `0` 表示成功 |
| `msg` | string | 提示信息，如 `"SUCCESS"` |
| `data` | object | 载荷 |
| `data.total` | number | 符合条件的总条数（分页用） |
| `data.list` | array | 当前页技能条目 |

#### `data.list[]` 单条技能字段

与线上返回对齐，常用字段如下（未列字段可能随版本扩展）：

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | number | 技能记录 ID |
| `slug` | string | 唯一 slug，安装与外链使用 |
| `displayName` | string | 展示名称 |
| `summary` | string | 摘要描述 |
| `status` | string | 状态，如 `ACTIVE` |
| `downloadCount` | number | 下载次数 |
| `starCount` | number | 收藏/星标数 |
| `ratingAvg` | number | 平均评分 |
| `ratingCount` | number | 评分数 |
| `namespace` | string | 命名空间，如 `global` |
| `updatedAt` | string | ISO 8601 更新时间 |
| `canSubmitPromotion` | boolean | 是否可提交推广等（运营相关） |
| `headlineVersion` | object \| null | 头图/主展示版本信息，见下表 |
| `publishedVersion` | object \| null | 当前发布版本信息，见下表 |
| `ownerPreviewVersion` | object \| null | 所有者预览版本（若有） |
| `resolutionMode` | string | 解析模式，如 `PUBLISHED` |

**版本信息对象**（`headlineVersion` / `publishedVersion` / `ownerPreviewVersion` 结构类似）：

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | number | 版本记录 ID |
| `version` | string | 版本号 |
| `status` | string | 如 `PUBLISHED` |

### 响应示例（节选）

```json
{
  "code": 0,
  "msg": "SUCCESS",
  "data": {
    "total": 249,
    "list": [
      {
        "id": 31112,
        "slug": "lap-account-v1-api",
        "displayName": "lap-account-v1-api",
        "summary": "Account v1 API skill...",
        "status": "ACTIVE",
        "downloadCount": 0,
        "starCount": 0,
        "ratingAvg": 0,
        "ratingCount": 0,
        "namespace": "global",
        "updatedAt": "2026-04-15T01:22:54.816776Z",
        "canSubmitPromotion": false,
        "headlineVersion": {
          "id": 33250,
          "version": "1.0.0",
          "status": "PUBLISHED"
        },
        "publishedVersion": {
          "id": 33250,
          "version": "1.0.0",
          "status": "PUBLISHED"
        },
        "ownerPreviewVersion": null,
        "resolutionMode": "PUBLISHED"
      }
    ]
  }
}
```
