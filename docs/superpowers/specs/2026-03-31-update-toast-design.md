# 设计：启动检测到更新时的左下角升级 Toast

**日期**：2026-03-31  
**状态**：已定稿（待实现计划）

## 背景与目标

在桌面应用启动并完成更新检查后，若存在新版本，在窗口左下角展示与参考图一致的深色 Toast（标题「新版本可用」、副标题含版本号）。在 **`available`** 状态下用户可通过「立即升级」「跳过」与右上角 ×；**进入 `downloading` 后底栏不展示「跳过」**（仅保留 × 等关闭入口，行为见下）。**「立即升级」触发后立即开始下载更新**，不跳转设置页。

## 需求摘要（已确认）

| 项 | 结论 |
|----|------|
| 启动检查与「自动检查更新」 | **保持挂钩**：仅当用户**开启**「自动检查更新」时，在 `useUpdateStore.init()` 后按现有模式延迟执行 `checkForUpdates()`；**关闭**该选项则**不**执行启动自动检查，因此也不会通过该路径出现更新 Toast。 |
| Toast 视觉与布局 | 深灰底、圆角、左侧橙色圆标 + 向上箭头；主副标题文案与版本号；相对**整窗**左下角 `fixed`，层级高于侧栏与内容区。 |
| 「立即升级」 | 点击后**立即调用**与设置页一致的下载路径（如 `useUpdateStore.downloadUpdate()` / `update:download`），**不**导航至设置页。**必须**在同一 Toast 内提供**即时可见反馈**：进入 `downloading` 后展示进度条与百分比（数据来自 `useUpdateStore.progress`，与设置页 `UpdateSettings` 一致）；下载失败时在同一卡片内展示错误摘要并可重试下载；下载完成后可提供「安装并重启」或引导至设置（与现有安装能力对齐）。 |
| 「跳过」与「×」 | **仅隐藏 Toast**：不取消主进程下载、不改 `autoCheckUpdate`。**「跳过」文案仅出现在 `available` 底栏；`downloading` / `downloaded` / `error` 视图中不展示「跳过」**（避免与「跳过更新」语义混淆）。在 **`available` 时点**「跳过」或 ×：本会话内不再显示该 Toast。在 **`downloading` 等后续状态**仅通过 × 关闭时：同样仅隐藏，**下载继续进行**；本会话内 Toast 不再出现（含后续的 `downloaded` / 错误重试），用户改在设置页「更新」查看进度与安装。 |
| 设置页发起下载 | **不**因设置页点击「下载更新」而弹出或延续本 Toast 的下载进度 UI；进度与操作**仅在** `UpdateSettings` 中展示。若 Toast 当时正处于 `available`，一旦状态变为 `downloading` 且**并非**由 Toast 内「立即升级」触发，Toast 应**不再显示**（见下「展示条件」）。 |
| 下载完成与安装 | 与 **主进程 `AppUpdater` + 设置页 `UpdateSettings`** 行为一致：主进程 `autoDownload` 由设置「自动更新」同步；下载完成后若开启自动下载则走既有**倒计时自动安装**逻辑，否则由用户点击**安装并重启**；Toast 侧（仅当用户自 Toast 发起下载且未中途关闭 Toast 时）展示相同倒计时/取消/安装文案与操作。 |
| Dev / 未打包 | 保持现有行为；无 `available` 则不展示 Toast。 |

## 架构与数据流

1. **主进程**：沿用 `AppUpdater` 与 `update:status-changed`；无需为 Toast 单独增通道。
2. **渲染进程**：
   - `useUpdateStore` 继续为单一真相：`status === 'available'` 且存在 `updateInfo` 时表示有新版本可提示。
   - **不修改**「启动是否检查」与 `autoCheckUpdate` 的挂钩关系（`init` 内仍仅在 `autoCheckUpdate === true` 时 `setTimeout` 调用 `checkForUpdates`）。
3. **Toast 挂载点**：建议在 `MainLayout`（或同级全局壳层）渲染，以便覆盖整窗左下角并与 `Outlet` 解耦。

## 组件与交互

### 展示条件（逻辑式）

设 `toastUpgradeFlow` 表示**用户曾在本 Toast 内点击「立即升级」**（本会话内为 true，直至会话结束；**不**因设置页点击下载而置 true）。

Toast **显示**当且仅当：

- `isInitialized` 且**未**本会话 `sessionDismissed`；且  
- **`status === 'available'`**（有 `updateInfo`、版本号可用），**或**  
- **`toastUpgradeFlow && status ∈ { downloading, downloaded, error }`**（仅展示「从 Toast 发起的下载」后续状态）。

由此可得：

- 用户在**设置页**点击「下载更新」→ `toastUpgradeFlow` 仍为 false → 进入 `downloading` 后 Toast **不**显示；若此前 Toast 在 `available`，状态一切换为 `downloading` 即满足「非第二分支」，Toast **关闭**。
- 用户仅在 Toast 点「立即升级」→ `toastUpgradeFlow === true` → 下载中/完成/错误在 Toast 内延续（除非用户此时 `sessionDismissed` 仅隐藏 UI）。

### 「立即升级」（**必选可见反馈**）

- 调用 `downloadUpdate()` 后，在**未**触发 `sessionDismissed` 前 **Toast 不消失**，在同一组件内随 `status` 切换视图：
  - **`downloading`**：标题/副文案标明「正在下载」；展示 **进度条 + 百分比**（及可选的已传/总量，可与 `UpdateSettings` 的展示粒度一致或略简）；**不展示底栏「跳过」**，仅保留右上角 **×** 用于仅隐藏 Toast。
  - **`downloaded`**：提示可安装；提供与设置页一致的 **`installUpdate`（安装并重启）** 能力（若存在自动安装倒计时，可沿用主进程推送的倒计时文案）。
  - **`error`**（在用户从本 Toast 发起下载后出现）：展示 `error` 文案与「重试」（再次 `downloadUpdate()` 或按需 `clearError` 后重试）。

不再采用「仅依赖设置页进度」的无反馈方案。

### 「跳过」与「×」（与下载生命周期）

- **「跳过」**：仅在 **`status === 'available'`** 时与「立即升级」同排展示；**非 `available` 的 Toast 视图不得渲染「跳过」文案**。
- 使用会话级 `sessionDismissed`：为 true 时 Toast 不渲染。
- **不**调用任何「取消下载」API；主进程下载**不因**关闭 Toast 而中断。
- **不**因 dismiss 而修改 `autoCheckUpdate` 或阻止用户在设置页检查/下载/安装。

## 与设置页「更新」区块的关系

- **不要求**跳转；设置页始终可完整操作更新流程。
- **全局状态**：`useUpdateStore` 唯一；从 Toast 或设置页发起下载后，设置页内按钮与文案随 `status` 变化（例如 `downloading` 时禁用「下载」并显示「下载中」），与现有 `UpdateSettings` 一致。
- **设置页发起下载时不 mirror Toast**：进度只在设置页展示（见上展示条件）。

## 文案与 i18n

- 主标题、副标题、「立即升级」「跳过」（仅 `available`）应走 `react-i18next` 与现有 `settings`/公共命名空间约定（具体 key 在实现计划中列出）。

## 测试建议

- 开启自动检查 + `available`：Toast 出现；点「立即升级」→ Toast 显示进度；下载中点 × → Toast 消失，**下载仍继续**，设置页可见进度。
- `available` 时未点 Toast「立即升级」，改在设置页点「下载更新」→ **不出现** Toast 进度条，仅设置页展示下载。
- Toast 路径下载完成后：行为与设置页一致（自动安装倒计时 vs 手动「安装并重启」视主进程/自动更新开关而定）。
- 关闭自动检查：启动后不自动检查则无启动 Toast（**本期不扩展**其它入口的 Toast 策略）。

## 自检

- **范围**：Toast 与设置页分工明确（设置页下载不驱动 Toast 进度）；关闭 Toast 不取消下载；安装策略与主进程+设置页一致。
- **矛盾消解**：先前讨论的「方案 B 始终启动检查」已由产品改为 **保持与自动检查挂钩**；本文档以此为准。
- **2026-03-31 补充定案**：（1）下载中关闭 Toast = **仅隐藏**；（2）设置页发起下载 = **不要** Toast 进度；（3）下载完成/安装 = **与主进程 + `UpdateSettings` 一致**；（4）**`downloading` 视图不展示「跳过」**，仅 `available` 底栏展示。
