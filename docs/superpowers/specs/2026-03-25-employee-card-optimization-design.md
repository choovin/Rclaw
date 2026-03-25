# 数字员工模块优化设计方案

## 1. 概述

优化数字员工市场的员工卡片展示与添加流程，涉及5个方面的改进：

1. 中文显示文案优化（部门命名、vibe中文化、描述中文化）
2. 添加员工时的步骤进度条
3. 员工原型头像
4. 员工添加后同步出现在"我的员工"和"Agents"标签页
5. AgentSettingsModal 背景色与主题统一

---

## 2. 数据层 — 转换脚本增强

### 2.1 目标
为每个员工生成 `vibeZh` 和优质的 `descriptionZh` 字段。

### 2.2 翻译风格
**人才招募/猎头推荐风格** — 让企业管理者看到后会产生"这个数字员工正是我需要的"的感觉。

示例对比：
- ❌ "专业实验项目经理，专注于数据处理领域"
- ✅ "实验项目经理 | A/B测试专家，擅长大规模假设验证与统计分析，曾帮助X产品提升转化率15%，提升实验迭代效率30%"

### 2.3 vibeZh 翻译原则
- 简洁有力，6-15字
- 体现核心能力与价值
- 参考格式："用实验设计驱动决策，让数据说话"

### 2.4 descriptionZh 翻译原则
- 2-3句话，专业严谨
- 第一句：职位/角色定位
- 第二句：核心能力（用数据说话）
- 第三句：能给团队/产品带来什么价值

---

## 3. UI组件 — 员工卡片增强

### 3.1 原型头像

**结构**：彩色圆形背景 + Emoji 居中

```tsx
<div
  className="w-12 h-12 rounded-full flex items-center justify-center text-2xl shrink-0"
  style={{
    backgroundColor: getAvatarColor(employee.department) + '25',
    border: `2px solid ${getAvatarColor(employee.department)}40`
  }}
>
  {employee.emoji}
</div>
```

**配色方案**（按部门）：
| 部门 | 主色 |
|------|------|
| engineering | #3b82f6 (蓝) |
| design | #ec4899 (粉) |
| marketing | #f97316 (橙) |
| sales | #22c55e (绿) |
| product | #8b5cf6 (紫) |
| project-management | #06b6d4 (青) |
| academic | #eab308 (黄) |
| game-development | #ef4444 (红) |
| 其他 | #6b7280 (灰) |

### 3.2 文案显示

```tsx
// 风格（vibe）— 优先显示中文
<p className="text-[13px] text-foreground/80 italic">
  {employee.vibeZh || employee.vibe}
</p>

// 描述 — 优先显示中文
<p className="text-[13px] text-muted-foreground line-clamp-2">
  {employee.descriptionZh || employee.description}
</p>
```

---

## 4. 添加流程 — 步骤进度条

### 4.1 步骤设计

模拟技术流程中的关键步骤，每步300ms延迟（无需真实等待）：

| 步骤 | 显示文案 | 图标 |
|------|----------|------|
| 1 | 正在准备员工配置... | ⚙️ |
| 2 | 正在创建工作目录... | 📁 |
| 3 | 正在初始化文件... | 📝 |
| 4 | 正在注册到系统... | ✅ |

### 4.2 进度条组件

```tsx
interface AddProgressProps {
  currentStep: number;      // 0-3
  steps: StepConfig[];
  isComplete: boolean;
}

// 显示效果：步骤列表 + 当前步骤高亮 + 完成状态
```

### 4.3 组件位置

- `EmployeeCard` 添加按钮 → 显示内联进度
- `EmployeeDetail` 侧边栏添加按钮 → 显示内联进度

---

## 5. AgentSettingsModal 背景色修复

### 5.1 问题

Modal 使用硬编码背景色 `bg-[#f3f1e9] dark:bg-card`，与主题 `--card` CSS 变量不一致。

### 5.2 修复

```tsx
// 修改前
<Card className="... bg-[#f3f1e9] dark:bg-card">

// 修改后
<Card className="... bg-card dark:bg-card border-border">
```

---

## 6. "我的员工"与"Agents"同步

### 6.1 目标

员工添加到"我的员工"时，同时在 OpenClaw 中创建 Agent，使员工同时出现在两个标签页。

### 6.2 实现

**修改 `employees.ts` 的 `addEmployee`**：

```tsx
addEmployee: async (employee) => {
  // 1. 调用 OpenClaw API 创建 Agent
  await hostApiFetch('/api/agents', {
    method: 'POST',
    body: JSON.stringify({
      name: employee.nameZh,  // 或 employee.name
      inheritWorkspace: false
    })
  });

  // 2. 调用 IPC 创建员工 workspace 文件
  await window.electron.ipcRenderer.invoke('agents:create-employee', {...});

  // 3. 更新本地状态
  ...
}
```

### 6.3 注意事项

- OpenClaw API 调用失败时，不阻塞 workspace 文件创建
- 需要处理重复添加的幂等性

---

## 7. 文件改动清单

| 文件 | 改动内容 |
|------|----------|
| `scripts/convert-agents-enhanced.js` | 新增 vibeZh、descriptionZh 生成逻辑 |
| `src/data/employees/*/*.json` | 重新生成所有员工数据 |
| `src/pages/Agents/EmployeeCard.tsx` | 原型头像、中文文案、进度条 |
| `src/pages/Agents/EmployeeDetail.tsx` | 原型头像、中文文案、进度条 |
| `src/pages/Agents/index.tsx` | AgentSettingsModal 背景色修复 |
| `src/stores/employees.ts` | addEmployee 增加双写逻辑 |
| `src/stores/agents.ts` | 可能需要 refreshAgents 调用 |
| `src/components/ui/progress.tsx` | 新增步骤进度条组件 |
| `src/i18n/locales/zh/employees.json` | 可能需要补充 vibes 翻译（如采用方案B） |

---

## 8. 验证检查清单

- [ ] 员工卡片显示中文 vibe
- [ ] 员工卡片显示中文 description
- [ ] 员工卡片显示彩色原型头像
- [ ] 添加按钮显示步骤进度条
- [ ] 添加成功后员工出现在"我的员工"
- [ ] 添加成功后员工出现在"Agents"标签页
- [ ] AgentSettingsModal 背景色与主题一致
- [ ] pnpm dev 正常启动
- [ ] pnpm build 构建成功
