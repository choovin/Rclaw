# 创建数字员工 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 替换 `Agents` 页顶部“创建员工”入口为“创建数字员工”，让用户仅输入 `员工名称/vibe/soulContent/agentsContent/emoji/color` 后自动 provision 成 OpenClaw agent，并像“添加到我的员工”一样进入“我的员工”列表。

**Architecture:** 新弹窗 UI 直接复用现有 `useEmployeesStore.addEmployee -> POST /api/employees/provision` 的 HTTP 契约；后端在 `/api/employees/provision` 对必填字段做 `trim()` 后的非空校验，确保全空白输入不会写出 SOUL/AGENTS 并通过 verify。

**Tech Stack:** React (Vite, TS), Zustand stores, Electron Host API (`hostApiFetch`), Node route validation, Vitest + React Testing Library, Playwright E2E。

---

## Task 1: 支持 `department=custom`（类型 + i18n + 渲染可用）

**Files:**
- Create: `tests/unit/employees-department-custom.test.ts`
- Modify: `src/types/employee.ts`
- Modify: `src/i18n/locales/zh/employees.json`
- Modify: `src/i18n/locales/en/employees.json`
- Modify: `src/i18n/locales/ja/employees.json`

### Step 1: Write the failing test
```ts
// tests/unit/employees-department-custom.test.ts
import { describe, expect, it } from 'vitest';
import { getAllDepartments } from '@/stores/employees';

describe('employees departments', () => {
  it('includes custom department', () => {
    const all = getAllDepartments();
    expect(all.some((d) => d.id === 'custom')).toBe(true);
  });
});
```

### Step 2: Run test to verify it fails
Run: `pnpm test tests/unit/employees-department-custom.test.ts -v`

Expected: FAIL (因为当前 `Department` 枚举/DEPARTMENT_MAP 没有 `custom`)

### Step 3: Write minimal implementation
1) 修改 `src/types/employee.ts`：把 `custom` 加入 `Department` union，并在 `DEPARTMENT_MAP` 补齐。

在 `Department` 类型中加入 `'custom'`，并在 `DEPARTMENT_MAP` 最末追加：
```ts
  custom: {
    id: 'custom',
    name: 'Custom',
    nameZh: '自定义',
    emoji: '⭐',
    description: 'User-defined / custom department',
  },
```

2) 修改 `src/i18n/locales/zh/employees.json`：在根 `departments` 对象下加入：
```json
    "custom": "自定义"
```

3) 修改 `src/i18n/locales/en/employees.json`：如果文件当前没有 `departments` 对象，则追加 `departments` 对象（至少包含 `custom`）：
```json
  "departments": {
    "custom": "Custom"
  }
```

4) 修改 `src/i18n/locales/ja/employees.json`：同上，加入：
```json
  "departments": {
    "custom": "カスタム"
  }
```

### Step 4: Run the tests and make sure they pass
Run: `pnpm test tests/unit/employees-department-custom.test.ts -v`

Expected: PASS

### Step 5: Commit
Run:
```bash
git add src/types/employee.ts src/i18n/locales/zh/employees.json src/i18n/locales/en/employees.json src/i18n/locales/ja/employees.json tests/unit/employees-department-custom.test.ts
git commit -m "$(cat <<'EOF'
feat: 支持自定义部门 department=custom

为“创建数字员工”新增的 custom 部门补齐类型、部门映射与 en/ja/zh 文案，避免部门渲染/筛选缺失
EOF
)"
```

---

## Task 2: 新增“创建数字员工”弹窗组件（表单 + 构造 Employee + 调用 addEmployee）

**Files:**
- Create: `src/pages/Agents/CreateDigitalEmployeeDialog.tsx`
- Modify: `src/pages/Agents/index.tsx`

### Step 1: Write the failing test
```ts
// tests/unit/create-digital-employee-dialog.test.tsx
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CreateDigitalEmployeeDialog } from '@/pages/Agents/CreateDigitalEmployeeDialog';

const addEmployeeMock = vi.fn().mockResolvedValue(true);

vi.mock('@/stores/employees', () => {
  return {
    useEmployeesStore: () => ({
      addEmployee: addEmployeeMock,
    }),
  };
});

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe('CreateDigitalEmployeeDialog', () => {
  it('constructs Employee payload and calls addEmployee on submit', async () => {
    // Make uuid deterministic
    const uuidSpy = vi.fn(() => 'uuid-test-123');
    // @ts-expect-error - vitest env
    globalThis.crypto = { randomUUID: uuidSpy };

    render(<CreateDigitalEmployeeDialog onClose={() => {}} />);

    fireEvent.change(screen.getByTestId('create-digital-employee-name-input'), {
      target: { value: '人类学家' },
    });
    fireEvent.change(screen.getByTestId('create-digital-employee-vibe-textarea'), {
      target: { value: '一句话 vibe' },
    });
    fireEvent.change(screen.getByTestId('create-digital-employee-soul-textarea'), {
      target: { value: '## soul' },
    });
    fireEvent.change(screen.getByTestId('create-digital-employee-agents-textarea'), {
      target: { value: '## agents' },
    });
    fireEvent.change(screen.getByTestId('create-digital-employee-emoji-select'), {
      target: { value: '🌍' },
    });
    fireEvent.change(screen.getByTestId('create-digital-employee-color-input'), {
      target: { value: '#D97706' },
    });

    fireEvent.click(screen.getByTestId('create-digital-employee-submit-button'));

    await waitFor(() => expect(addEmployeeMock).toHaveBeenCalledTimes(1));
    const [employee] = addEmployeeMock.mock.calls[0];
    expect(employee.id).toBe('uuid-test-123');
    expect(employee.nameZh).toBe('人类学家');
    expect(employee.name).toBe('人类学家');
    expect(employee.department).toBe('custom');
    expect(employee.vibe).toBe('一句话 vibe');
    expect(employee.identityContent).toBe('一句话 vibe');
    expect(employee.description).toBe('一句话 vibe');
    expect(employee.soulContent).toBe('## soul');
    expect(employee.agentsContent).toBe('## agents');
  });
});
```

### Step 2: Run test to verify it fails
Run: `pnpm test tests/unit/create-digital-employee-dialog.test.tsx -v`

Expected: FAIL (因为 `CreateDigitalEmployeeDialog`/test ids 不存在）

### Step 3: Write minimal implementation

1) 创建 `src/pages/Agents/CreateDigitalEmployeeDialog.tsx`（完整文件示例）
```tsx
import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useEmployeesStore } from '@/stores/employees';
import type { Employee } from '@/types/employee';
import type { Department } from '@/types/employee';

const EMOJI_OPTIONS = ['🌍', '🧠', '📚', '🗺️', '🎓', '🧪', '⭐', '🎨', '🎮', '💻', '🧬', '🤖'] as const;
const DEFAULT_COLOR = '#D97706';
const DEFAULT_DEPARTMENT: Department = 'custom';

function makeUuid(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
  return `uuid_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

export function CreateDigitalEmployeeDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation('employees');
  const { addEmployee } = useEmployeesStore();

  const [nameZh, setNameZh] = useState('');
  const [vibe, setVibe] = useState('');
  const [soulContent, setSoulContent] = useState('');
  const [agentsContent, setAgentsContent] = useState('');
  const [emoji, setEmoji] = useState<(typeof EMOJI_OPTIONS)[number]>('🌍');
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [saving, setSaving] = useState(false);

  const isValid = useMemo(() => {
    return (
      nameZh.trim().length > 0 &&
      vibe.trim().length > 0 &&
      soulContent.trim().length > 0 &&
      agentsContent.trim().length > 0 &&
      color.trim().length > 0 &&
      Boolean(emoji)
    );
  }, [nameZh, vibe, soulContent, agentsContent, color, emoji]);

  const handleSubmit = async () => {
    if (saving) return;
    if (!isValid) {
      toast.error('请填写所有必填项（并确保非空白）');
      return;
    }

    setSaving(true);
    try {
      const vibeTrimmed = vibe.trim();
      const employee: Employee = {
        id: makeUuid(),
        nameZh: nameZh.trim(),
        name: nameZh.trim(),
        department: DEFAULT_DEPARTMENT,
        color,
        emoji,
        vibe: vibeTrimmed,
        vibeZh: vibeTrimmed,
        soulContent,
        agentsContent,
        identityContent: vibeTrimmed,
        description: vibeTrimmed,
        descriptionZh: vibeTrimmed,
      };

      const ok = await addEmployee(employee);
      if (!ok) {
        toast.error(t('addFailed'));
        return;
      }

      toast.success(t('addSuccess'));
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const modal = (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" data-testid="create-digital-employee-dialog">
      <Card className="w-full max-w-md rounded-3xl border-0 shadow-2xl bg-[#f3f1e9] dark:bg-card overflow-hidden">
        <CardHeader className="pb-2 relative">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-2xl font-serif font-normal tracking-tight">创建数字员工</CardTitle>
              <CardDescription className="text-[15px] mt-1 text-foreground/70">只需填写关键信息即可创建并自动加入我的员工</CardDescription>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              disabled={saving}
              className="rounded-full h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-5 pt-4 p-6">
          <div className="space-y-2.5">
            <Label htmlFor="ded-name" className="text-[14px] text-foreground/80 font-bold">
              员工名称*
            </Label>
            <Input
              id="ded-name"
              data-testid="create-digital-employee-name-input"
              value={nameZh}
              onChange={(e) => setNameZh(e.target.value)}
              placeholder="给你的数字员工起个名字"
              className="h-[44px] rounded-xl font-mono text-[13px] bg-[#eeece3] dark:bg-muted border-black/10 dark:border-white/10 focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:border-blue-500 shadow-sm transition-all text-foreground placeholder:text-foreground/40"
            />
          </div>

          <div className="space-y-2.5">
            <Label htmlFor="ded-vibe" className="text-[14px] text-foreground/80 font-bold">
              vibe（一句话简述）*
            </Label>
            <Textarea
              id="ded-vibe"
              data-testid="create-digital-employee-vibe-textarea"
              value={vibe}
              onChange={(e) => setVibe(e.target.value)}
              className="min-h-[90px] rounded-xl font-mono text-[13px] bg-[#eeece3] dark:bg-muted border-black/10 dark:border-white/10 focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:border-blue-500 shadow-sm transition-all text-foreground placeholder:text-foreground/40"
              placeholder="一句话概括这个员工的核心气质"
            />
          </div>

          <div className="space-y-2.5">
            <Label htmlFor="ded-soul" className="text-[14px] text-foreground/80 font-bold">
              角色定位与策略*
            </Label>
            <Textarea
              id="ded-soul"
              data-testid="create-digital-employee-soul-textarea"
              value={soulContent}
              onChange={(e) => setSoulContent(e.target.value)}
              className="min-h-[120px] rounded-xl font-mono text-[13px] bg-[#eeece3] dark:bg-muted border-black/10 dark:border-white/10 focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:border-blue-500 shadow-sm transition-all text-foreground placeholder:text-foreground/40"
              placeholder="按 academic.json 的 soulContent 格式填写（可包含 ## 标题）"
            />
          </div>

          <div className="space-y-2.5">
            <Label htmlFor="ded-agents" className="text-[14px] text-foreground/80 font-bold">
              智能体的工作内容*
            </Label>
            <Textarea
              id="ded-agents"
              data-testid="create-digital-employee-agents-textarea"
              value={agentsContent}
              onChange={(e) => setAgentsContent(e.target.value)}
              className="min-h-[120px] rounded-xl font-mono text-[13px] bg-[#eeece3] dark:bg-muted border-black/10 dark:border-white/10 focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:border-blue-500 shadow-sm transition-all text-foreground placeholder:text-foreground/40"
              placeholder="按 academic.json 的 agentsContent 格式填写"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2.5">
              <Label htmlFor="ded-emoji" className="text-[14px] text-foreground/80 font-bold">
                选择图标 emoji*
              </Label>
              <select
                id="ded-emoji"
                data-testid="create-digital-employee-emoji-select"
                value={emoji}
                onChange={(e) => setEmoji(e.target.value as (typeof EMOJI_OPTIONS)[number])}
                className="h-[44px] w-full rounded-xl font-mono text-[13px] bg-white dark:bg-black/80 border border-black/10 dark:border-white/10 focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:border-blue-500 shadow-sm transition-all text-foreground px-3"
              >
                {EMOJI_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2.5">
              <Label htmlFor="ded-color" className="text-[14px] text-foreground/80 font-bold">
                color*
              </Label>
              <input
                id="ded-color"
                data-testid="create-digital-employee-color-input"
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-[44px] w-full rounded-xl bg-transparent"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              data-testid="create-digital-employee-cancel-button"
              onClick={onClose}
              disabled={saving}
              className="h-9 text-[13px] font-medium rounded-full px-4 border-black/10 dark:border-white/10 bg-transparent hover:bg-black/5 dark:hover:bg-white/5 shadow-none text-foreground/80 hover:text-foreground"
            >
              {t('common:actions.cancel')}
            </Button>
            <Button
              data-testid="create-digital-employee-submit-button"
              onClick={() => void handleSubmit()}
              disabled={!isValid || saving}
              className="h-9 text-[13px] font-medium rounded-full px-4 shadow-none"
            >
              {saving ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  创建中...
                </>
              ) : (
                '创建'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  if (typeof document === 'undefined') return modal;
  return createPortal(modal, document.body);
}
```

注意：上面示例里 `选择模型*` 是为了占位复用你截图的结构；实施时把 label 文案改成“选择图标 emoji*”以匹配你的需求。

2) 修改 `src/pages/Agents/index.tsx`
- 把当前的 `AddAgentDialog` 替换为 `CreateDigitalEmployeeDialog`。
- 删除 `useAgentsStore` 的 `createAgent` 依赖，只保留 `fetchAgents`。

实现代码片段（只展示关键替换点）：
```tsx
// 1) import
import { CreateDigitalEmployeeDialog } from './CreateDigitalEmployeeDialog';
import { useEmployeesStore } from '@/stores/employees'; // 如果你在 dialog 内部已用，则 index.tsx 不需要

// 2) in Agents() component: remove createAgent from destructuring
const { agents, error, fetchAgents } = useAgentsStore();

// 3) plus button text / click
<Button
  type="button"
  variant="default"
  onClick={() => setShowAddDialog(true)}
  data-testid="create-digital-employee-button"
  className="h-9 shrink-0 ml-auto rounded-full shadow-none"
>
  <Plus className="h-4 w-4 mr-2" />
  创建数字员工
</Button>

// 4) dialog render
{showAddDialog && (
  <CreateDigitalEmployeeDialog onClose={() => setShowAddDialog(false)} />
)}
```

### Step 4: Run the tests and make sure they pass
Run:
```bash
pnpm test tests/unit/create-digital-employee-dialog.test.tsx -v
pnpm test tests/unit/agents-page.test.tsx -v
```

Expected: PASS

### Step 5: Commit
Run:
```bash
git add src/pages/Agents/index.tsx src/pages/Agents/CreateDigitalEmployeeDialog.tsx tests/unit/create-digital-employee-dialog.test.tsx
git commit -m "$(cat <<'EOF'
feat: 添加创建数字员工弹窗并复用 addEmployee/provision

用户只需填写数字员工核心字段，前端构造 Employee 并通过现有 /api/employees/provision 自动加入我的员工
EOF
)"
```

---

## Task 3: 后端 `/api/employees/provision` 必填字段 trim + 非空校验（reject 全空白）

**Files:**
- Modify: `electron/api/routes/agents.ts`
- (Optional but recommended) Create: `tests/unit/digital-employee-provision-whitespace-validation.test.ts`

### Step 1: Write the failing test
```ts
// tests/unit/digital-employee-provision-whitespace-validation.test.ts
import { describe, expect, it } from 'vitest';
import { provisionDigitalEmployeeAgent } from '@electron/utils/agent-config';

describe('digital employee provision validation', () => {
  it('rejects whitespace-only soulContent', async () => {
    await expect(
      provisionDigitalEmployeeAgent({
        nameZh: '人类学家',
        nameEn: 'Anthropologist',
        soulContent: '   ',
        agentsContent: '## agents',
        identityContent: 'vibe',
        emoji: '🌍',
        vibe: 'vibe',
      }),
    ).rejects.toThrow(/soulContent/i);
  });
});
```

### Step 2: Run test to verify it fails
Run: `pnpm test tests/unit/digital-employee-provision-whitespace-validation.test.ts -v`

Expected: FAIL (当前实现对 soulContent 没有 trim 非空校验)

### Step 3: Write minimal implementation

1) 在 `electron/api/routes/agents.ts` 的 `POST /api/employees/provision` 分支中新增必填字段校验：

在 `const body = await parseJsonBody<...>(req);` 后，替换现有仅校验 `nameZh` 的逻辑为：
```ts
const mustTrimNonEmpty = (value: unknown, fieldName: string): string => {
  if (typeof value !== 'string') throw new Error(`${fieldName} must be a string`);
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${fieldName} must be non-empty (trimmed)`);
  return trimmed;
};

// validate
const employeeId = mustTrimNonEmpty(body.employeeId, 'employeeId');
const nameZh = mustTrimNonEmpty(body.nameZh, 'nameZh');
const nameEn = mustTrimNonEmpty(body.nameEn, 'nameEn');

// keep raw markdown content to preserve formatting; only validate by trimmed non-empty
if (typeof body.soulContent !== 'string') throw new Error('soulContent must be a string');
if (!body.soulContent.trim()) throw new Error('soulContent must be non-empty (trimmed)');
const soulContent = body.soulContent;

if (typeof body.agentsContent !== 'string') throw new Error('agentsContent must be a string');
if (!body.agentsContent.trim()) throw new Error('agentsContent must be non-empty (trimmed)');
const agentsContent = body.agentsContent;

// vibe is required for this dialog flow
const vibe = mustTrimNonEmpty(body.vibe, 'vibe');

// identityContent can be optional because existing data may omit it,
// but when present it must be a string; trim must be non-empty if it was provided.
const identityContent =
  typeof body.identityContent === 'string' ? body.identityContent : '';

if (typeof body.emoji !== 'string') {
  // allow missing emoji, but keep type correctness
}
```

然后用以上校验后的变量替换 provisionDigitalEmployeeAgent payload：
```ts
const result = await provisionDigitalEmployeeAgent(
  {
    nameZh,
    nameEn,
    soulContent,
    agentsContent,
    identityContent,
    emoji: typeof body.emoji === 'string' ? body.emoji : undefined,
    vibe,
  },
  ...
);
```

并在 catch 中返回 400/500：
```ts
sendJson(res, 400, { success: false, error: String(error) });
```

2) 为了让单测更稳定（不依赖 route 层），也在 `electron/utils/agent-config.ts` 的 `provisionDigitalEmployeeAgent` 一开始做同样 trim 非空校验（同一组字段）；一旦校验失败直接 throw。

在函数开头加入如下代码（示例）：
```ts
  const nameZhTrimmed = payload.nameZh.trim();
  if (!nameZhTrimmed) throw new Error('nameZh must be non-empty (trimmed)');

  const nameEnTrimmed = payload.nameEn.trim();
  if (!nameEnTrimmed) throw new Error('nameEn must be non-empty (trimmed)');

  if (!payload.soulContent.trim()) throw new Error('soulContent must be non-empty (trimmed)');
  if (!payload.agentsContent.trim()) throw new Error('agentsContent must be non-empty (trimmed)');
  if (!payload.vibe?.trim()) throw new Error('vibe must be non-empty (trimmed)');
```

### Step 4: Run the tests and make sure they pass
Run: `pnpm test tests/unit/digital-employee-provision-whitespace-validation.test.ts -v`

Expected: PASS

### Step 5: Commit
Run:
```bash
git add electron/api/routes/agents.ts electron/utils/agent-config.ts tests/unit/digital-employee-provision-whitespace-validation.test.ts
git commit -m "$(cat <<'EOF'
fix: provisionDigitalEmployeeAgent/revision 拒绝全空白必填字段

对 /api/employees/provision 的 soulContent/agentsContent/vibe 等字段做 trim 非空校验，避免写入仅空白的 SOUL/AGENTS 并误通过 verify
EOF
)"
```

---

## Task 4: Playwright E2E 覆盖“创建数字员工 -> 我的员工出现”

**Files:**
- Create: `tests/e2e/employees-create-digital-employee.spec.ts`

### Step 1: Write the failing test
```ts
// tests/e2e/employees-create-digital-employee.spec.ts
import { expect, test } from './fixtures/electron';

test.describe('Digital employee creation', () => {
  test('creates a digital employee via modal and appears in My Employees', async ({ page }) => {
    // Setup wizard should be visible for isolated profiles
    const setupSkip = page.getByTestId('setup-skip-button');
    if (await setupSkip.isVisible().catch(() => false)) {
      await setupSkip.click();
    }
    await expect(page.getByTestId('main-layout')).toBeVisible();

    const raw = page.url();
    const base = raw.includes('#') ? raw.slice(0, raw.indexOf('#')) : raw;
    await page.goto(`${base}#/employees`);
    await expect(page.getByTestId('employees-page-toolbar')).toBeVisible();

    await page.getByTestId('create-digital-employee-button').click();
    await expect(page.getByTestId('create-digital-employee-dialog')).toBeVisible();

    const nameZh = '测试人类学家';
    await page.getByTestId('create-digital-employee-name-input').fill(nameZh);
    await page.getByTestId('create-digital-employee-vibe-textarea').fill('一句话 vibe');
    await page.getByTestId('create-digital-employee-soul-textarea').fill('## soul');
    await page.getByTestId('create-digital-employee-agents-textarea').fill('## agents');
    await page.getByTestId('create-digital-employee-emoji-select').selectOption('🌍');
    await page.getByTestId('create-digital-employee-color-input').fill('#D97706');

    await page.getByTestId('create-digital-employee-submit-button').click();

    // Modal closes + employee appears
    await expect(page.getByText(nameZh)).toBeVisible();
  });
});
```

### Step 2: Run test to verify it fails
Run: `pnpm run test:e2e -- --reporter=line tests/e2e/employees-create-digital-employee.spec.ts`

Expected: FAIL (因为尚未实现 UI/后端校验/自定义部门)

### Step 3: Write minimal implementation
- 依赖前面 Tasks 1-3 的实现。
- 确保对话框与按钮/表单都带上本测试使用的 `data-testid`。

### Step 4: Run the tests and make sure they pass
Run: `pnpm run test:e2e -- --reporter=line tests/e2e/employees-create-digital-employee.spec.ts`

Expected: PASS

### Step 5: Commit
Run:
```bash
git add tests/e2e/employees-create-digital-employee.spec.ts
git commit -m "$(cat <<'EOF'
test(e2e): 覆盖创建数字员工并出现在我的员工

通过 Playwright 验证从弹窗填写到 myEmployees 列表出现的端到端链路
EOF
)"
```

---

## Task 5: 最终验证（类型检查 + 单测 + Lint）

**Files:** 无

### Step 1: Run typecheck
Run: `pnpm run typecheck`

### Step 2: Run unit tests
Run: `pnpm test`

### Step 3: Run lint
Run: `pnpm run lint`

### Step 4: Run E2E smoke subset
Run: `pnpm run test:e2e -- --reporter=line tests/e2e/app-smoke.spec.ts`

### Step 5: Commit (if needed)
如果 lint/typecheck 产生修改，则按实际文件 git add/commit。

