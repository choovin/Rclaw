# 数字员工模块完整实现 - 设计文档

**项目**：ClawX (Rclaw) 数字员工系统
**版本**：v1.0
**创建日期**：2026-03-19
**状态**：待用户评审

---

## 一、概述

### 1.1 目标

实现数字员工模块的完整功能，包括：
1. 员工市场 UI 美化（部门筛选栏、卡片样式）
2. 添加员工时创建真实的 OpenClaw Agent
3. 生成完整的工作空间文件（SOUL.md, AGENTS.md, IDENTITY.md, user.md, todo.md）
4. 数据转换脚本增强

### 1.2 用户流程

```
员工市场 → 点击员工卡片 → 查看详情 → 点击"添加"
    ↓
调用 Gateway API 创建 Agent
    ↓
生成工作空间目录和文件
    ↓
保存映射关系
    ↓
"我的员工"列表显示
```

---

## 二、系统架构

### 2.1 设计原则

**UI 显示规则**：
- 所有员工名称显示**中文名**（nameZh）
- 部门名称显示**中文**
- 描述文字使用**中文**
- 员工卡片、列表、详情全部使用中文显示

### 2.2 模块划分

| 子系统 | 负责内容 | 涉及文件 |
|--------|----------|----------|
| 数据层 | 员工数据存储、读取 | `src/stores/employees.ts`, `public/data/employees/` |
| UI 层 | 员工市场、我的员工页面 | `src/pages/Agents/Marketplace.tsx`, `MyEmployees.tsx` |
| 业务层 | 添加员工、创建 Agent | `src/stores/agents.ts`, Gateway API |
| 文件层 | 工作空间文件生成 | Electron IPC, 文件系统 |

### 2.2 数据流

```
agency-agents-temp/*.md
    ↓ (convert-agents.js 增强版)
public/data/employees/*.json
    ↓ (Marketplace 读取)
EmployeeCard / EmployeeDetail
    ↓ (点击添加)
createEmployeeAgent()
    ↓ (Gateway API)
Agent 创建成功
    ↓ (IPC)
生成工作空间文件
    ↓ (保存映射)
MyEmployees 显示
```

---

## 三、详细设计

### 3.1 子系统一：数据转换增强

#### 3.1.1 当前状态

现有脚本 `scripts/convert-agents.js` 只提取 frontmatter 元数据：
```json
{
  "id": "engineering-frontend-developer",
  "name": "Frontend Developer",
  "nameZh": "李现",
  "description": "...",
  "color": "cyan",
  "emoji": "🖥️",
  "vibe": "...",
  "department": "engineering"
}
```

#### 3.1.2 增强内容

新增以下字段到 JSON：

| 字段 | 类型 | 说明 |
|------|------|------|
| `soulContent` | string | SOUL.md 内容（角色人设） |
| `agentsContent` | string | AGENTS.md 内容（任务说明） |
| `identityContent` | string | IDENTITY.md 内容（简短标识） |
| `systemPrompt` | string | 完整的 system prompt |
| `tools` | string[] | 技能列表 |
| `deliverables` | string[] | 交付物说明 |

#### 3.1.3 实现方式

1. 读取原始 md 文件
2. 使用 convert.sh 的相同逻辑分类内容
3. 输出增强的 JSON 文件

#### 3.1.4 涉及文件

- `scripts/convert-agents-enhanced.js`（新建）
- `public/data/employees/*.json`（重新生成）

---

### 3.2 子系统二：员工市场 UI 美化

#### 3.2.1 部门筛选栏

**当前样式**：简单的 Badge 列表

**目标样式**：Apple 简约风格

```
┌─────────────────────────────────────────────────────────┐
│ 🔍 搜索...                                               │
├─────────────────────────────────────────────────────────┤
│ 全部    研发    设计    营销    销售    产品    ...     │
│ (选中样式) (未选中) (未选中) (未选中) (未选中)          │
└─────────────────────────────────────────────────────────┘
```

**设计要点**：
- 选中状态：填充背景 `bg-foreground text-background`
- 未选中：`border border-border/40 bg-transparent`
- 圆角：`rounded-full`
- 间距：`gap-2`
- 滚动支持：超出时可横向滚动

#### 3.2.2 员工卡片

**当前结构**：
```tsx
<div className="card">
  <Avatar />
  <Name />
  <Department />
  <Description />
  <AddButton />
</div>
```

**目标结构**：
```tsx
<div className="employee-card">
  <Badge>{emoji} {department}</Badge>
  <Avatar size="lg" />
  <NameZh>{中文名}</NameZh>
  <NameEn>{英文名}</NameEn>
  <Vibe>{风格描述}</Vibe>
  <Description>{介绍}</Description>
  <AddButton />
</div>
```

**设计要点**：
- 卡片：`rounded-2xl`, `border border-border/40`, `bg-card`
- 阴影：`shadow-sm`，hover 时 `shadow-md`
- 头像：圆形，64px，带背景色
- 中文名：粗体，16px
- 英文名：常规，14px，灰色
- 描述：14px，2行截断

#### 3.2.3 涉及文件

- `src/pages/Agents/Marketplace.tsx`
- `src/pages/Agents/EmployeeCard.tsx`
- `src/pages/Agents/EmployeeDetail.tsx`

---

### 3.3 子系统三：添加员工逻辑

#### 3.3.1 API 设计

**创建 Agent（新增）**

```typescript
// 请求
POST /api/agents/create-employee
{
  employeeId: string,      // 员工 ID (如 "engineering-frontend-developer")
  name: string,            // 员工中文名
  nameEn: string,          // 员工英文名
  soulContent: string,     // SOUL.md 内容
  agentsContent: string,   // AGENTS.md 内容
  identityContent: string, // IDENTITY.md 内容
}

// 响应
{
  success: boolean,
  agentId: string,         // 创建的 Agent ID
  workspacePath: string,   // 工作空间路径
  error?: string
}
```

#### 3.3.2 后端实现

1. **Gateway 通信**：调用 Gateway 的 Agent 创建接口
2. **工作空间生成**：创建目录并写入文件
3. **文件清单**：

| 文件 | 来源 | 说明 |
|------|------|------|
| `SOUL.md` | employee.soulContent | 角色人设 |
| `AGENTS.md` | employee.agentsContent | 任务说明 |
| `IDENTITY.md` | employee.identityContent | 简短标识 |
| `user.md` | 模板生成 | 用户说明 |
| `todo.md` | 模板生成 | 待办事项 |

#### 3.3.3 user.md 模板

```markdown
# 👤 我的资料

## 基本信息
- **名字**：[员工中文名]
- **英文名**：[员工英文名]
- **部门**：[部门名称]
- **角色**：数字员工

## 我擅长的
- [从 agentsContent 提取]

## 我的工作风格
- [从 soulContent 提取]

## 当前项目
<!-- 记录当前正在处理的项目 -->

## 常用工具
<!-- 记录常用的工具和命令 -->

---

*由 Rclaw 数字员工系统生成*
```

#### 3.3.4 todo.md 模板

```markdown

# 📋 待办事项

## 今日任务
- [ ]

## 本周目标
- [ ]

## 进行中的项目
<!-- 记录正在进行的项目 -->

## 已完成
- [ ]

---

*由 Rclaw 数字员工系统生成*
```

#### 3.3.5 涉及文件

- `electron/api/agents.ts`（新增 API 路由）
- `src/stores/employees.ts`（新增添加方法）
- `src/pages/Agents/EmployeeDetail.tsx`（添加按钮）

---

### 3.4 子系统四：我的员工功能增强

#### 3.4.1 显示逻辑

"我的员工"显示已添加的员工，每个员工卡片显示：
- 员工信息（与市场一致）
- 状态标签（在线/离线）
- 最近活动时间

#### 3.4.2 操作

| 操作 | 说明 |
|------|------|
| 查看详情 | 打开详情侧边栏 |
| 发起对话 | 切换到该 Agent 的对话 |
| 移除员工 | 从我的员工中移除（可选：删除 Agent） |

#### 3.4.3 涉及文件

- `src/pages/Agents/MyEmployees.tsx`
- `src/stores/employees.ts`

---

## 四、数据结构

### 4.1 员工数据类型

```typescript
interface Employee {
  id: string;
  name: string;           // 英文名
  nameZh: string;         // 中文名
  description: string;    // 介绍
  color: string;          // 主题色
  emoji: string;          // emoji
  vibe: string;           // 风格描述
  department: Department;

  // 新增字段（增强版）
  soulContent?: string;
  agentsContent?: string;
  identityContent?: string;
  systemPrompt?: string;
  tools?: string[];
  deliverables?: string[];
}

interface EmployeeWithStatus extends Employee {
  isAdded: boolean;       // 是否已添加到我的员工
  agentId?: string;       // 对应的 Agent ID
  addedAt?: number;       // 添加时间
}
```

### 4.2 部门枚举

```typescript
type Department =
  | 'engineering'       // 研发
  | 'design'            // 设计
  | 'marketing'         // 营销
  | 'sales'             // 销售
  | 'product'           // 产品
  | 'project-management' // 项目管理
  | 'academic'          // 学术
  | 'game-development'  // 游戏开发
  | 'strategy'          // 战略
  | 'support'           // 客服
  | 'testing'           // 测试
  | 'integrations'      // 集成
  | 'specialized'       // 专门技能
  | 'spatial-computing' // 空间计算
  | 'paid-media';       // 付费媒体
```

---

## 五、API 设计

### 5.1 前端 API

```typescript
// 添加员工（创建 Agent）
async function addEmployee(employeeId: string): Promise<{
  success: boolean;
  agentId?: string;
  error?: string;
}>

// 移除员工
async function removeEmployee(employeeId: string): Promise<void>

// 获取我的员工列表
function useMyEmployees(): EmployeeWithStatus[]
```

### 5.2 后端 API

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/agents/create-employee` | 创建员工 Agent |
| DELETE | `/api/agents/:id` | 删除 Agent |
| GET | `/api/agents/employee/:id` | 获取员工关联的 Agent |

---

## 六、文件结构

```
ClawX/
├── scripts/
│   └── convert-agents-enhanced.js    # 增强版转换脚本
│
├── public/data/employees/            # 员工数据（重新生成）
│   ├── index.json
│   ├── engineering/
│   ├── design/
│   └── ...
│
├── src/
│   ├── stores/
│   │   └── employees.ts              # 员工 Store（扩展）
│   │
│   └── pages/Agents/
│       ├── Marketplace.tsx           # 员工市场（美化）
│       ├── EmployeeCard.tsx          # 员工卡片（美化）
│       ├── EmployeeDetail.tsx        # 员工详情（添加功能）
│       └── MyEmployees.tsx           # 我的员工（增强）
│
├── electron/
│   └── api/
│       └── agents.ts                  # Agent API（新增）
│
└── knowledge/
    └── 202603182230-impl-...          # 更新文档
```

---

## 七、实施计划

### 阶段 1：数据转换增强
- [ ] 1.1 创建 convert-agents-enhanced.js
- [ ] 1.2 运行脚本生成增强 JSON
- [ ] 1.3 验证数据完整性

### 阶段 2：UI 美化
- [ ] 2.1 美化部门筛选栏
- [ ] 2.2 美化员工卡片
- [ ] 2.3 美化员工详情

### 阶段 3：添加员工功能
- [ ] 3.1 后端 API 实现
- [ ] 3.2 工作空间文件生成
- [ ] 3.3 前端添加逻辑
- [ ] 3.4 映射关系存储

### 阶段 4：我的员工增强
- [ ] 4.1 显示已添加员工
- [ ] 4.2 发起对话功能
- [ ] 4.3 移除员工功能

---

## 八、验收标准

- [ ] 员工市场显示所有部门筛选
- [ ] 员工卡片显示中文名和介绍
- [ ] 点击添加员工后创建真实 Agent
- [ ] Agent 工作空间包含 5 个 md 文件
- [ ] 我的员工列表显示已添加的员工
- [ ] 可以切换到员工 Agent 对话
- [ ] 深色模式正常显示

---

## 九、风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 转换脚本复杂 | 进度延迟 | 先用简单方案，再用增强版 |
| Gateway API 不稳定 | 功能不可用 | 添加错误处理和重试 |
| 文件生成失败 | Agent 不完整 | 事务性创建，失败回滚 |
| 大量 Agent 创建 | 性能问题 | 限制并发，添加 Loading |

---

**文档版本**：v1.0
**创建日期**：2026-03-19
**最后更新**：2026-03-19