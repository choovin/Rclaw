# Claw Catalog API（数字员工市场）

业务云「数字员工（Claw Catalog）」相关接口。RClaw 在 Electron Main 中通过 **GET** 代理转发至 `{业务云 API 根}/app-api/claw/catalog/*`（根地址来自 `getCloudApiBaseUrl()`，与 `VITE_CLOUD_API_BASE_URL` 对齐）；渲染进程请使用 `hostApiFetch('/api/cloud/claw/catalog/...')`，勿直连云端。

目录列表与分页列表为**公开可读**（与 Skillhub 列表类似）；代理实现见 `electron/api/routes/cloud-claw-catalog.ts`。

## GET `/app-api/claw/catalog/departments`

获取部门列表（无 Query）。

**渲染进程代理路径：** `GET /api/cloud/claw/catalog/departments`

响应 `data` 为部门对象数组，字段含：`id`、`department`、`departmentNameZh`、`logo`、`parentId`、`sort`、`children`、`createTime`、`updateTime`。

## GET `/app-api/claw/catalog/agents`

分页查询数字员工目录。

**渲染进程代理路径：** `GET /api/cloud/claw/catalog/agents?...`

### Query 参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `pageNo` | number | 是 | 页码，从 `1` 起 |
| `pageSize` | number | 是 | 每页条数，最大 `100`；RClaw 客户端使用 `CLAW_CATALOG_PAGE_SIZE`（当前 `20`） |
| `keyword` | string | 否 | 关键词 |
| `departmentId` | number | 否 | 部门 ID |
| `tier` | string | 否 | 等级筛选 |

### 响应

`data.total`、`data.list[]`。列表项字段与详情接口 `data` 一致（含 `bundleId`、`name`、`soulContent` 等长字段，以后端为准）。

## GET `/app-api/claw/catalog/agent/{bundleId}`

按 `bundleId` 查询单条数字员工完整定义。

**渲染进程代理路径：** `GET /api/cloud/claw/catalog/agent/{bundleId}`（`bundleId` 需 URL 编码）

响应 `data` 为单个数字员工对象；RClaw 在**添加员工（provision）前**调用本接口以获取最新长文本再写入本地工作区。

---

更细字段说明可参考仓库内 `temp/claw-catalog-departments-api.md`、`temp/claw-catalog-agents-paging-api.md`、`temp/claw-catalog-agent-detail-api.md`。
