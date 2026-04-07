# Skills 页面头部 Tabs + 技能商店 Sheet（设计稿）

日期：2026-04-07  
范围：`src/pages/Skills/index.tsx`（仅 UI/交互改造，复用现有安装技能 `Sheet`）

## 背景与目标

当前 `Skills` 页面：

- 头部是大标题 +（可选）“打开技能文件夹”按钮。
- “安装技能”通过右侧 `Sheet` 展示技能商店（ClawHub 搜索+安装列表）。

本设计的目标：

- 参照 `Agents` 页头部（`Tabs` 工具栏形态），将 `Skills` 页头部改为两个 Tab：
  - **我的技能**
  - **技能商店**
- 点击 **技能商店** 后，出现“当前点击安装技能按钮出现的 sheet”（复用现有安装技能 `Sheet`）。
- 将 **打开技能文件夹** 按钮移动到现在“安装技能”按钮的位置，并且 **始终显示**。
- 关闭 `Sheet` 后，**自动切回「我的技能」**。
- 切换/打开/关闭过程中，`searchQuery`、`selectedSource` 等过滤状态 **保持不动**。

## 不在范围（Non-goals）

- 不重做技能商店 UI（列表样式、数据源、安装逻辑保持现状）。
- 不改变技能卡片、详情 `Sheet`、启用/禁用/卸载等功能逻辑。
- 不做跨页面路由/深链（例如 `?tab=marketplace`）的新增。

## 信息架构与布局

### 顶部工具栏（参照 `Agents`）

将 `Skills` 页头部改造成工具栏风格（同样的“左 Tab + 中搜索 + 右操作”布局）：

- **左侧**：`TabsList`
  - Tab：`mySkills`（显示文本“我的技能”）
  - Tab：`marketplace`（显示文本“技能商店”）
- **中间**：沿用现有搜索输入（`searchQuery`）用于过滤“我的技能”网格卡片
  - 仅影响“我的技能”列表的过滤展示；打开 `Sheet` 不应清空它
- **右侧**：操作按钮区
  - **打开技能文件夹**：移动到原“安装技能”按钮所在位置；**始终显示**
  - **刷新**：保留（现有 `fetchSkills` 行为不变）
  - **移除/隐藏原「安装技能」按钮**：由“技能商店”Tab 取代入口

> 注：原来大标题（H1）区是否保留由实现时按现有页面风格微调；本设计只强制“入口/交互与按钮位置”。

## 交互设计（状态机）

### 状态定义

- `activeTab`: `'mySkills' | 'marketplace'`（新增/替换现有单一页面头部状态）
- `installSheetOpen`: boolean（沿用现有）
- `installQuery`: string（沿用现有，控制 marketplace 搜索）
- `searchQuery`: string（沿用现有，控制本地技能过滤）
- `selectedSource`: `'all' | 'built-in' | 'marketplace'`（沿用现有，本地过滤）

### 用户操作与预期

#### 1) 初始进入页面

- `activeTab = 'mySkills'`
- `installSheetOpen = false`

#### 2) 点击「技能商店」Tab

- 立刻打开安装技能 `Sheet`
  - `installSheetOpen = true`
  - `installQuery = ''`（等价于原“安装技能”按钮：打开时清空查询）
- `activeTab = 'marketplace'`
- `searchQuery`、`selectedSource` 保持不变

#### 3) 关闭安装技能 `Sheet`（右侧 Sheet 关闭按钮、点击遮罩、Esc 等）

- `installSheetOpen = false`
- **自动切回我的技能**
  - `activeTab = 'mySkills'`
- `searchQuery`、`selectedSource` 保持不变（用户回到原来的过滤视图）

#### 4) 点击「我的技能」Tab（在 `Sheet` 未打开时）

- 仅切换 `activeTab = 'mySkills'`
- 不触发任何其他副作用

#### 5) 在 `Sheet` 打开期间点击 Tabs（可选行为）

实现建议：

- 若用户点击「我的技能」，可直接关闭 `Sheet`，并保持“关闭 sheet 即回我的技能”的规则一致。
- 若用户重复点击「技能商店」，不应产生额外副作用（保持打开即可）。

## 组件/实现边界（约束）

- `Sheet` 内容与网络逻辑复用现有实现（`searchSkills`、`installSkill`、`installing`、`searchResults` 等）。
- Renderer/Main API 边界不变：继续使用 `invokeIpc` / `hostApiFetch`，不新增直接 IPC 调用路径。

## 可测试性（E2E）

新增/更新一个 Electron Playwright 用例覆盖以下关键路径：

- 打开 `Skills` 页面后默认在“我的技能”
- 点击“技能商店”Tab：
  - 安装技能 `Sheet` 出现
- 关闭 `Sheet`：
  - `Sheet` 消失
  - Tab 自动回到“我的技能”
- “打开技能文件夹”按钮在工具栏右侧，且**始终可见**（无需依赖已安装技能数量）

## 兼容性与风险

- 现有 `installSheetOpen` 的 `onOpenChange` 需要在 close 时同步 `activeTab`，避免出现“Sheet 关闭但仍停留在 marketplace tab”的状态。
- “打开技能文件夹”改为始终显示后，若本机 skills 目录不可用，保持现有 toast 错误提示即可（不改变错误文案与处理）。

