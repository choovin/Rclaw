# 技能商店：云端 Skillhub 列表 + 卡片页（替代 ClawHub Sheet）设计

## 背景

技能页（`src/pages/Skills/index.tsx`）当前「技能商店」通过 Tab 打开右侧 **Sheet**，在 Main 侧经 **`/api/clawhub/search`** 搜索 ClawHub。需求改为从 **业务云** 拉取 Skillhub 分页列表，主区域与「我的技能」**同一套卡片布局**，取消 Sheet；列表接口 **无需鉴权**。

## 目标

1. 列表数据：`GET {VITE_CLOUD_API_BASE_URL}/app-api/skillhub/skills?q=&pageNo=&pageSize=`，响应形态见仓库内样例 `temp/res.json`（`code` / `msg` / `data.total` / `data.list`）。
2. **分页**：**每页条数固定为 15**：请求侧 **`pageSize` 恒为 `15`**；**`pageNo` 从 1 递增**，用于「加载更多」追加列表，直到已加载条数 ≥ `data.total`。
3. UI：技能商店 Tab 下主内容区为卡片网格（与「我的技能」视觉一致）；**隐藏**「全部 / 内置 / 市场」分类；**保留**顶部搜索框与「打开技能文件夹」。
4. 卡片右上角（原 **Switch** 位置）：本地已存在该 `slug` → 展示 **「已添加」** 状态（非开关）；未添加 → **下载图标** 按钮，点击走现有 **`installSkill(slug)`**（`/api/clawhub/install`）。
5. 卡片 **无**「立即使用」「删除」区块（与「我的技能」区分）。
6. 点击 **卡片主体**（非下载按钮）：在系统浏览器打开 **`{VITE_SKILL_HUB_BASE_URL}/skills/{slug}`**（`VITE_SKILL_HUB_BASE_URL` 为 Skill Hub 站点根地址；实现时需统一去除多余斜杠再拼接，避免 `//`）。
7. 长列表：**分页 + 虚拟化窗口**（见下文），避免一次挂载大量卡片 DOM。

## 非目标

- 不替换 ClawHub **安装/卸载** 管线（仍用现有 host API），除非后续单独 spec。
- 不在本阶段要求 Skillhub 与 ClawHub **版本对齐** 策略（以 `slug` 安装为准）。

## 架构与边界

- **渲染进程**不直接 `fetch` 云端域名；新增 **Main → 业务云** 的 HTTP 代理路径（与 `hostApiFetch` 既有模式一致），例如 `GET /api/cloud/skillhub/skills?...` 转发到 `{VITE_CLOUD_API_BASE_URL}/app-api/skillhub/skills?...`。
- **列表接口无需鉴权**：代理请求 **不依赖** 会员 Bearer；若通用 cloud 客户端默认带 Token，需保证 **无 Token 时仍成功**（或该路由专用实现不加鉴权头）。
- **状态管理**：推荐独立 **hook 或小 store** 管理 Skillhub 列表、分页、加载状态、错误；与 `useSkillsStore` 的本地 `skills` + `installSkill` **组合使用**。

## 数据与类型

- 从 `data.list` 映射为 UI 所需字段：`slug`、`displayName`、`summary`、`publishedVersion.version`（或 `headlineVersion` 等，展示用 `publishedVersion` 优先）。
- **已添加**判定：用本地 `skills` 与云端 `slug` 匹配（与现 Sheet 中 `safeSkills.some(...)` 思路一致，可含 `id === slug` 等）。

## 错误与空态

- `code !== 0` 或网络错误：顶部或内容区错误提示；可重试。
- 首屏无数据且 `q` 为空：空态文案（可复用现有 i18n 键或新增）。
- 加载更多失败：保留已加载列表，提示「加载更多失败」+ 重试。

## 性能

- **固定 `pageSize=15`**，滚动加载下一页。
- 使用 **`@tanstack/react-virtual`**（或项目后续统一的长列表方案）对 **卡片网格**（或按行分组的虚拟行）做窗口化，避免随着页数增长线性增加 DOM 节点。

## 配置项（实现阶段）

- **`VITE_SKILL_HUB_BASE_URL`**：Skill Hub 前端站点根（用于 `.../skills/{slug}`）。需在 **`.env.example`**、各环境 `.env`、**`src/vite-env.d.ts`**（若项目有 `ImportMetaEnv` 声明）中补充；**实现时**与 `VITE_CLOUD_API_BASE_URL` 区分：前者为 **Skill Hub 站点**，后者为 **API 根**。

## 测试

- **E2E（Playwright）**：技能页切换到「技能商店」、列表出现（可 mock 或对接预发）；与「我的技能」工具栏差异（分类隐藏）可断言。
- 契约文档：在 **`docs/api-docs/`** 增加 Skillhub 列表接口说明（路径、query、`pageSize` 固定 15 的约定、响应字段），与 RunNode 后台一致。

## 与 brainstorming 结论的差异记录（已采纳）

| 项 | 说明 |
|----|------|
| 每页条数 | **`pageSize` 固定为 15**（`pageNo` 递增加载更多）。 |
| 卡片外链 | **`VITE_SKILL_HUB_BASE_URL + /skills/{slug}`**，非固定 `clawhub.ai`。 |

## 后续

- 用户审阅本 spec 通过后，使用 **writing-plans** 产出实现计划（含 Host 路由、env、页面与虚拟列表、E2E、api-docs）。
