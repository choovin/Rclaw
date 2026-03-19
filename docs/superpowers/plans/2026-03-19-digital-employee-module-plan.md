# 数字员工模块完整实现 - 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现数字员工模块完整功能，包括员工市场UI美化、添加员工时创建真实OpenClaw Agent、生成工作空间文件

**Architecture:** 分为4个子系统：数据转换增强 → UI美化 → 添加员工功能 → 我的员工增强。每个子系统可独立测试和交付。

**Tech Stack:** TypeScript, React, Electron IPC, OpenClaw Gateway API, Node.js 脚本

---

## 文件结构

```
ClawX/
├── scripts/
│   └── convert-agents-enhanced.js     # 增强版转换脚本（新建）
│
├── public/data/employees/             # 员工数据（重新生成）
│   ├── index.json
│   └── {department}/*.json
│
├── src/
│   ├── types/
│   │   └── employee.ts                # 扩展员工类型定义
│   ├── stores/
│   │   └── employees.ts               # 员工 Store（扩展）
│   ├── i18n/locales/zh/
│   │   └── employees.json             # 部门中文名称翻译
│   └── pages/Agents/
│       ├── Marketplace.tsx            # 员工市场（美化）
│       ├── EmployeeCard.tsx           # 员工卡片（美化）
│       ├── EmployeeDetail.tsx         # 员工详情（添加功能）
│       └── MyEmployees.tsx            # 我的员工（增强）
│
├── electron/
│   └── api/
│       └── agents.ts                  # Agent API（新建）
│
└── knowledge/
    └── 202603182230-impl-...          # 更新文档
```

---

## 阶段一：数据转换增强

### Task 1.1: 创建增强版转换脚本 convert-agents-enhanced.js

**Files:**
- Create: `scripts/convert-agents-enhanced.js`

- [ ] **Step 1: 创建基础脚本结构**

```javascript
/**
 * Enhanced Convert Agents Script
 * Converts agency-agents-temp MD files to employee data with full content
 */
const fs = require('fs');
const path = require('path');

const AGENTS_DIR = path.join(__dirname, '..', 'agency-agents-temp');
const OUTPUT_DIR = path.join(__dirname, '..', 'public', 'data', 'employees');

// Department mapping
const DEPARTMENT_MAPPING = {
  engineering: { id: 'engineering', nameZh: '研发', emoji: '💻' },
  design: { id: 'design', nameZh: '设计', emoji: '🎨' },
  marketing: { id: 'marketing', nameZh: '营销', emoji: '📢' },
  sales: { id: 'sales', nameZh: '销售', emoji: '💼' },
  product: { id: 'product', nameZh: '产品', emoji: '📦' },
  'project-management': { id: 'project-management', nameZh: '项目管理', emoji: '📋' },
  academic: { id: 'academic', nameZh: '学术', emoji: '📚' },
  'game-development': { id: 'game-development', nameZh: '游戏开发', emoji: '🎮' },
  strategy: { id: 'strategy', nameZh: '战略', emoji: '♟️' },
  support: { id: 'support', nameZh: '客服', emoji: '🎧' },
  testing: { id: 'testing', nameZh: '测试', emoji: '🧪' },
  integrations: { id: 'integrations', nameZh: '集成', emoji: '🔗' },
  specialized: { id: 'specialized', nameZh: '专门技能', emoji: '⭐' },
  'spatial-computing': { id: 'spatial-computing', nameZh: '空间计算', emoji: '🌐' },
  'paid-media': { id: 'paid-media', nameZh: '付费媒体', emoji: '📺' },
};

// ... (existing name mapping code)
```

- [ ] **Step 2: 运行脚本生成测试数据**

Run: `node scripts/convert-agents-enhanced.js`
Expected: 在 public/data/employees/ 生成带有 soulContent, agentsContent, identityContent 字段的 JSON 文件

- [ ] **Step 3: 验证输出**

Run: `head -50 public/data/employees/engineering/engineering-frontend-developer.json`
Expected: JSON 包含 soulContent, agentsContent, identityContent 字段

- [ ] **Step 4: Commit**

```bash
git add scripts/convert-agents-enhanced.js public/data/employees/
git commit -m "feat: 添加增强版员工数据转换脚本"
```

---

### Task 1.2: 验证数据完整性

**Files:**
- Test: `public/data/employees/index.json`

- [ ] **Step 1: 检查生成的员工数量**

Run: `node -e "console.log(require('./public/data/employees/index.json').length)"`
Expected: 应该 > 100 个员工

- [ ] **Step 2: 检查字段完整性**

Run: `node -e "const e = require('./public/data/employees/engineering/engineering-frontend-developer.json'); console.log('soulContent:', !!e.soulContent, 'agentsContent:', !!e.agentsContent, 'identityContent:', !!e.identityContent)"`
Expected: 所有字段为 true

- [ ] **Step 3: Commit**

```bash
git add public/data/employees/
git commit -m "data: 重新生成员工数据（增强版）"
```

---

## 阶段二：UI 美化

### Task 2.1: 美化部门筛选栏

**Files:**
- Modify: `src/pages/Agents/Marketplace.tsx:83-102`

- [ ] **Step 1: 添加部门中文映射**

在 `src/i18n/locales/zh/employees.json` 添加部门翻译：

```json
{
  "departments": {
    "engineering": "研发",
    "design": "设计",
    "marketing": "营销",
    "sales": "销售",
    "product": "产品",
    "projectManagement": "项目管理",
    "academic": "学术",
    "gameDevelopment": "游戏开发",
    "strategy": "战略",
    "support": "客服",
    "testing": "测试",
    "integrations": "集成",
    "specialized": "专门技能",
    "spatialComputing": "空间计算",
    "paidMedia": "付费媒体"
  }
}
```

- [ ] **Step 2: 修改部门筛选栏样式**

```tsx
// 当前代码
<Badge variant={selectedDepartment === 'all' ? 'default' : 'outline'}>
  {t('allDepartments')}
</Badge>

// 修改为
<button
  className={cn(
    "px-4 py-1.5 rounded-full text-[13px] font-medium transition-all whitespace-nowrap",
    selectedDepartment === 'all'
      ? "bg-foreground text-background"
      : "border border-border/40 bg-transparent text-foreground/70 hover:bg-secondary"
  )}
  onClick={() => setSelectedDepartment('all')}
>
  {t('allDepartments')}
</button>
```

- [ ] **Step 3: 测试筛选功能**

Run: `pnpm dev` → 打开员工市场 → 点击各部门筛选
Expected: 正确筛选显示对应部门员工

- [ ] **Step 4: Commit**

```bash
git add src/pages/Agents/Marketplace.tsx src/i18n/locales/zh/employees.json
git commit -m "style: 美化员工市场部门筛选栏"
```

---

### Task 2.2: 美化员工卡片

**Files:**
- Modify: `src/pages/Agents/EmployeeCard.tsx`

- [ ] **Step 1: 修改卡片结构**

```tsx
// 新增结构
<div className="employee-card bg-card border border-border/40 rounded-2xl p-5 hover:shadow-md transition-all cursor-pointer">
  {/* 部门标签 */}
  <div className="flex items-center gap-1.5 mb-3">
    <span className="text-sm">{employee.emoji}</span>
    <span className="text-xs text-muted-foreground">
      {t(`departments.${employee.department}`)}
    </span>
  </div>

  {/* 中文名（主显示） */}
  <h3 className="text-[17px] font-semibold text-foreground mb-0.5">
    {employee.nameZh}
  </h3>

  {/* 英文名 */}
  <p className="text-[13px] text-muted-foreground mb-3">
    {employee.name}
  </p>

  {/* 风格描述 */}
  {employee.vibe && (
    <p className="text-[13px] text-foreground/70 mb-3 line-clamp-2">
      {employee.vibe}
    </p>
  )}

  {/* 描述 */}
  <p className="text-[13px] text-muted-foreground line-clamp-2 mb-4">
    {employee.description}
  </p>

  {/* 添加按钮 */}
  <Button size="sm" className="w-full rounded-full">
    <Plus className="h-4 w-4 mr-1" />
    {t('addEmployee')}
  </Button>
</div>
```

- [ ] **Step 2: 验证卡片显示**

Run: `pnpm dev` → 员工市场
Expected: 显示中文名、部门标签、风格描述

- [ ] **Step 3: Commit**

```bash
git add src/pages/Agents/EmployeeCard.tsx
git commit -m "style: 美化员工卡片UI"
```

---

### Task 2.3: 美化员工详情

**Files:**
- Modify: `src/pages/Agents/EmployeeDetail.tsx`

- [ ] **Step 1: 更新详情页面结构**

参考设计文档，更新详情页显示：
- 中文名为主标题
- 英文名为副标题
- 部门中文名称
- 完整的描述内容

- [ ] **Step 2: 验证详情显示**

Run: `pnpm dev` → 点击员工卡片 → 查看详情侧边栏
Expected: 中文内容正确显示

- [ ] **Step 3: Commit**

```bash
git add src/pages/Agents/EmployeeDetail.tsx
git commit -m "style: 美化员工详情页面"
```

---

## 阶段三：添加员工功能

### Task 3.1: 后端 API 实现

**Files:**
- Create: `electron/api/employees.ts`
- Modify: `electron/main/index.ts` (注册路由)

- [ ] **Step 1: 创建 API 处理函数**

```typescript
// electron/api/employees.ts
import { ipcMain } from 'electron';
import { invokeIpc } from '../lib/ipc-utils';
import * as fs from 'fs';
import * as path from 'path';

// API: 创建员工 Agent
ipcMain.handle('agents:create-employee', async (_, options: {
  employeeId: string;
  nameZh: string;
  nameEn: string;
  soulContent: string;
  agentsContent: string;
  identityContent: string;
}) => {
  try {
    // 1. 调用 Gateway API 创建 Agent
    const agentResult = await invokeIpc('gateway:create-agent', {
      name: options.nameZh,
      description: options.nameEn,
    });

    if (!agentResult.success) {
      throw new Error(agentResult.error || 'Failed to create agent');
    }

    const agentId = agentResult.agentId;

    // 2. 生成工作空间文件
    const workspaceDir = path.join(
      process.env.APPDATA || process.env.HOME,
      'openclaw',
      'workspaces',
      agentId
    );

    fs.mkdirSync(workspaceDir, { recursive: true });

    // 写入 SOUL.md
    fs.writeFileSync(
      path.join(workspaceDir, 'SOUL.md'),
      options.soulContent
    );

    // 写入 AGENTS.md
    fs.writeFileSync(
      path.join(workspaceDir, 'AGENTS.md'),
      options.agentsContent
    );

    // 写入 IDENTITY.md
    fs.writeFileSync(
      path.join(workspaceDir, 'IDENTITY.md'),
      options.identityContent
    );

    // 写入 user.md (模板)
    fs.writeFileSync(
      path.join(workspaceDir, 'user.md'),
      generateUserTemplate(options)
    );

    // 写入 todo.md (模板)
    fs.writeFileSync(
      path.join(workspaceDir, 'todo.md'),
      generateTodoTemplate(options)
    );

    return {
      success: true,
      agentId,
      workspacePath: workspaceDir,
    };
  } catch (error) {
    console.error('Failed to create employee agent:', error);
    return {
      success: false,
      error: String(error),
    };
  }
});

function generateUserTemplate(options: any): string {
  return `# 👤 我的资料

## 基本信息
- **名字**：${options.nameZh}
- **英文名**：${options.nameEn}
- **角色**：数字员工

## 我擅长的
<!-- 从员工技能中提取 -->

## 我的工作风格
<!-- 从员工人设中提取 -->

## 当前项目
<!-- 记录当前正在处理的项目 -->

## 常用工具
<!-- 记录常用的工具和命令 -->

---
*由 Rclaw 数字员工系统生成*
`;
}

function generateTodoTemplate(options: any): string {
  return `# 📋 待办事项

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
`;
}
```

- [ ] **Step 2: 注册 API 路由**

在 `electron/main/index.ts` 或对应入口文件中导入并注册

- [ ] **Step 3: 测试 API**

Run: `pnpm dev` → 在 DevTools 中测试 `window.electron.ipcRenderer.invoke('agents:create-employee', {...})`

- [ ] **Step 4: Commit**

```bash
git add electron/api/employees.ts
git commit -m "feat: 添加创建员工Agent的API"
```

---

### Task 3.2: 前端添加逻辑

**Files:**
- Modify: `src/stores/employees.ts`
- Modify: `src/pages/Agents/EmployeeDetail.tsx`

- [ ] **Step 1: 扩展 employees Store**

```typescript
// src/stores/employees.ts 新增方法
addEmployee: async (employee: EmployeeWithStatus) => {
  const result = await invokeIpc('agents:create-employee', {
    employeeId: employee.id,
    nameZh: employee.nameZh,
    nameEn: employee.name,
    soulContent: employee.soulContent || '',
    agentsContent: employee.agentsContent || '',
    identityContent: employee.identityContent || '',
  });

  if (result.success) {
    // 更新本地状态
    set((state) => ({
      myEmployees: [
        ...state.myEmployees,
        { ...employee, isAdded: true, agentId: result.agentId, addedAt: Date.now() }
      ],
    }));
    // 保存到持久化存储
    const updatedMyEmployees = [...get().myEmployees, { ...employee, isAdded: true, agentId: result.agentId, addedAt: Date.now() }];
    localStorage.setItem('myEmployees', JSON.stringify(updatedMyEmployees));
  }

  return result;
},
```

- [ ] **Step 2: 在 EmployeeDetail 添加添加按钮**

```tsx
// EmployeeDetail.tsx
<Button
  onClick={async () => {
    setAdding(true);
    const result = await addEmployee(employee);
    setAdding(false);
    if (result.success) {
      toast.success(t('addSuccess'));
      onClose();
    } else {
      toast.error(result.error);
    }
  }}
  disabled={adding || employee.isAdded}
  className="w-full"
>
  {employee.isAdded ? t('alreadyAdded') : adding ? t('adding') : t('addToMyEmployees')}
</Button>
```

- [ ] **Step 3: 测试添加流程**

Run: `pnpm dev` → 员工市场 → 选择员工 → 点击"添加"
Expected: 创建 Agent，生成文件，显示成功提示

- [ ] **Step 4: Commit**

```bash
git add src/stores/employees.ts src/pages/Agents/EmployeeDetail.tsx
git commit -m "feat: 实现添加员工到我的员工功能"
```

---

## 阶段四：我的员工增强

### Task 4.1: 显示已添加员工

**Files:**
- Modify: `src/pages/Agents/MyEmployees.tsx`

- [ ] **Step 1: 加载我的员工数据**

```typescript
// MyEmployees.tsx
const myEmployees = useEmployeesStore((state) => state.myEmployees);
const loadMyEmployees = useEmployeesStore((state) => state.loadMyEmployees);

useEffect(() => {
  loadMyEmployees();
}, [loadMyEmployees]);
```

- [ ] **Step 2: 渲染我的员工列表**

```tsx
// 使用与 Marketplace 相同的 EmployeeCard 组件，但标记为已添加
myEmployees.map((employee) => (
  <EmployeeCard
    key={employee.id}
    employee={employee}
    isAdded={true}
    onClick={() => setSelectedEmployee(employee)}
  />
))
```

- [ ] **Step 4: Commit**

```bash
git add src/pages/Agents/MyEmployees.tsx
git commit -m "feat: 显示我的员工列表"
```

---

### Task 4.2: 发起对话功能

**Files:**
- Modify: `src/pages/Agents/MyEmployees.tsx`
- Modify: `src/stores/chat.ts`

- [ ] **Step 1: 添加切换到员工 Agent 对话的方法**

```typescript
// src/stores/chat.ts 新增
switchToEmployeeAgent: async (agentId: string) => {
  // 创建新的 session 并设置 currentAgentId
  const sessionKey = `agent:${agentId}`;
  await createSession(sessionKey);
  switchSession(sessionKey);
  // 导航到聊天页面
  navigate('/');
},
```

- [ ] **Step 2: 在我的员工卡片添加发起对话按钮**

```tsx
<Button
  variant="outline"
  onClick={() => switchToEmployeeAgent(employee.agentId)}
>
  <MessageCircle className="h-4 w-4 mr-1" />
  {t('startChat')}
</Button>
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/Agents/MyEmployees.tsx src/stores/chat.ts
git commit -m "feat: 添加发起对话功能"
```

---

### Task 4.3: 移除员工功能

**Files:**
- Modify: `src/stores/employees.ts`
- Modify: `src/pages/Agents/MyEmployees.tsx`

- [ ] **Step 1: 添加移除员工方法**

```typescript
removeEmployee: (employeeId: string) => {
  set((state) => ({
    myEmployees: state.myEmployees.filter((e) => e.id !== employeeId),
  }));
  // 同步到持久化存储
  const filtered = get().myEmployees.filter((e) => e.id !== employeeId);
  localStorage.setItem('myEmployees', JSON.stringify(filtered));
},
```

- [ ] **Step 2: 添加移除按钮到我的员工卡片**

```tsx
<Button
  variant="ghost"
  size="icon"
  onClick={() => {
    removeEmployee(employee.id);
    toast.success(t('removed'));
  }}
>
  <Trash2 className="h-4 w-4" />
</Button>
```

- [ ] **Step 3: Commit**

```bash
git add src/stores/employees.ts src/pages/Agents/MyEmployees.tsx
git commit -m "feat: 添加移除员工功能"
```

---

## 最终提交

- [ ] **更新知识库文档**

```bash
git add knowledge/
git commit -m "docs: 更新知识库-数字员工模块实现"
```

---

## 验收检查清单

执行完所有任务后，验证：

- [ ] 员工市场显示所有部门筛选（中文）
- [ ] 员工卡片显示中文名和介绍
- [ ] 点击添加员工后创建真实 Agent
- [ ] Agent 工作空间包含 5 个 md 文件
- [ ] 我的员工列表显示已添加的员工
- [ ] 可以切换到员工 Agent 对话
- [ ] 深色模式正常显示

---

**计划版本**：v1.0
**创建日期**：2026-03-19
**设计文档**：`docs/superpowers/specs/2026-03-19-digital-employee-module-design.md`