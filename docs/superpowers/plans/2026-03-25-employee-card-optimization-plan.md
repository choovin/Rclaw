# 数字员工模块优化实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 优化数字员工卡片的展示与添加流程，包括中文本地化、步骤进度条、原型头像、数据双写同步

**Architecture:**
- 数据层：扩展转换脚本生成 `vibeZh` 和 `descriptionZh`
- UI层：修改 `EmployeeCard`/`EmployeeDetail` 增加头像和进度条
- 业务层：修改 `employees.ts` 的 `addEmployee` 实现双写 + 步骤模拟
- 样式层：修复 `AgentSettingsModal` 背景色

**Tech Stack:** TypeScript, React, Zustand, Radix UI Progress

---

## 文件结构

```
src/
  components/ui/
    add-progress.tsx        # 新建：步骤进度条组件
  pages/Agents/
    EmployeeCard.tsx         # 修改：原型头像、中文文案、进度条
    EmployeeDetail.tsx       # 修改：原型头像、中文文案、进度条
    index.tsx               # 修改：AgentSettingsModal背景色修复
  stores/
    employees.ts            # 修改：addEmployee双写+步骤进度逻辑
  data/employees/           # 重新生成所有JSON数据
scripts/
  convert-agents-enhanced.js # 修改：生成vibeZh字段
```

---

## Task 1: 增强转换脚本 — 新增 vibeZh 生成

**Files:**
- Modify: `scripts/convert-agents-enhanced.js`

- [ ] **Step 1: 读取当前脚本的完整内容**

确认 `generateIdentityContent` 函数位置（约第200-208行）

- [ ] **Step 2: 添加 generateVibeZh 函数**

在 `generateDescriptionZh` 函数之后添加：

```javascript
/**
 * Generate Chinese vibe from English vibe
 * 人才猎头风格：简洁有力，6-15字
 */
function generateVibeZh(vibe) {
  if (!vibe) return '';

  const vibeLower = vibe.toLowerCase();

  // Pattern-based translation with talent recruitment style
  const patterns = [
    // Experiment/Data driven
    { pattern: /data driven|experiments?.*data|let the data/i, zh: '让数据驱动决策' },
    { pattern: /experiment.*design|design.*experiment/i, zh: '用实验设计验证想法' },
    { pattern: /hypothesis.*validat|validat.*hypothesis/i, zh: '严谨假设，精准验证' },
    { pattern: /a.b test|ab test/i, zh: 'A/B测试专家' },
    { pattern: /statistical|statistic.*significance/i, zh: '统计分析见长' },
    { pattern: /results.*decide|decide.*results/i, zh: '用数据说话' },
    { pattern: /systematic|rigorous/i, zh: '系统化思维' },

    // Engineering
    { pattern: /full.?stack|full.?stack.*develop/i, zh: '全栈开发专家' },
    { pattern: /frontend|front.?end/i, zh: '前端开发专家' },
    { pattern: /backend|back.?end/i, zh: '后端架构专家' },
    { pattern: /devops|sre|automation/i, zh: 'DevOps自动化实践者' },
    { pattern: /security|threat.*detect/i, zh: '安全工程专家' },
    { pattern: /database|data.*optimi/i, zh: '数据库优化专家' },
    { pattern: /mobile|ios|android|app.*builder/i, zh: '移动端开发专家' },
    { pattern: /frontend|front.?end/i, zh: '前端开发专家' },
    { pattern: /ai.*engineer|machine.?learn/i, zh: 'AI工程专家' },
    { pattern: /embedded.*firmware|firmware/i, zh: '嵌入式开发专家' },
    { pattern: /git.*workflow|code.*review/i, zh: '代码质量守护者' },
    { pattern: /incident.*response|on.?call/i, zh: '应急响应专家' },
    { pattern: /technical.*writer|document/i, zh: '技术文档专家' },

    // Design
    { pattern: /ui.*design|interface.*design/i, zh: 'UI设计专家' },
    { pattern: /ux.*design|user.*experience/i, zh: '用户体验设计专家' },
    { pattern: /brand.*guardian|brand.*design/i, zh: '品牌设计守护者' },
    { pattern: /image.*prompt|prompt.*engine/i, zh: 'AI图像提示词专家' },
    { pattern: /inclusive.*visual|accessibility/i, zh: '无障碍设计专家' },
    { pattern: /visual.*story|storytell/i, zh: '视觉叙事专家' },
    { pattern: /whimsy|playful|fun/i, zh: '趣味设计注入者' },

    // Marketing
    { pattern: /seo|search.*optim/i, zh: 'SEO优化专家' },
    { pattern: /content.*creat|content.*market/i, zh: '内容营销专家' },
    { pattern: /social.*media|social.*strateg/i, zh: '社交媒体策略师' },
    { pattern: /growth.*hack|growth.*market/i, zh: '增长黑客' },
    { pattern: /tiktok|douyin|short.*video/i, zh: '短视频运营专家' },
    { pattern: /ecommerce|e.?commerce/i, zh: '电商运营专家' },
    { pattern: /livestream|live.*stream/i, zh: '直播带货专家' },
    { pattern: /wechat.*official|wechat.*account/i, zh: '微信生态运营专家' },

    // Sales
    { pattern: /sales.*coach|coach.*sales/i, zh: '销售教练' },
    { pattern: /deal.*strateg|negotiat/i, zh: '交易策略专家' },
    { pattern: /outbound|lead.*gener/i, zh: '外销拓展专家' },
    { pattern: /pipeline.*analyst|pipeline/i, zh: '销售管道分析师' },
    { pattern: /account.*strateg|enterprise.*sale/i, zh: '大客户战略专家' },

    // Product
    { pattern: /behavior.*nudge|nudge.*engine/i, zh: '行为设计专家' },
    { pattern: /feedback.*synth|synthes.*feedback/i, zh: '用户反馈整合专家' },
    { pattern: /sprint.*priorit|sprint/i, zh: '敏捷迭代专家' },
    { pattern: /trend.*research|trend.*analyst/i, zh: '趋势研究专家' },

    // Project Management
    { pattern: /experiment.*track|experiment.*design/i, zh: '实验项目管理专家' },
    { pattern: /jira.*workflow|jira/i, zh: 'Jira工作流专家' },
    { pattern: /project.*shepherd|shepherd/i, zh: '项目护航专家' },
    { pattern: /studio.*operat|operation/i, zh: '工作室运营专家' },
    { pattern: /producer|product.*manage/i, zh: '制作管理专家' },

    // Testing
    { pattern: /accessibilit.*audit|access.*audit/i, zh: '无障碍测试专家' },
    { pattern: /api.*test|api.*audit/i, zh: 'API测试专家' },
    { pattern: /performance.*benchmark|benchmark/i, zh: '性能基准测试专家' },
    { pattern: /evidence.*collect|evidence/i, zh: '测试证据收集专家' },
    { pattern: /reality.*check|reality.*check/i, zh: '真实性验证专家' },
    { pattern: /workflow.*optim|workflow/i, zh: '流程优化测试专家' },

    // Support
    { pattern: /analytics.*report|analytics/i, zh: '数据分析专家' },
    { pattern: /executive.*summary|summary/i, zh: '高管报告专家' },
    { pattern: /finance.*track|finance/i, zh: '财务追踪专家' },
    { pattern: /infrastructure.*maintain|infrastructure/i, zh: '基础设施维护专家' },
    { pattern: /legal.*complian|compliance/i, zh: '合规审计专家' },
    { pattern: /support.*respond|support/i, zh: '客户响应专家' },

    // Game Development
    { pattern: /game.*audio|audio.*engine/i, zh: '游戏音频工程师' },
    { pattern: /level.*design|level.*design/i, zh: '关卡设计师' },
    { pattern: /narrative.*design|story.*design/i, zh: '叙事设计师' },
    { pattern: /technical.*artist/i, zh: '技术美术专家' },

    // Spatial Computing
    { pattern: /spatial.*metal|metal.*engine/i, zh: '空间Metal图形工程师' },
    { pattern: /terminal.*integrat|terminal/i, zh: '终端集成专家' },
    { pattern: /vision.*os|visionos/i, zh: 'VisionOS空间开发专家' },
    { pattern: /xr.*immersive|immersive/i, zh: 'XR沉浸式开发专家' },
    { pattern: /cockpit.*interact|cockpit/i, zh: 'XR座舱交互专家' },
    { pattern: /xr.*interface|interface.*architect/i, zh: 'XR界面架构师' },

    // Paid Media
    { pattern: /programmatic.*buy|programmatic/i, zh: '程序化广告买手' },
    { pattern: /search.*query|query.*analyst/i, zh: '搜索 Query 分析师' },
    { pattern: /ppc.*strateg|ppc/i, zh: 'PPC策略专家' },
    { pattern: /paid.*social|paid.*social.*strateg/i, zh: '付费社交策略师' },
    { pattern: /creative.*strateg|creative/i, zh: '创意策略专家' },
    { pattern: /tracking.*specialist|tracking/i, zh: '广告追踪专家' },

    // Specialized
    { pattern: /blockchain.*audit|security.*audit/i, zh: '区块链安全审计专家' },
    { pattern: /compliance.*audit|governance/i, zh: '合规治理专家' },
    { pattern: /corporate.*training|training.*design/i, zh: '企业培训设计师' },
    { pattern: /data.*consolidat|data.*agent/i, zh: '数据整合专家' },
    { pattern: /identity.*graph|identity.*graph/i, zh: '身份图谱专家' },
    { pattern: /agentic.*identity|trust.*architect/i, zh: 'Agent身份信任架构师' },
    { pattern: /mcp.*builder|mcp/i, zh: 'MCP构建专家' },
    { pattern: /salesforce.*architect|salesforce/i, zh: 'Salesforce架构师' },
    { pattern: /workflow.*architect|workflow/i, zh: '工作流架构师' },
    { pattern: /supply.*chain|supply.*chain/i, zh: '供应链战略专家' },
    { pattern: /zk.*steward|zero.?knowledge/i, zh: '零知识证明专家' },
    { pattern: /model.*qa|qa.*model/i, zh: '模型质量保障专家' },
    { pattern: /cultur.*intelligence|cultural/i, zh: '文化智能战略专家' },
    { pattern: /korean.*business|korean.*nav/i, zh: '韩中商务导航专家' },
    { pattern: /french.*consult|french.*market/i, zh: '法国市场咨询专家' },
    { pattern: /study.*abroad|abroad.*advisor/i, zh: '留学咨询顾问' },
    { pattern: /government.*digital|gov.*digital/i, zh: '政府数字化顾问' },
    { pattern: /healthcare.*complian|healthcare/i, zh: '医疗营销合规专家' },
  ];

  for (const { pattern, zh } of patterns) {
    if (pattern.test(vibeLower)) {
      return zh;
    }
  }

  // Fallback: extract key phrase and translate
  return vibe.length > 20 ? vibe.substring(0, 15) + '...' : vibe;
}
```

- [ ] **Step 3: 修改 convertAgent 函数，添加 vibeZh 输出**

在 `convertAgent` 函数中（约第553-568行），在返回值添加 `vibeZh` 字段：

```javascript
// Generate Chinese vibe
const vibeZh = generateVibeZh(frontmatter.vibe);

return {
  id: generateId(department, frontmatter.name),
  name: frontmatter.name,
  nameZh,
  description: frontmatter.description || '',
  descriptionZh, // 中文描述
  vibeZh,         // 新增：中文风格
  color: frontmatter.color || 'blue',
  emoji: frontmatter.emoji || '👤',
  vibe: frontmatter.vibe || '',
  department: DEPARTMENT_MAPPING[department]?.id || 'specialized',
  departmentNameZh: DEPARTMENT_MAPPING[department]?.nameZh || '专门技能',
  soulContent,
  agentsContent,
  identityContent,
};
```

- [ ] **Step 4: 重新运行转换脚本生成数据**

Run: `node scripts/convert-agents-enhanced.js`
Expected: 所有 JSON 文件包含 `vibeZh` 字段

- [ ] **Step 5: 同步数据到 src/data/employees**

Run: `rm -rf src/data/employees && cp -r public/data/employees src/data/employees`
Expected: src/data/employees 包含所有更新后的 JSON

- [ ] **Step 6: 提交代码**

```bash
git add scripts/convert-agents-enhanced.js public/data/employees/ src/data/employees/
git commit -m "feat: 增强转换脚本，生成vibeZh字段"
```

---

## Task 2: 创建步骤进度条组件

**Files:**
- Create: `src/components/ui/add-progress.tsx`
- Test: `src/components/ui/add-progress.test.tsx`

- [ ] **Step 1: 创建 AddProgress 组件**

```tsx
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

export interface StepConfig {
  label: string;
  icon: string;
}

export interface AddProgressProps {
  currentStep: number;   // 0-based, 当前执行到的步骤
  steps: StepConfig[];
  isComplete: boolean;
}

export function AddProgress({ currentStep, steps, isComplete }: AddProgressProps) {
  return (
    <div className="space-y-2 py-2">
      {steps.map((step, index) => {
        const isDone = index < currentStep || isComplete;
        const isActive = index === currentStep && !isComplete;

        return (
          <div
            key={index}
            className={cn(
              'flex items-center gap-2 text-sm transition-all duration-200',
              isDone && 'text-green-600 dark:text-green-400',
              isActive && 'text-foreground font-medium',
              !isDone && !isActive && 'text-muted-foreground'
            )}
          >
            <div
              className={cn(
                'w-5 h-5 rounded-full flex items-center justify-center text-xs shrink-0',
                isDone && 'bg-green-500 text-white',
                isActive && 'bg-primary text-primary-foreground animate-pulse',
                !isDone && !isActive && 'bg-secondary text-secondary-foreground'
              )}
            >
              {isDone ? <Check className="w-3 h-3" /> : step.icon}
            </div>
            <span>{step.label}</span>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: 提交**

```bash
git add src/components/ui/add-progress.tsx
git commit -m "feat: 添加AddProgress步骤进度条组件"
```

---

## Task 3: 修改 EmployeeCard — 原型头像、中文文案、进度条

**Files:**
- Modify: `src/pages/Agents/EmployeeCard.tsx`
- Modify: `src/types/employee.ts` (添加 vibeZh 类型)

- [ ] **Step 1: 添加 getAvatarColor 辅助函数**

在文件顶部添加：

```tsx
const DEPARTMENT_COLORS: Record<string, string> = {
  engineering: '#3b82f6',   // 蓝
  design: '#ec4899',         // 粉
  marketing: '#f97316',      // 橙
  sales: '#22c55e',          // 绿
  product: '#8b5cf6',        // 紫
  'project-management': '#06b6d4', // 青
  academic: '#eab308',       // 黄
  'game-development': '#ef4444',  // 红
  support: '#8b5cf6',       // 紫
  testing: '#06b6d4',       // 青
  integrations: '#6b7280', // 灰
  specialized: '#f97316',    // 橙
  'spatial-computing': '#3b82f6', // 蓝
  'paid-media': '#f97316',  // 橙
  strategy: '#6b7280',      // 灰
};

function getAvatarColor(department: string): string {
  return DEPARTMENT_COLORS[department] || '#6b7280';
}
```

- [ ] **Step 2: 添加 Employee 接口的 vibeZh 类型**

在 `src/types/employee.ts` 中 `Employee` 接口添加：

```typescript
export interface Employee {
  id: string;
  name: string;
  nameZh: string;
  description: string;
  descriptionZh?: string;
  color: string;
  emoji: string;
  vibe: string;
  vibeZh?: string;  // 新增
  department: Department;
  skills?: string[];
  channels?: string[];
  soulContent?: string;
  agentsContent?: string;
  identityContent?: string;
}
```

- [ ] **Step 3: 修改 EmployeeCard 返回的 JSX**

在卡片的顶部（部门标签下方）添加头像：

```tsx
// 原型头像
<div
  className="w-12 h-12 rounded-full flex items-center justify-center text-2xl mb-3"
  style={{
    backgroundColor: getAvatarColor(employee.department) + '25',
    border: `2px solid ${getAvatarColor(employee.department)}40`
  }}
>
  {employee.emoji}
</div>
```

修改文案显示部分：

```tsx
// 风格（vibe）— 优先显示中文
{employee.vibeZh || employee.vibe ? (
  <p className="text-[13px] text-foreground/80 italic mb-3 line-clamp-2">
    {employee.vibeZh || employee.vibe}
  </p>
) : null}

// 描述 — 优先显示中文
<p className="text-[13px] text-muted-foreground line-clamp-2 mb-4">
  {employee.descriptionZh || employee.description}
</p>
```

- [ ] **Step 4: 添加进度条状态和步骤配置**

在组件内添加：

```tsx
const { t } = useTranslation('employees');
const [addProgress, setAddProgress] = useState<number | null>(null);

const ADD_STEPS: StepConfig[] = [
  { label: '正在准备员工配置...', icon: '⚙️' },
  { label: '正在创建工作目录...', icon: '📁' },
  { label: '正在初始化文件...', icon: '📝' },
  { label: '正在注册到系统...', icon: '✅' },
];
```

- [ ] **Step 5: 修改 handleAddClick 实现步骤进度**

```tsx
const handleAddClick = async (e: React.MouseEvent) => {
  e.stopPropagation();
  if (isAdded) {
    removeEmployee(employee.id);
  } else {
    // 模拟步骤进度
    for (let step = 0; step < ADD_STEPS.length; step++) {
      setAddProgress(step);
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    await addEmployee(employee);
    setAddProgress(null);
  }
};
```

- [ ] **Step 6: 修改添加按钮区域**

```tsx
{showAddButton && (
  <div>
    {addProgress !== null ? (
      <AddProgress currentStep={addProgress} steps={ADD_STEPS} isComplete={false} />
    ) : (
      <Button
        size="sm"
        className="w-full rounded-full"
        variant={isAdded ? 'outline' : 'default'}
        onClick={handleAddClick}
      >
        <Plus className="h-4 w-4 mr-1" />
        {isAdded ? t('remove') : t('addEmployee')}
      </Button>
    )}
  </div>
)}
```

- [ ] **Step 7: 导入 AddProgress**

```tsx
import { AddProgress, type StepConfig } from '@/components/ui/add-progress';
```

- [ ] **Step 8: 提交**

```bash
git add src/pages/Agents/EmployeeCard.tsx src/types/employee.ts
git commit -m "feat: EmployeeCard添加原型头像、中文文案、步骤进度条"
```

---

## Task 4: 修改 EmployeeDetail — 同步头像和文案

**Files:**
- Modify: `src/pages/Agents/EmployeeDetail.tsx`

- [ ] **Step 1: 添加 getAvatarColor 函数（与 EmployeeCard 相同）**

```tsx
const DEPARTMENT_COLORS: Record<string, string> = {
  engineering: '#3b82f6',
  design: '#ec4899',
  marketing: '#f97316',
  sales: '#22c55e',
  product: '#8b5cf6',
  'project-management': '#06b6d4',
  academic: '#eab308',
  'game-development': '#ef4444',
  support: '#8b5cf6',
  testing: '#06b6d4',
  integrations: '#6b7280',
  specialized: '#f97316',
  'spatial-computing': '#3b82f6',
  'paid-media': '#f97316',
  strategy: '#6b7280',
};

function getAvatarColor(department: string): string {
  return DEPARTMENT_COLORS[department] || '#6b7280';
}
```

- [ ] **Step 2: 添加步骤进度条状态**

```tsx
const [addProgress, setAddProgress] = useState<number | null>(null);

const ADD_STEPS: StepConfig[] = [
  { label: '正在准备员工配置...', icon: '⚙️' },
  { label: '正在创建工作目录...', icon: '📁' },
  { label: '正在初始化文件...', icon: '📝' },
  { label: '正在注册到系统...', icon: '✅' },
];
```

- [ ] **Step 3: 修改头像显示**

将顶部的 emoji 显示改为原型头像：

```tsx
// 修改前
<span className="text-4xl">{employee.emoji}</span>

// 修改后
<div
  className="w-14 h-14 rounded-full flex items-center justify-center text-3xl"
  style={{
    backgroundColor: getAvatarColor(employee.department) + '25',
    border: `2px solid ${getAvatarColor(employee.department)}40`
  }}
>
  {employee.emoji}
</div>
```

- [ ] **Step 4: 修改 vibe 显示**

```tsx
// 修改前
<p className="text-[14px] text-foreground/80 italic">{employee.vibe}</p>

// 修改后
<p className="text-[14px] text-foreground/80 italic">{employee.vibeZh || employee.vibe}</p>
```

- [ ] **Step 5: 修改 description 显示**

```tsx
// 修改前
<p className="text-[14px] text-foreground leading-relaxed">{employee.descriptionZh || employee.description}</p>

// 修改后 (保持一致)
<p className="text-[14px] text-foreground leading-relaxed">{employee.descriptionZh || employee.description}</p>
```

- [ ] **Step 6: 修改 handleAddRemove 实现步骤进度**

```tsx
const handleAddRemove = async () => {
  if (isProcessing || addProgress !== null) return;

  if (isAdded) {
    removeEmployee(employee.id);
    toast.success(t('removed'));
  } else {
    // 模拟步骤进度
    for (let step = 0; step < ADD_STEPS.length; step++) {
      setAddProgress(step);
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    try {
      const success = await addEmployee(employee);
      if (success) {
        toast.success(t('addSuccess'));
      } else {
        toast.error('添加失败');
      }
    } finally {
      setAddProgress(null);
    }
  }
};
```

- [ ] **Step 7: 修改底部按钮区域**

```tsx
<Button
  variant={isAdded ? 'outline' : 'default'}
  className="w-full rounded-full"
  onClick={handleAddRemove}
  disabled={isProcessing || addProgress !== null}
>
  {addProgress !== null ? (
    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
  ) : isAdded ? (
    <Trash2 className="h-4 w-4 mr-2" />
  ) : (
    <Plus className="h-4 w-4 mr-2" />
  )}
  {addProgress !== null ? t('adding') : isAdded ? t('remove') : t('addToMyEmployees')}
</Button>

{addProgress !== null && (
  <div className="mt-2">
    <AddProgress currentStep={addProgress} steps={ADD_STEPS} isComplete={false} />
  </div>
)}
```

- [ ] **Step 8: 导入 AddProgress 和 StepConfig**

```tsx
import { AddProgress, type StepConfig } from '@/components/ui/add-progress';
```

- [ ] **Step 9: 提交**

```bash
git add src/pages/Agents/EmployeeDetail.tsx
git commit -m "feat: EmployeeDetail添加原型头像、中文文案、步骤进度条"
```

---

## Task 5: 修改 employees.ts — addEmployee 双写逻辑

**Files:**
- Modify: `src/stores/employees.ts`
- Import: `hostApiFetch` 从 `@/lib/host-api`

- [ ] **Step 1: 添加 hostApiFetch 导入**

```tsx
import { hostApiFetch } from '@/lib/host-api';
```

- [ ] **Step 2: 修改 addEmployee 函数实现双写**

```tsx
addEmployee: async (employee) => {
  const { employees, myEmployees } = get();

  try {
    set({ isLoading: true });

    // 1. 调用 OpenClaw API 创建 Agent（如果失败不阻塞继续）
    try {
      await hostApiFetch('/api/agents', {
        method: 'POST',
        body: JSON.stringify({
          name: employee.nameZh,
          inheritWorkspace: false,
        }),
      });
    } catch (apiError) {
      console.warn('OpenClaw API call failed, continuing with workspace creation:', apiError);
    }

    // 2. 调用 IPC 创建员工 workspace 文件
    await window.electron.ipcRenderer.invoke('agents:create-employee', {
      employeeId: employee.id,
      nameZh: employee.nameZh,
      nameEn: employee.name,
      soulContent: (employee as EmployeeWithStatus).soulContent || '',
      agentsContent: (employee as EmployeeWithStatus).agentsContent || '',
      identityContent: (employee as EmployeeWithStatus).identityContent || '',
    });

    // 3. 更新本地状态
    const newMyEmployees = [...myEmployees, employee];
    const updatedEmployees = employees.map((emp) =>
      emp.id === employee.id ? { ...emp, isAdded: true, addedAt: Date.now() } : emp
    );

    set({
      myEmployees: newMyEmployees,
      employees: updatedEmployees,
      isLoading: false,
    });

    return true;
  } catch (error) {
    console.error('Failed to add employee:', error);
    set({ isLoading: false });
    return false;
  }
},
```

- [ ] **Step 3: 提交**

```bash
git add src/stores/employees.ts
git commit -m "feat: addEmployee实现OpenClaw API双写逻辑"
```

---

## Task 6: 修复 AgentSettingsModal 背景色

**Files:**
- Modify: `src/pages/Agents/index.tsx` (AgentSettingsModal 函数组件内)

- [ ] **Step 1: 定位 AgentSettingsModal 组件**

约在 `src/pages/Agents/index.tsx` 第450-611行

- [ ] **Step 2: 找到 Card className 并修改背景色**

```tsx
// 修改前 (约第497行)
<Card className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-3xl border-0 shadow-2xl bg-[#f3f1e9] dark:bg-card overflow-hidden">

// 修改后
<Card className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-3xl border border-border bg-card dark:bg-card overflow-hidden">
```

同时移除 `shadow-2xl` 和硬编码背景色，使用主题变量。

- [ ] **Step 3: 提交**

```bash
git add src/pages/Agents/index.tsx
git commit -m "fix: AgentSettingsModal背景色与主题统一"
```

---

## Task 7: 同步 public/data 到 src/data

**Files:**
- Modify: `src/data/employees/*/*.json`

- [ ] **Step 1: 运行同步命令**

```bash
rm -rf src/data/employees && cp -r public/data/employees src/data/employees
```

- [ ] **Step 2: 提交数据文件**

```bash
git add src/data/employees/
git commit -m "data: 同步员工数据（含vibeZh字段）"
```

---

## Task 8: 验证测试

- [ ] **Step 1: 运行 typecheck**

Run: `pnpm typecheck`
Expected: 无 TypeScript 错误

- [ ] **Step 2: 运行 lint**

Run: `pnpm lint`
Expected: 无 ESLint 错误

- [ ] **Step 3: 运行 dev 模式**

Run: `pnpm dev`
Expected: 应用正常启动，员工卡片显示中文文案和原型头像

- [ ] **Step 4: 测试添加员工流程**

1. 点击员工卡片的"添加员工"按钮
2. 观察步骤进度条动画
3. 添加成功后检查"我的员工"标签页
4. 检查"Agents"标签页是否出现新添加的 Agent

- [ ] **Step 5: 运行 build**

Run: `pnpm build`
Expected: 构建成功

---

## 验证检查清单

- [ ] 员工卡片显示中文 vibe
- [ ] 员工卡片显示中文 description
- [ ] 员工卡片显示彩色原型头像（按部门配色）
- [ ] 添加按钮显示步骤进度条（4步骤，每步300ms）
- [ ] 添加成功后员工出现在"我的员工"
- [ ] 添加成功后员工出现在"Agents"标签页（通过 OpenClaw API）
- [ ] AgentSettingsModal 背景色与主题一致
- [ ] pnpm dev 正常启动
- [ ] pnpm build 构建成功
