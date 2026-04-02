# Member 会员模块 API

> 由 `api-docs/generate_api_docs.py` 从 Controller 源码扫描生成，路径为**完整 URL 路径**（已含 `/admin-api`、`/app-api` 或 `/open-api`）。
> 生成时间（UTC）：2026-03-28 09:29:32
> 接口条数：**202**

---

## `AddressController`

| 方法 | 路径 | 说明（@Operation summary） |
|------|------|---------------------------|
| GET | `/admin-api/member/address/list` | 获得用户收件地址列表 |

## `AppAddressController`

| 方法 | 路径 | 说明（@Operation summary） |
|------|------|---------------------------|
| POST | `/app-api/member/address/create` | 创建用户收件地址 |
| DELETE | `/app-api/member/address/delete` | 删除用户收件地址 |
| GET | `/app-api/member/address/get` | 获得用户收件地址 |
| GET | `/app-api/member/address/get-default` | 获得默认的用户收件地址 |
| GET | `/app-api/member/address/list` | 获得用户收件地址列表 |
| PUT | `/app-api/member/address/update` | 更新用户收件地址 |

## `AppAuthController`

| 方法 | 路径 | 说明（@Operation summary） |
|------|------|---------------------------|
| POST | `/app-api/member/auth/create-weixin-jsapi-signature` | 创建微信 JS SDK 初始化所需的签名 |
| POST | `/app-api/member/auth/login` | 使用手机 + 密码登录 |
| POST | `/app-api/member/auth/logout` | 登出系统 |
| POST | `/app-api/member/auth/refresh-token` | 刷新令牌 |

**`POST /app-api/member/auth/refresh-token`（RClaw 调用约定）**

- **Query**：`refreshToken`（必填），登录或上次刷新下发的刷新令牌。
- **Body**：无（仅 `POST` + query）。
- **成功体**：`{ code: 0 \| 200, data: AppAuthLoginRespVO }`；`data` 含 `accessToken`、**`refreshToken`（若服务端轮换则必存新值）**、`expiresTime`（常见为毫秒时间戳或 `LocalDateTime` 的 JSON 字符串）、`userId` 等，与登录响应同类字段一致。
| POST | `/app-api/member/auth/register` | 使用手机 + 密码注册 |
| POST | `/app-api/member/auth/send-sms-code` | 发送手机验证码 |
| POST | `/app-api/member/auth/sms-login` | 使用手机 + 验证码登录 |
| GET | `/app-api/member/auth/social-auth-redirect` | 社交授权的跳转 |
| POST | `/app-api/member/auth/social-login` | 社交快捷登录，使用 code 授权码 |
| POST | `/app-api/member/auth/validate-sms-code` | 校验手机验证码 |
| POST | `/app-api/member/auth/weixin-mini-app-login` | 微信小程序的一键登录 |

## `AppConsumerApiController`

| 方法 | 路径 | 说明（@Operation summary） |
|------|------|---------------------------|
| GET | `/app-api/member/new-api/config` | 获取平台 API 供应商配置 |

**`GET /app-api/member/new-api/config`（RClaw 消费约定）**

- 需会员登录态（与其它 `/app-api/member/*` 一致）。
- 典型响应包裹：`{ code: 0 | 200, data: { ... } }`；业务字段在 `data` 内（若后端扁平返回，客户端亦兼容）。
- **`data.baseUrl`**（string，优先）：OpenAI 兼容网关根地址。
- **`data.apiUrl`**（string，可选）：与 `baseUrl` 二选一；仅当 `baseUrl` 为空时使用。
- RClaw 会规范化地址：**若末尾不是 `/v1`（忽略大小写）则自动追加 `/v1`**，以便与 OpenAI Completions 路径对齐。
- **`data.apiKey`**（string）：OpenAI 兼容网关的 API Key（**权威字段**）。客户端写入系统密钥库（ClawX 存储），并同步到 **`~/.openclaw/openclaw.json`** 的 `models.providers.<runtimeKey>.apiKey`，供 Gateway 直接读取生效。
- **`data.platformAccessToken`**（string，可选）：历史/错误文档中的命名；若存在且无 `apiKey`，客户端仍会当作密钥使用。

## `AppMemberCommentController`

| 方法 | 路径 | 说明（@Operation summary） |
|------|------|---------------------------|
| GET | `/app-api/member/comment/page` | 获得会员评论树形分页 |

## `AppMemberExperienceRecordController`

| 方法 | 路径 | 说明（@Operation summary） |
|------|------|---------------------------|
| GET | `/app-api/member/experience-record/page` | 获得会员经验记录分页 |

## `AppMemberFavoritesController`

| 方法 | 路径 | 说明（@Operation summary） |
|------|------|---------------------------|
| DELETE | `/app-api/member/favorites/delete` | 删除会员收藏夹 |
| DELETE | `/app-api/member/favorites/delete-list` | — |

## `AppMemberInviteController`

| 方法 | 路径 | 说明（@Operation summary） |
|------|------|---------------------------|
| POST | `/app-api/member/invite/bindInviteCode` | 会员填写邀请码绑定邀请人 |
| GET | `/app-api/member/invite/get-display-invite-code` | 获取会员展示邀请码 |
| GET | `/app-api/member/invite/getInviteLogList` | 获取会员的邀请记录 |
| GET | `/app-api/member/invite/getInviteMember` | 获取邀请会员注册的会员 |

## `AppMemberLevelController`

| 方法 | 路径 | 说明（@Operation summary） |
|------|------|---------------------------|
| GET | `/app-api/member/level/list` | 获得会员等级列表 |

## `AppMemberPointRecordController`

| 方法 | 路径 | 说明（@Operation summary） |
|------|------|---------------------------|
| GET | `/app-api/member/point/record/page` | 获得用户积分记录分页 |

## `AppMemberSignInConfigController`

| 方法 | 路径 | 说明（@Operation summary） |
|------|------|---------------------------|
| GET | `/app-api/member/sign-in/config/list` | 获得签到规则列表 |

## `AppMemberSignInRecordController`

| 方法 | 路径 | 说明（@Operation summary） |
|------|------|---------------------------|
| POST | `/app-api/member/sign-in/record/create` | 签到 |
| GET | `/app-api/member/sign-in/record/page` | 获得签到记录分页 |

## `AppMemberUserController`

| 方法 | 路径 | 说明（@Operation summary） |
|------|------|---------------------------|
| GET | `/app-api/member/user/get` | 获得基本信息 |
| PUT | `/app-api/member/user/reset-password` | 重置密码 |
| PUT | `/app-api/member/user/update` | 修改基本信息 |
| PUT | `/app-api/member/user/update-mobile` | 修改用户手机 |
| PUT | `/app-api/member/user/update-mobile-by-weixin` | 基于微信小程序的授权码，修改用户手机 |
| PUT | `/app-api/member/user/update-password` | 修改用户密码 |

## `AppMemberVipController`

| 方法 | 路径 | 说明（@Operation summary） |
|------|------|---------------------------|
| GET | `/app-api/member/vip/get` | 获取当前登录用户会员信息 |
| GET | `/app-api/member/vip/list` | 获取当前登录用户所有有效会员信息 |

## `AppMemberWalletChangeLogController`

| 方法 | 路径 | 说明（@Operation summary） |
|------|------|---------------------------|
| GET | `/app-api/member/wallet/changeLog/addCoinList` | 获取当前登录用户算力币获取明细列表 |
| GET | `/app-api/member/wallet/changeLog/cashConsumeList` | 获取当前用户现金消耗明细 |
| GET | `/app-api/member/wallet/changeLog/consumeCoinList` | 获取当前用户算力币消耗明细 |
| GET | `/app-api/member/wallet/changeLog/list` | 获取当前登录用户的会员钱包余额变更记录列表 |

## `AppMemberWalletCoinController`

| 方法 | 路径 | 说明（@Operation summary） |
|------|------|---------------------------|
| GET | `/app-api/member/wallet/coin/list` | 获取当前登录用户的会员钱包算力币列表 |

## `AppMemberWalletCoinDetailsController`

| 方法 | 路径 | 说明（@Operation summary） |
|------|------|---------------------------|
| GET | `/app-api/member/wallet/coin/details/list` | 获取当前登录用户的会员钱包算力币明细列表 |
| GET | `/app-api/member/wallet/coin/details/list-order-by-validity` | 获取当前登录用户的会员钱包算力币明细列表（按有效期排序） |

## `AppMemberWalletController`

| 方法 | 路径 | 说明（@Operation summary） |
|------|------|---------------------------|
| GET | `/app-api/member/wallet/list` | 获取当前登录用户的会员钱包列表 |

## `AppOpenApiController`

| 方法 | 路径 | 说明（@Operation summary） |
|------|------|---------------------------|
| GET | `/app-api/member/open-api/app/billing/get` | 获取单条消费记录详情 |
| GET | `/app-api/member/open-api/app/billing/page` | 获取消费记录分页 |
| GET | `/app-api/member/open-api/app/call-log/get` | 获取单条调用记录详情 |
| GET | `/app-api/member/open-api/app/call-log/page` | 获取 API 调用记录分页 |
| POST | `/app-api/member/open-api/app/createConsumerApp` | 创建/重置消费型 AppKey |
| POST | `/app-api/member/open-api/app/enterprise/create` | 创建企业型 AppKey |
| DELETE | `/app-api/member/open-api/app/enterprise/delete` | 删除企业型 AppKey |
| GET | `/app-api/member/open-api/app/enterprise/get` | 获取单个企业型 AppKey 详情 |
| GET | `/app-api/member/open-api/app/enterprise/list` | 获取企业型 AppKey 列表 |
| GET | `/app-api/member/open-api/app/enterprise/page` | 获取企业型 AppKey 分页 |
| POST | `/app-api/member/open-api/app/enterprise/reset` | 重置企业型 AppKey |
| GET | `/app-api/member/open-api/app/enterprise/statistics` | 获取企业型 API 统计信息 |
| PUT | `/app-api/member/open-api/app/enterprise/update` | 更新企业型 AppKey 名称 |
| GET | `/app-api/member/open-api/app/getConsumerApp` | 获取当前会员的消费型 AppKey |
| POST | `/app-api/member/open-api/app/resetConsumerApp` | 重置消费型 AppKey |
| GET | `/app-api/member/open-api/app/statistics` | 获取 API 使用统计 |

## `AppSocialUserController`

| 方法 | 路径 | 说明（@Operation summary） |
|------|------|---------------------------|
| POST | `/app-api/member/social-user/bind` | 社交绑定，使用 code 授权码 |
| GET | `/app-api/member/social-user/get` | 获得社交用户 |
| GET | `/app-api/member/social-user/get-subscribe-template-list` | 获得微信小程订阅模板列表 |
| DELETE | `/app-api/member/social-user/unbind` | 取消社交绑定 |
| POST | `/app-api/member/social-user/wxa-qrcode` | 获得微信小程序码(base64 image) |

## `MemberCommentController`

| 方法 | 路径 | 说明（@Operation summary） |
|------|------|---------------------------|
| POST | `/admin-api/member/comment/create` | 创建会员评论 |
| DELETE | `/admin-api/member/comment/delete` | 删除会员评论 |
| DELETE | `/admin-api/member/comment/delete-list` | 批量删除会员评论 |
| GET | `/admin-api/member/comment/export-excel` | 导出会员评论 Excel |
| GET | `/admin-api/member/comment/get` | 获得会员评论 |
| GET | `/admin-api/member/comment/page` | 获得会员评论分页 |
| PUT | `/admin-api/member/comment/update` | 更新会员评论 |

## `MemberConfigController`

| 方法 | 路径 | 说明（@Operation summary） |
|------|------|---------------------------|
| GET | `/admin-api/member/config/get` | 获得会员配置 |
| PUT | `/admin-api/member/config/save` | 保存会员配置 |

## `MemberExperienceRecordController`

| 方法 | 路径 | 说明（@Operation summary） |
|------|------|---------------------------|
| GET | `/admin-api/member/experience-record/get` | 获得会员经验记录 |
| GET | `/admin-api/member/experience-record/page` | 获得会员经验记录分页 |

## `MemberFavoritesController`

| 方法 | 路径 | 说明（@Operation summary） |
|------|------|---------------------------|
| POST | `/admin-api/member/favorites/create` | 创建会员收藏夹 |
| DELETE | `/admin-api/member/favorites/delete` | 删除会员收藏夹 |
| DELETE | `/admin-api/member/favorites/delete-list` | 批量删除会员收藏夹 |
| GET | `/admin-api/member/favorites/export-excel` | 导出会员收藏夹 Excel |
| GET | `/admin-api/member/favorites/get` | 获得会员收藏夹 |
| GET | `/admin-api/member/favorites/page` | 获得会员收藏夹分页 |
| PUT | `/admin-api/member/favorites/update` | 更新会员收藏夹 |

## `MemberGoodsGiveLogController`

| 方法 | 路径 | 说明（@Operation summary） |
|------|------|---------------------------|
| DELETE | `/admin-api/member/goods-give-log/delete` | 删除会员商品赠送记录 |
| GET | `/admin-api/member/goods-give-log/get` | 获得会员商品赠送记录 |
| GET | `/admin-api/member/goods-give-log/page` | 获得会员商品赠送记录分页 |
| GET | `/admin-api/member/goods-give-log/page-with-user` | 获得会员商品赠送记录分页（包含会员信息） |

## `MemberGroupController`

| 方法 | 路径 | 说明（@Operation summary） |
|------|------|---------------------------|
| POST | `/admin-api/member/group/create` | 创建用户分组 |
| DELETE | `/admin-api/member/group/delete` | 删除用户分组 |
| GET | `/admin-api/member/group/get` | 获得用户分组 |
| GET | `/admin-api/member/group/list-all-simple` | 获取会员分组精简信息列表 |
| GET | `/admin-api/member/group/page` | 获得用户分组分页 |
| PUT | `/admin-api/member/group/update` | 更新用户分组 |

## `MemberInviteActivityController`

| 方法 | 路径 | 说明（@Operation summary） |
|------|------|---------------------------|
| POST | `/admin-api/member/invite-activity/create` | 创建邀请活动 |
| DELETE | `/admin-api/member/invite-activity/delete` | 删除邀请活动 |
| PUT | `/admin-api/member/invite-activity/disable` | 停用邀请活动 |
| PUT | `/admin-api/member/invite-activity/enable` | 启用邀请活动 |
| GET | `/admin-api/member/invite-activity/get` | 获得邀请活动详情 |
| GET | `/admin-api/member/invite-activity/page` | 获得邀请活动分页 |
| PUT | `/admin-api/member/invite-activity/update` | 更新邀请活动 |

## `MemberInviteLogController`

| 方法 | 路径 | 说明（@Operation summary） |
|------|------|---------------------------|
| POST | `/admin-api/member/invite-log/create` | 创建会员邀请记录 |
| DELETE | `/admin-api/member/invite-log/delete` | 删除会员邀请记录 |
| DELETE | `/admin-api/member/invite-log/delete-list` | 批量删除会员邀请记录 |
| GET | `/admin-api/member/invite-log/export-excel` | 导出会员邀请记录 Excel |
| GET | `/admin-api/member/invite-log/get` | 获得会员邀请记录 |
| GET | `/admin-api/member/invite-log/page` | 获得会员邀请记录分页 |
| PUT | `/admin-api/member/invite-log/update` | 更新会员邀请记录 |

## `MemberLevelController`

| 方法 | 路径 | 说明（@Operation summary） |
|------|------|---------------------------|
| POST | `/admin-api/member/level/create` | 创建会员等级 |
| DELETE | `/admin-api/member/level/delete` | 删除会员等级 |
| GET | `/admin-api/member/level/get` | 获得会员等级 |
| GET | `/admin-api/member/level/list` | 获得会员等级列表 |
| GET | `/admin-api/member/level/list-all-simple` | 获取会员等级精简信息列表 |
| PUT | `/admin-api/member/level/update` | 更新会员等级 |

## `MemberLevelRecordController`

| 方法 | 路径 | 说明（@Operation summary） |
|------|------|---------------------------|
| GET | `/admin-api/member/level-record/get` | 获得会员等级记录 |
| GET | `/admin-api/member/level-record/page` | 获得会员等级记录分页 |

## `MemberLikeController`

| 方法 | 路径 | 说明（@Operation summary） |
|------|------|---------------------------|
| GET | `/admin-api/member/like/page` | 获得会员点赞分页 |

## `MemberPointRecordController`

| 方法 | 路径 | 说明（@Operation summary） |
|------|------|---------------------------|
| GET | `/admin-api/member/point/record/page` | 获得用户积分记录分页 |

## `MemberSignInConfigController`

| 方法 | 路径 | 说明（@Operation summary） |
|------|------|---------------------------|
| POST | `/admin-api/member/sign-in/config/create` | 创建签到规则 |
| DELETE | `/admin-api/member/sign-in/config/delete` | 删除签到规则 |
| GET | `/admin-api/member/sign-in/config/get` | 获得签到规则 |
| GET | `/admin-api/member/sign-in/config/list` | 获得签到规则列表 |
| PUT | `/admin-api/member/sign-in/config/update` | 更新签到规则 |

## `MemberSignInRecordController`

| 方法 | 路径 | 说明（@Operation summary） |
|------|------|---------------------------|
| GET | `/admin-api/member/sign-in/record/page` | 获得签到记录分页 |

## `MemberTagController`

| 方法 | 路径 | 说明（@Operation summary） |
|------|------|---------------------------|
| POST | `/admin-api/member/tag/create` | 创建会员标签 |
| DELETE | `/admin-api/member/tag/delete` | 删除会员标签 |
| GET | `/admin-api/member/tag/get` | 获得会员标签 |
| GET | `/admin-api/member/tag/list` | 获得会员标签列表 |
| GET | `/admin-api/member/tag/list-all-simple` | 获取会员标签精简信息列表 |
| GET | `/admin-api/member/tag/page` | 获得会员标签分页 |
| PUT | `/admin-api/member/tag/update` | 更新会员标签 |

## `MemberUserController`

| 方法 | 路径 | 说明（@Operation summary） |
|------|------|---------------------------|
| GET | `/admin-api/member/user/get` | 获得会员用户 |
| GET | `/admin-api/member/user/get-display-invite-code` | 获取会员展示邀请码 |
| POST | `/admin-api/member/user/give-balance` | 赠送会员余额 |
| POST | `/admin-api/member/user/give-coin` | 赠送会员算力币 |
| POST | `/admin-api/member/user/give-vip` | 赠送会员VIP |
| GET | `/admin-api/member/user/page` | 获得会员用户分页 |
| PUT | `/admin-api/member/user/set-super-referrer` | 设置/取消超级推荐人 |
| PUT | `/admin-api/member/user/update` | 更新会员用户 |
| PUT | `/admin-api/member/user/update-level` | 更新会员用户等级 |
| PUT | `/admin-api/member/user/update-point` | 更新会员用户积分 |

## `MemberVipController`

| 方法 | 路径 | 说明（@Operation summary） |
|------|------|---------------------------|
| POST | `/admin-api/member/vip/create` | 创建会员VIP |
| DELETE | `/admin-api/member/vip/delete` | 删除会员VIP |
| GET | `/admin-api/member/vip/get` | 获得会员VIP |
| GET | `/admin-api/member/vip/page` | 获得会员VIP分页 |
| POST | `/admin-api/member/vip/save` | 保存会员VIP |
| PUT | `/admin-api/member/vip/update` | 更新会员VIP |

## `MemberWalletChangeLogController`

| 方法 | 路径 | 说明（@Operation summary） |
|------|------|---------------------------|
| POST | `/admin-api/member/wallet/change-log/create` | 创建会员钱包余额变更记录 |
| DELETE | `/admin-api/member/wallet/change-log/delete` | 删除会员钱包余额变更记录 |
| GET | `/admin-api/member/wallet/change-log/get` | 获得会员钱包余额变更记录 |
| GET | `/admin-api/member/wallet/change-log/page` | 获得会员钱包余额变更记录分页 |
| PUT | `/admin-api/member/wallet/change-log/update` | 更新会员钱包余额变更记录 |

## `MemberWalletCoinController`

| 方法 | 路径 | 说明（@Operation summary） |
|------|------|---------------------------|
| POST | `/admin-api/member/wallet/coin/create` | 创建会员钱包算力币 |
| DELETE | `/admin-api/member/wallet/coin/delete` | 删除会员钱包算力币 |
| GET | `/admin-api/member/wallet/coin/get` | 获得会员钱包算力币 |
| GET | `/admin-api/member/wallet/coin/getByMemberId` | 获得会员钱包算力币 |
| GET | `/admin-api/member/wallet/coin/page` | 获得会员钱包算力币分页 |
| PUT | `/admin-api/member/wallet/coin/update` | 更新会员钱包算力币 |

## `MemberWalletCoinDetailsController`

| 方法 | 路径 | 说明（@Operation summary） |
|------|------|---------------------------|
| POST | `/admin-api/member/wallet/coin/details/create` | 创建会员钱包算力币明细 |
| DELETE | `/admin-api/member/wallet/coin/details/delete` | 删除会员钱包算力币明细 |
| GET | `/admin-api/member/wallet/coin/details/get` | 获得会员钱包算力币明细 |
| GET | `/admin-api/member/wallet/coin/details/list-by-member-id` | 获得会员钱包算力币明细列表 |
| GET | `/admin-api/member/wallet/coin/details/list-by-member-id-order-by-validity` | 获得会员钱包算力币明细列表（按有效期排序） |
| GET | `/admin-api/member/wallet/coin/details/page` | 获得会员钱包算力币明细分页 |
| PUT | `/admin-api/member/wallet/coin/details/update` | 更新会员钱包算力币明细 |

## `MemberWalletController`

| 方法 | 路径 | 说明（@Operation summary） |
|------|------|---------------------------|
| GET | `/admin-api/member/wallet/cash-balance/get` | 获得会员现金类型余额 |
| POST | `/admin-api/member/wallet/create` | 创建会员钱包 |
| DELETE | `/admin-api/member/wallet/delete` | 删除会员钱包 |
| GET | `/admin-api/member/wallet/get` | 获得会员钱包 |
| GET | `/admin-api/member/wallet/getByMemberId` | 获得会员钱包 |
| POST | `/admin-api/member/wallet/handle-wallet-biz` | 处理钱包业务 |
| POST | `/admin-api/member/wallet/handle-wallet-biz-with-coin` | 处理算力币钱包业务 |
| GET | `/admin-api/member/wallet/page` | 获得会员钱包分页 |
| PUT | `/admin-api/member/wallet/update` | 更新会员钱包 |

## `NewApiConsumeWebhookController`

| 方法 | 路径 | 说明（@Operation summary） |
|------|------|---------------------------|
| POST | `/app-api/member/newapi/webhook/consume` | 接收 new-api 消费 Webhook 通知 |
| POST | `/app-api/member/newapi/webhook/verify-token` | 验证 Token 是否可用（供 new-api 调用） |

## `NewApiSyncController`

| 方法 | 路径 | 说明（@Operation summary） |
|------|------|---------------------------|
| GET | `/admin-api/member/newapi/config` | 获得 New-API 集成配置 |
| PUT | `/admin-api/member/newapi/config` | 更新 New-API 集成配置 |
| GET | `/admin-api/member/newapi/consume-logs` | 获得消费同步日志分页 |
| GET | `/admin-api/member/newapi/consume-logs/get` | 获得消费同步日志详情 |
| POST | `/admin-api/member/newapi/init-sync` | 触发存量 AppKey 初始化同步 |
| POST | `/admin-api/member/newapi/reconcile` | 触发手动对账（账单对账） |
| GET | `/admin-api/member/newapi/sync-status` | 获得同步状态概览 |
| GET | `/admin-api/member/newapi/token-mappings` | 获得 Token 映射分页 |

## `OpenApiAppController`

| 方法 | 路径 | 说明（@Operation summary） |
|------|------|---------------------------|
| POST | `/admin-api/member/open-api/app/create` | 创建 OpenAPI 应用 |
| DELETE | `/admin-api/member/open-api/app/delete` | 删除 OpenAPI 应用 |
| GET | `/admin-api/member/open-api/app/get` | 获得 OpenAPI 应用 |
| GET | `/admin-api/member/open-api/app/page` | 获得 OpenAPI 应用分页 |
| POST | `/admin-api/member/open-api/app/regenerate-key` | 重新生成 AppKey 和 AppSecret |
| PUT | `/admin-api/member/open-api/app/update` | 更新 OpenAPI 应用 |
| PUT | `/admin-api/member/open-api/app/update-status` | 更新应用状态 |

## `OpenApiBillingController`

| 方法 | 路径 | 说明（@Operation summary） |
|------|------|---------------------------|
| GET | `/admin-api/member/open-api/billing/get` | 获得计费记录详情 |
| GET | `/admin-api/member/open-api/billing/page` | 获得计费记录分页 |
| GET | `/admin-api/member/open-api/billing/statistics` | 获得费用统计 |

## `OpenApiCallLogController`

| 方法 | 路径 | 说明（@Operation summary） |
|------|------|---------------------------|
| GET | `/admin-api/member/open-api/call-log/get` | 获得调用日志详情 |
| GET | `/admin-api/member/open-api/call-log/page` | 获得调用日志分页 |

## `WalletBalanceGiveLogController`

| 方法 | 路径 | 说明（@Operation summary） |
|------|------|---------------------------|
| GET | `/admin-api/member/wallet-balance-give-log/export-excel` | 导出会员钱包金额赠送记录 Excel |
| GET | `/admin-api/member/wallet-balance-give-log/get` | 获得会员钱包金额赠送记录 |
| GET | `/admin-api/member/wallet-balance-give-log/page` | 获得会员钱包金额赠送记录分页 |

