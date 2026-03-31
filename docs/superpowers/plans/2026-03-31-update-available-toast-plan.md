# Update Available Toast Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在主窗口左下角展示「新版本可用」Toast；仅在开启「自动检查更新」且检查到 `available` 时出现；点击「立即升级」立即下载并在同一卡片内展示进度/错误/安装（直至用户关闭 Toast）；**设置页发起的下载不在 Toast 中展示进度**；关闭 Toast **仅隐藏 UI、不中断下载**；下载完成后的安装/倒计时与主进程 + `UpdateSettings` 一致。

**Architecture:** 新建 `UpdateAvailableToast` 组件挂载于 `MainLayout`，在挂载时调用 `useUpdateStore.getState().init()`（与 `UpdateSettings` 内 `init` 幂等，已有 `isInitialized` 守卫）。可见性与交互完全由渲染进程 `useUpdateStore` 的 `status` / `progress` / `error` / `autoInstallCountdown` 驱动，主进程沿用现有 `AppUpdater` 与 IPC。

**Tech Stack:** React, Zustand (`src/stores/update.ts`), react-i18next, Tailwind, Lucide icons, 现有 Electron preload IPC。

**设计依据：** `docs/superpowers/specs/2026-03-31-update-toast-design.md`

---

## 文件结构

| 路径 | 操作 |
|------|------|
| `src/components/layout/UpdateAvailableToast.tsx` | **新建**：Toast UI 与状态机 |
| `src/components/layout/MainLayout.tsx` | **修改**：挂载 `<UpdateAvailableToast />` |
| `src/i18n/locales/zh/settings.json` | **修改**：`updates.toast.*` |
| `src/i18n/locales/en/settings.json` | **同上** |
| `src/i18n/locales/ja/settings.json` | **同上** |

**不修改：** `electron/main/updater.ts`（除非发现与 Toast 无关的既有 bug）；`src/stores/update.ts` 的启动检查逻辑保持与 `autoCheckUpdate` 挂钩。

---

### Task 1: i18n — `updates.toast` 与无障碍文案

**Files:**
- Modify: `src/i18n/locales/zh/settings.json`（在 `updates` 对象内、`help` 键之后）
- Modify: `src/i18n/locales/en/settings.json`
- Modify: `src/i18n/locales/ja/settings.json`

- [ ] **Step 1: 在三个 locale 的 `updates` 中增加同级对象 `toast`**

**zh** 示例（整段粘贴到 `"help": "..."` 后、闭合 `updates` 前，注意 JSON 逗号）：

```json
    "toast": {
      "title": "新版本可用",
      "versionLine": "版本 {{version}}",
      "upgradeNow": "立即升级",
      "skip": "跳过",
      "closeAria": "关闭",
      "percent": "{{percent}}%",
      "preparingDownload": "正在准备下载…"
    }
```

**en** 对应：

```json
    "toast": {
      "title": "New version available",
      "versionLine": "Version {{version}}",
      "upgradeNow": "Upgrade now",
      "skip": "Skip",
      "closeAria": "Close",
      "percent": "{{percent}}%",
      "preparingDownload": "Preparing download…"
    }
```

**ja** 对应：

```json
    "toast": {
      "title": "新しいバージョンがあります",
      "versionLine": "バージョン {{version}}",
      "upgradeNow": "すぐにアップグレード",
      "skip": "スキップ",
      "closeAria": "閉じる",
      "percent": "{{percent}}%",
      "preparingDownload": "ダウンロードを準備中…"
    }
```

- [ ] **Step 2: 校验 JSON**（尾随逗号、重复键）

运行：`pnpm exec node -e "JSON.parse(require('fs').readFileSync('src/i18n/locales/zh/settings.json','utf8'))"`

预期：无抛错。

- [ ] **Step 3: Commit**

```bash
git add src/i18n/locales/zh/settings.json src/i18n/locales/en/settings.json src/i18n/locales/ja/settings.json
git commit -m "i18n: add settings.updates.toast strings for update prompt"
```

---

### Task 2: 新建 `UpdateAvailableToast` 组件

**Files:**
- Create: `src/components/layout/UpdateAvailableToast.tsx`

- [ ] **Step 1: 新增文件**（从 `useUpdateStore` 读取状态；`useEffect` 内 `void init()`；会话级 `sessionDismissed` + **`toastUpgradeFlow`** 与 spec 一致）

实现要点（须全部满足 spec）：

1. **可见性（与 spec 逻辑式一致）**  
   - `toastUpgradeFlow`：仅当用户**在本 Toast 内**点击「立即升级」时置 `true`（`useState`）；**不要**在 `UpdateSettings` 的下载按钮里置位（无需改 `UpdateSettings`，默认即为 false）。  
   - `visible = isInitialized && !sessionDismissed && (`  
     `status === 'available' ||`  
     `(toastUpgradeFlow && status ∈ ('downloading','downloaded','error'))`  
   `)`  
   - 由此：用户在设置页点「下载更新」后 `status` 变为 `downloading` 且 `toastUpgradeFlow === false` → Toast **不显示**；若此前正显示 `available`，会随状态切换而**自动隐藏**。  
2. **`available`**：深灰卡片、橙色圆底 `ArrowUp`、标题 `t('updates.toast.title')`、副标题 `t('updates.toast.versionLine', { version })`、底栏 **「跳过」+「立即升级」**、右上角 `×`（`closeAria`）。  
3. **「立即升级」**：`setToastUpgradeFlow(true)`，`clearError()`，`void downloadUpdate()`。  
4. **`downloading`**（且 `toastUpgradeFlow`）：文案 `updates.status.downloading`；**不渲染底栏「跳过」**；仅右上角 `×`，点击仅 `setSessionDismissed(true)`，**不**调用任何取消下载 API；若有 `progress`：`formatBytes` 行、圆角进度条（`div` + `width: percent%`）、`updates.toast.percent`；无 `progress` 时 `updates.toast.preparingDownload`。  
5. **`downloaded`**（且 `toastUpgradeFlow`）：与 `UpdateSettings` 一致——`autoInstallCountdown` 文案、`cancelAutoInstall`、`installUpdate`；行为与主进程 `autoDownload` / 倒计时一致；**不**展示「跳过」；保留 ×。  
6. **`error` 且 `toastUpgradeFlow`**：`updates.errorDetails` + `error` + 重试（`clearError` + `downloadUpdate`）；**不**展示「跳过」；保留 ×。  
7. **样式**：`fixed bottom-6 left-6 z-[100]`，宽约 `min(360px, calc(100vw - 2rem))`，背景约 `#333`，边框 `border-white/10`，主按钮橙色与参考图一致。

- [ ] **Step 2: ESLint / 类型**

运行：`pnpm run typecheck`

预期：退出码 0。

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/UpdateAvailableToast.tsx
git commit -m "feat(layout): add UpdateAvailableToast (toast-only download follow-up)"
```

---

### Task 3: 在 `MainLayout` 挂载 Toast

**Files:**
- Modify: `src/components/layout/MainLayout.tsx`

- [ ] **Step 1: import 与 JSX**

在 `VersionDisplay` 同目录 import：

```tsx
import { UpdateAvailableToast } from './UpdateAvailableToast';
```

在 `LoginModal` 之后（或同级根 `div` 内末尾）增加：

```tsx
<UpdateAvailableToast />
```

- [ ] **Step 2: typecheck**

运行：`pnpm run typecheck`

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/MainLayout.tsx
git commit -m "feat(layout): mount global update available toast"
```

---

### Task 4: 验证与回归

- [ ] **Step 1: 类型与 Lint**

运行：`pnpm run typecheck`  
可选：`pnpm run lint`

- [ ] **Step 2: 手动清单（打包环境）**

1. 设置中**开启**「自动检查更新」，重启应用，确认延迟后若 feed 有新版本则出现 Toast。  
2. 点「立即升级」：在未点 × 前卡片保持，出现进度或「准备下载」文案；**下载中底栏无「跳过」**，仅有 ×。  
3. **`available` 时点**「跳过」或 ×：本会话 Toast 不再出现。  
4. **下载中**（由 Toast「立即升级」触发）点 ×：**Toast 消失，下载仍在进行**；打开设置「更新」可见进度与「下载中」状态。  
5. Toast 显示 `available` 时**不**点「立即升级」，改在设置页点「下载更新」：**不出现** Toast 进度；仅设置页展示下载。  
6. 由 Toast 完成下载后：安装/倒计时与设置页、主进程一致（自动更新开/关对照现网行为）。  
7. **关闭**「自动检查更新」并重启：启动路径不应出现该 Toast（本期不扩展其它入口）。  
8. `UpdateSettings` 与 Toast 共用 store，`init` 仅注册一次 listener。

- [ ] **Step 3: 如需合并为单一 feature commit**  
若 Task 1–3 已分步提交，可保持；或 `git rebase -i`  squash（按团队习惯）。

---

## 注意事项

- `init()` 在 `UpdateAvailableToast` 与 `UpdateSettings` 中均可调用；依赖 `update.ts` 内 `if (get().isInitialized) return` 防止重复订阅。  
- 不要在 Toast 中改 `autoCheckUpdate` 或禁用设置里的手动检查。  
- **禁止**将「关闭 Toast」绑定为取消下载（当前主进程/IPC 亦无对应能力）。  
- `electron/main/updater.ts` 的其它本地修改若与本功能无关，提交时不要混入同一 commit。
