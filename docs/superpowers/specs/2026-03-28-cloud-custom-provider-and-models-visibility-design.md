# 登录下发唯一 Custom 供应商与「安全模型」页可见性设计

**日期**：2026-03-28  
**状态**：已定稿（待实现）

---

## 1. 概述

用户登录业务云成功后，由 Main 代理调用会员接口获取 **`baseUrl`** 与 **API 密钥**（后端字段名可为 `apiKey` 或 `platformAccessToken`，客户端统一落入现有 API Key 存储），并写入 **唯一一条** `vendorId === custom` 的供应商账号；**主模型与回退模型列表在客户端常量写死**。协议固定为 **OpenAI Completions**（`openai-completions`），与当前「自定义 AI 模型提供商」手动配置一致。

登出时 **完整清除** 该云端下发的 custom 配置（账号记录 + 密钥，与需求一致）。

「安全模型」页（`/models`）仅在 **本地 Vite 开发构建**（`import.meta.env.DEV === true`）下提供入口与路由；**生产 / 打包构建下无侧栏入口、无备用入口**（不依赖 Settings「开发者模式」等开关作为后门）。

---

## 2. 常量（客户端写死）

| 项 | 值 |
|----|-----|
| 主模型 ID | `MiniMax-M2.7-highspeed` |
| 回退顺序（`fallbackModels`） | `MiniMax-M2.5-highspeed`、`MiniMax-M2.7`、`minimax-m2.5`、`kimi-k2.5`、`glm-5` |
| `apiProtocol` | `openai-completions` |

---

## 3. 云端接口

- **路径**：与仓库文档一致，使用 **`GET /app-api/member/new-api/config`**（见 `docs/api-docs/04_Member_API.md` → `AppConsumerApiController`）。若后端实际路径不同，在实现时同步改文档与代码。
- **鉴权**：使用当前登录会员会话（与现有 cloud auth 存 token、请求头转发方式一致；具体由 Main / `cloudAuthService` 与现有 `hostapi:fetch` 或网关代理路径对齐实现）。
- **响应（逻辑字段）**：至少包含 **`baseUrl`**、**密钥**（`apiKey` 或 `platformAccessToken` 二选一或兼容解析）；其它模型相关字段由客户端忽略，以常量为准。

---

## 4. 唯一 Custom 供应商语义

- 产品中 **只保留一条** 业务云驱动的 custom 账号：使用 **稳定 `accountId`**（实现时选定常量，如 `cloud-custom` / `runnode-custom`，全仓库唯一）。
- **登录成功**（所有写入 `isLoggedIn === true` 的路径）及 **冷启动且已登录**（`syncAuthFromHost` 判定已登录）后：拉取 config → **upsert** 该 `accountId`（`vendorId: custom`，`baseUrl`、密钥、`model`、`fallbackModels`、`apiProtocol` 如上）。
- **设默认**：成功写入后，将 **默认供应商** 指向该 `accountId`，保证聊天立即使用该网关。
- **与其它 custom 冲突**：若本地已存在多条 `vendorId === custom`，在 **首次应用本逻辑时** 删除/合并为仅保留上述稳定 id（实现细节在 plan 中定：以「仅保留云端 id」为准，避免用户看到两条 custom）。**生产环境下不允许用户再通过 UI 新增第二条 custom**（与「唯一」一致；开发环境是否放宽可在实现 plan 中二选一，默认与 prod 一致以免行为分叉）。

---

## 5. 登出行为

- 调用现有登出 API 成功后（或同一事务内）：**删除**该稳定 `accountId` 的 provider 记录，并 **清除**其 API Key（keychain / secure storage）。
- 若删除后当前默认账号指向已删 id，**默认供应商**应回退到明确策略（实现 plan：例如清空默认或回退到首个仍存在的已配置账号），避免指向幽灵 id。

---

## 6. 「安全模型」页与路由（`/models`）

| 构建 | 侧栏「安全模型」 | 路由 `/models` |
|------|------------------|------------------|
| `import.meta.env.DEV` | 显示 | 可访问 |
| `import.meta.env.PROD`（打包） | **不显示** | **不注册路由或统一重定向到安全页（如聊天/首页）**；**禁止**通过 `devModeUnlocked`、deeplink、隐藏手势等进入 |

---

## 7. 错误处理（摘要）

- Config 拉取失败：toast 或等价提示；**不**因失败而误删已有可用配置（若已有同 id 账号可保留上次成功写入；具体以 plan 为准）。
- 部分字段缺失：视为失败，不写入半套配置。

---

## 8. 测试建议

- 单元：解析响应、常量 fallback 顺序、PROD 下路由/导航不可达（可用 Vitest + 对路由表的断言或封装 `isModelsPageEnabled`）。
- 手动：dev 下可见 Models；`pnpm build` 产物中无入口且直访 `/models` 被重定向。

---

## 9. 与现有架构的约束

- Renderer 经 **`host-api` / `api-client`** 触发 Main 侧能力；不新增 renderer 直连 `127.0.0.1:18789` 或裸 `ipcRenderer.invoke` 业务调用。
- 会员 HTTP 契约变更时同步更新 `docs/api-docs/04_Member_API.md`。

---

## 10. 自检记录

- 无 TBD：接口路径以后端对齐为准已在 §3 说明。
- 与上文无矛盾：唯一 custom、登出清除、生产无 Models 后门。
- 范围：本 spec 仅描述登录下发供应商与 Models 可见性；不扩展其它会员功能。
