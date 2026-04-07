# 聊天技能列表自动加载与同步（启动 / 焦点 / 路由）设计

## 背景

应用在启动后，用户在聊天窗口点击技能图标或使用 `/` 触发 slash 技能列表时，**本地技能经常未加载或列表为空**。根因包括：

1. **`fetchSkills` 失败即整体失败**：`src/stores/skills.ts` 中先 `rpc('skills.status')`，若 Gateway 未就绪或 RPC 抛错，后续 `/api/clawhub/list` 与 `/api/skills/configs` 不会执行，列表长期为空。
2. **聊天页未预拉取**：`Skills` 页在 `isGatewayRunning` 时会拉取技能；`Chat` 页无对等逻辑，主要依赖打开技能按钮或输入 `/` 时调用 `fetchSkills`，仍可能踩中 (1)。
3. **磁盘合并项启用态偏保守**：从 ClawHub 列表合并的技能曾默认 `enabled: false`，而面板与 slash 内联列表只展示 `enabled === true` 的技能；若 Gateway 从未成功返回，聊天侧会像「没有可用技能」。
4. **应用外安装技能**：通过 CLI 或手动向技能目录增删后，用户期望在**回到聊天或窗口重新聚焦**时列表能更新（不要求秒级实时）。

前置相关规格：`docs/superpowers/specs/2026-04-03-chat-skill-picker-design.md`（UI 行为与插入格式）。

## 目标

1. **启动后自动加载**：进入聊天后，无需用户先点技能按钮或输入 `/`，技能数据应通过生命周期尽快写入 `useSkillsStore`。
2. **Gateway 不可用时的可用降级**：`skills.status` 失败时仍完成磁盘列表与配置的合并，避免整次 `fetchSkills` 无结果。
3. **启用态与配置一致**：合并磁盘技能时结合 `openclaw.json` 中 `skills.entries[skillKey].enabled`（经 `/api/skills/configs` 暴露），避免磁盘项被错误标为未启用。
4. **同步策略（范围 C）**：应用外安装或变更后，在**回到聊天路由**或**窗口重新可见/获得焦点**时，经防抖触发刷新即可；不要求目录实时监控。

## 非目标

- 不对技能目录做 fs.watch 级实时同步（可作为后续增强）。
- 不保证插入的 slash 命令一定被 Gateway 执行；与既有聊天技能选择器规格一致。
- 不改变命令规范化规则（`chat-skill-command` / OpenClaw slash 约定）。

## 方案选择

采用 **健壮 `fetchSkills` + Chat 生命周期与可见性/焦点刷新**（brainstorming 中的方案 1）。

- **不采用**仅修一次挂载、无焦点监听（无法满足「回到窗口」同步）。
- **不采用**主进程目录监听作为本次必选（复杂度高，超出范围 C 的最低需求）。

## 详细设计

### 1. `fetchSkills` 容错与合并

- **Gateway**：`rpc('skills.status')` 置于独立 `try/catch`。失败时记录日志，本次 `gatewaySkills` 视为空数组，**不抛出**以阻断后续步骤。
- **Gateway 快照保留**：若本次 RPC 失败且 store 中已有**上次成功**的 Gateway 合并结果，设计选项为「保留上次 Gateway 衍生字段」或「清空」。**本 spec 约定**：本次 RPC 失败时，仅用空数组参与**本轮**合并，不与旧 store 深合并 Gateway 行，避免展示陈旧启用态；磁盘与 config 仍可提供最新本地信息。若需避免 UI 闪动，可在实现阶段用「loading 骨架」而非混合新旧 Gateway 行。
- **ClawHub 与 configs**：在 Gateway 步骤之后**始终尝试** `GET /api/clawhub/list` 与 `GET /api/skills/configs`。各自失败时：list 失败则仅依赖 Gateway 行；configs 失败则启用态采用下方缺省规则。
- **合并顺序**：与现有逻辑一致——先映射 Gateway 行为主列表，再为 ClawHub 中存在但 Gateway 未返回的 slug 追加条目；config 按 skillKey/slug 合并进 `config` 对象。

### 2. 启用态（`enabled`）规则

对每条技能，按顺序取值：

1. 若存在 Gateway 对应项：使用 `enabled: !gateway.disabled`（与现有一致）。
2. 否则若存在 `config.skills.entries[skillKey].enabled`：**使用该布尔值**（`/api/skills/configs` 返回的 `SkillEntry` 需包含 `enabled`，store 类型从仅 `apiKey`/`env` 扩展）。
3. 否则（无 Gateway 行且无 config 中的 `enabled` 字段）：**默认为 `true`**，使「仅磁盘可见」的安装默认出现在聊天可选列表中；若产品后续要求「默认关闭」，可改为 `false` 并更新本 spec。

### 3. Chat 侧触发 `fetchSkills`

实现位置优先 **`src/pages/Chat/index.tsx`**（与现有「进入聊天」生命周期一致）。

- **挂载**：`useEffect` 中 `void fetchSkills()`（或从 store 解构的稳定引用）。
- **Gateway 就绪**：当 `gatewayStatus.state === 'running'` 时触发一次 `fetchSkills()`（与 `Skills/index.tsx` 行为对齐；可加短防抖避免与挂载重复）。
- **路由**：当 `useLocation().pathname` 进入聊天相关路由（与现有一致，如 `/chat`）时，防抖后 `fetchSkills()`，避免「仅浏览器内导航回聊天、窗口未失焦」时不刷新。
- **可见性与焦点**：监听 `document` 的 `visibilitychange`（`document.visibilityState === 'visible'`）与 `window` 的 `focus`，防抖（建议约 300ms）后 `fetchSkills()`；可选 **最短间隔**（如 30s）内跳过重复请求，减少焦点抖动。

### 4. `ChatInput` 现有调用

保留打开技能按钮与 `handleComposerChange` 中在 slash 上下文下对 `fetchSkills()` 的调用，作为即时刷新，与全局策略叠加无害。

### 5. 与既有「只展示 enabled」规则的关系

`SkillPickerPopover` 与 slash 内联列表继续只展示 `enabled === true` 的技能。通过本节 **2** 的缺省与 config 合并，在 Gateway 未连接时仍能展示「配置允许」的本地技能。

## 测试

- **单元测试**：Mock Gateway `rpc` 抛错或 reject；断言仍调用 host API 且合并结果包含 ClawHub 项；config 中 `enabled: false` 的磁盘项不出现在「可展示」过滤结果中（可对 `useSkillsStore` 或纯合并函数做单测）。
- **E2E**：按 `AGENTS.md`，为「进入聊天后技能列表在 mock/固定数据下非空」或等价可稳定断言的交互增加/更新 Playwright 用例。

## 相关文档修订

- 更新 `2026-04-03-chat-skill-picker-design.md` 中「面板数据源」段落：说明技能数据由 **store 全局刷新策略** 填充，按钮与 `/` 仍可触发 `fetchSkills`，不再依赖「仅首次打开拉取」作为唯一数据来源。

## 实现后检查清单

- [ ] `pnpm run typecheck`、`pnpm test`、相关 E2E 通过。
- [ ] 若行为或架构有用户可见变化，同步 `README.md` / `README.zh-CN.md` / `README.ja-JP.md` 中必要说明（本改动若仅为数据加载时序，可仅更新规格与内联注释）。
