# 创建数字员工时配置可用技能（白名单）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `CreateDigitalEmployeeDialog` 中增加「可用技能」区块：无关键词时列出本地已安装技能；有关键词时合并 Skillhub 分页搜索结果与本地子串匹配结果，标出已安装/未安装；已选 slug 写入 `Employee.skills` 并由既有 `addEmployee` → `POST /api/employees/provision` → `ensureSlugsViaClawHub` 完成安装与白名单（**不改** Main provision 逻辑）。

**Architecture:** 抽 **纯函数模块**（`src/lib/create-employee-skill-options.ts`）负责本地过滤、Hub 与本地合并、slug 去重与「仅本地补漏」行；对话框内用 **组件级 state** 管理搜索词、防抖、`fetchSkillhubPage` 分页与加载态，**禁止**调用 `useSkillhubListStore`。UI 采用与 `SkillPickerPopover` 类似的 **输入框 + 下拉列表**（Popover 或固定面板），已选 slug 用 **Badge/chip** 展示。`useSkillsStore.fetchSkills` 在对话框 `useEffect` 挂载时触发一次。

**Tech Stack:** React 19、Zustand（`useSkillsStore`）、`hostApiFetch` 封装之 `fetchSkillhubPage`（`src/lib/skillhub-api.ts`）、`Skill` / `SkillhubListItem` 类型、Vitest、Playwright、i18n（`employees` 命名空间）。

**权威设计：** `docs/superpowers/specs/2026-04-16-create-digital-employee-skill-allowlist-design.md`

---

## 文件结构（创建 / 修改一览）

| 路径 | 职责 |
|------|------|
| `src/lib/create-employee-skill-options.ts`（新建） | `skillSlugKey`、`filterLocalSkillsForPicker`、`mergeSkillhubRowsWithLocal`、`type CreateEmployeeSkillOptionRow` |
| `tests/unit/create-employee-skill-options.test.ts`（新建） | 合并、去重、补漏、已安装标记的表驱动单测 |
| `src/pages/Agents/CreateEmployeeSkillField.tsx`（新建，可选；若行数 &lt;120 可内联进对话框） | 搜索框、下拉列表、加载更多、chip 列表、调用纯函数组装展示行 |
| `src/pages/Agents/CreateDigitalEmployeeDialog.tsx` | `useState<string[]>` 已选 slug、`useEffect` 调 `fetchSkills`、提交时 `skills: selectedSlugs.length ? selectedSlugs : undefined`、嵌入技能区块 |
| `src/i18n/locales/en/employees.json` 等 | 区块标题、占位、空态、已安装/未安装、仅本地分组标题 |
| `tests/unit/create-digital-employee-dialog.test.tsx` | Mock `useSkillsStore`；断言无选技能时不传 `skills`；有选时 `employee.skills` 为 slug 数组 |
| `tests/e2e/employees-create-digital-employee.spec.ts` | 断言新 `data-testid` 可见；无选技能路径仍成功关闭对话框（与现有一致） |

**不改：** `electron/api/routes/agents.ts`、`electron/utils/agent-skill-allowlist.ts`（已满足 spec）。

---

### Task 1: 纯函数 `create-employee-skill-options` + 单元测试

**Files:**
- Create: `src/lib/create-employee-skill-options.ts`
- Create: `tests/unit/create-employee-skill-options.test.ts`

**约定：**

- **slug 展示与存储**：统一用 Skillhub / `Skill` 上的 **原始 slug 字符串**（trim）；比较「是否已安装」时对 key 使用 **`normalizeCommandName(slug)`**（与 `src/pages/Chat/chat-skill-command.ts` 及员工白名单一致），本地 `Skill` 用 `normalizeCommandName(s.slug ?? s.id)` 建 `Set`。
- **`CreateEmployeeSkillOptionRow`** 字段建议：`slug: string`（提交用）、`title: string`（展示名）、`installed: boolean`、`section: 'hub' | 'local-only'`（用于分组样式）。

- [ ] **Step 1.1：实现 `filterLocalSkillsForPicker(skills: Skill[], queryTrimmed: string): Skill[]`**

- `queryTrimmed === ''`：返回 `skills` 的浅拷贝（调用方可先 `filter(s => s.enabled)` 若产品要求仅可选启用项；**设计未强制**，默认 **不过滤 enabled**，与「无关键词列出本地已安装」一致；若与聊天体验冲突，实现时仅展示 `enabled === true`，并在计划中注明）。
- `queryTrimmed !== ''`：`q = queryTrimmed.toLowerCase()`，保留满足 `(s.name||'').toLowerCase().includes(q) || (s.slug??s.id).toLowerCase().includes(q)` 的项（与 `SkillPickerPopover` 过滤风格一致，可不含 description 以降低噪音）。

```typescript
import type { Skill } from '@/types/skill';
import type { SkillhubListItem } from '@/types/skillhub';
import { normalizeCommandName } from '@/pages/Chat/chat-skill-command';

export type CreateEmployeeSkillSection = 'hub' | 'local-only';

export type CreateEmployeeSkillOptionRow = {
  slug: string;
  title: string;
  installed: boolean;
  section: CreateEmployeeSkillSection;
};

export function buildInstalledSlugKeySet(skills: Skill[]): Set<string> {
  const set = new Set<string>();
  for (const s of skills) {
    const raw = (s.slug ?? s.id ?? '').trim();
    if (!raw) continue;
    set.add(normalizeCommandName(raw));
  }
  return set;
}

export function filterLocalSkillsForPicker(skills: Skill[], queryTrimmed: string): Skill[] {
  const q = queryTrimmed.trim();
  if (!q) return [...skills];
  const ql = q.toLowerCase();
  return skills.filter((s) => {
    const slug = (s.slug ?? s.id ?? '').toLowerCase();
    const name = (s.name ?? '').toLowerCase();
    return slug.includes(ql) || name.includes(ql);
  });
}
```

- [ ] **Step 1.2：实现 `mergeSkillhubRowsWithLocal`**

签名：

```typescript
export function mergeSkillhubRowsWithLocal(
  hubItems: SkillhubListItem[],
  localFiltered: Skill[],
  installedKeys: Set<string>,
): CreateEmployeeSkillOptionRow[]
```

行为：

1. `hubSlugs = new Set(hubItems.map((h) => normalizeCommandName(h.slug)))`。
2. **Hub 段**：按 `hubItems` 顺序，每行 `slug: h.slug.trim()`，`title: h.displayName || h.slug`，`installed: installedKeys.has(normalizeCommandName(h.slug))`，`section: 'hub'`。
3. **补漏段**：遍历 `localFiltered`，`k = normalizeCommandName(s.slug ?? s.id)`，若 `!hubSlugs.has(k)` 则推入行：`slug` 用原始 `s.slug ?? s.id`，`title: s.name || slug`，`installed: true`，`section: 'local-only'`（本地行恒为已安装）。

- [ ] **Step 1.3：单元测试 `tests/unit/create-employee-skill-options.test.ts`**

用例至少：

1. `buildInstalledSlugKeySet`：两个 skill 不同 slug → set 大小 2；空 slug 跳过。
2. `mergeSkillhubRowsWithLocal`：Hub 一条 `slug: pdf`，本地也有 `pdf` → 一行 `installed: true`；Hub 有 `foo`，本地另有 `bar` 且 `bar` 不在 Hub → 出现 `local-only` 行。
3. `filterLocalSkillsForPicker('', skills)` 长度等于输入；query `'pdf'` 只保留匹配项。

运行：

```bash
pnpm test tests/unit/create-employee-skill-options.test.ts
```

预期：全部 PASS。

- [ ] **Step 1.4：提交**

```bash
git add src/lib/create-employee-skill-options.ts tests/unit/create-employee-skill-options.test.ts
git commit -m "feat: 创建员工技能选择合并逻辑与单测"
```

---

### Task 2: `CreateEmployeeSkillField` 与对话框集成

**Files:**
- Create: `src/pages/Agents/CreateEmployeeSkillField.tsx`
- Modify: `src/pages/Agents/CreateDigitalEmployeeDialog.tsx`

- [ ] **Step 2.1：`CreateEmployeeSkillField` props**

```typescript
export type CreateEmployeeSkillFieldProps = {
  selectedSlugs: string[];
  onSelectedSlugsChange: (slugs: string[]) => void;
};
```

内部：

- `useSkillsStore(s => s.skills)`、`fetchSkills`、`loading`。
- `useEffect(() => { void fetchSkills(); }, [fetchSkills])`。
- 本地 state：`searchInput: string`、`debouncedQuery: string`（`useDeferredValue` 或 `400ms` `useEffect` 同步，与 `src/stores/skillhub-list.ts` 的 `SEARCH_DEBOUNCE_MS` 对齐可取常量 **400**）。
- **无关键词**：`rows = mergeSkillhubRowsWithLocal([], filterLocalSkillsForPicker(skills, ''), buildInstalledSlugKeySet(skills))` → 实际仅需 **map 本地为 `local-only` 行**（更简单：无关键词分支直接 `localFiltered.map` 成 row，`installed: true`）；避免对空 Hub 调合并时补漏逻辑重复——实现可在无关键词路径 **不走 Hub**，仅渲染本地列表。
- **有关键词**：`debouncedQuery.trim()` 非空时 `useEffect` 调 `fetchSkillhubPage(q, 1)`，累积 `hubAccum`；`loading` / `error` state；「加载更多」按钮：`nextPage`，直到 `hubAccum.length >= total`。
- 合并：`mergeSkillhubRowsWithLocal(hubAccum, filterLocalSkillsForPicker(skills, debouncedQuery), buildInstalledSlugKeySet(skills))`。
- Skillhub **失败**：`toast.error` 或行内 `error` 文案，仍展示本地 `filterLocalSkillsForPicker` 结果（**降级**，符合设计）。

- [ ] **Step 2.2：`CreateDigitalEmployeeDialog`**

- `const [skillSlugs, setSkillSlugs] = useState<string[]>([])`。
- 在表单中（建议在「一句话描述」与 SOUL 之间）插入 `<CreateEmployeeSkillField selectedSlugs={skillSlugs} onSelectedSlugsChange={setSkillSlugs} />`。
- `handleSubmit` 中：

```typescript
const employee: Employee = {
  // ...existing
  ...(skillSlugs.length > 0 ? { skills: skillSlugs } : {}),
};
```

- `data-testid="create-digital-employee-skills-section"` 包在外层；搜索框 `data-testid="create-digital-employee-skill-search-input"`。

- [ ] **Step 2.3：手动验证**

`pnpm dev`：打开创建员工 → 无关键词见本地列表；输入词见合并列表；选两项 → 提交后检查 Network 或临时 `console.log`（开发期）确认 provision body 含 `skills`（生产代码勿留 log）。

- [ ] **Step 2.4：提交**

```bash
git add src/pages/Agents/CreateEmployeeSkillField.tsx src/pages/Agents/CreateDigitalEmployeeDialog.tsx
git commit -m "feat(ui): 创建数字员工时选择可用技能白名单"
```

---

### Task 3: i18n

**Files:**
- Modify: `src/i18n/locales/en/employees.json`
- Modify: `src/i18n/locales/zh/employees.json`
- Modify: `src/i18n/locales/ja/employees.json` 或 `ja-JP`（与现有一致）

新增键示例（名称可微调）：

- `createDigitalEmployee.skillsLabel`：可用技能（可选）
- `createDigitalEmployee.skillsHint`：不选则该员工可使用全部技能；选择后仅可使用所选技能
- `createDigitalEmployee.skillSearchPlaceholder`：搜索技能商店与已安装…
- `createDigitalEmployee.skillInstalled`：已安装
- `createDigitalEmployee.skillNotInstalled`：未安装
- `createDigitalEmployee.skillLocalOnly`：仅本地
- `createDigitalEmployee.skillsEmpty`：暂无已安装技能，请前往技能页或输入关键词搜索商店
- `createDigitalEmployee.loadMoreSkills`：加载更多

- [ ] **Step 3.1：运行 `pnpm run lint` 与 `pnpm run typecheck`**

- [ ] **Step 3.2：提交**

```bash
git add src/i18n/locales/**/employees.json
git commit -m "i18n: 创建员工技能选择文案"
```

---

### Task 4: 更新单元测试 `create-digital-employee-dialog.test.tsx`

**Files:**
- Modify: `tests/unit/create-digital-employee-dialog.test.tsx`

- [ ] **Step 4.1：Mock `useSkillsStore`**

```typescript
const fetchSkillsMock = vi.fn();
vi.mock('@/stores/skills', () => ({
  useSkillsStore: (sel: (s: unknown) => unknown) =>
    sel({
      skills: [],
      fetchSkills: fetchSkillsMock,
      loading: false,
    }),
}));
```

若 `CreateEmployeeSkillField` 使用 selector，调整为返回完整 stub。

- [ ] **Step 4.2：扩展用例「未选技能时 payload 无 skills」**

现有用例已隐含；显式 `expect(employee.skills).toBeUndefined()`。

- [ ] **Step 4.3：新用例「选择技能后 payload.skills 为所选」**

需能向 `CreateEmployeeSkillField` 注入已选 slug：更简单做法 —— **导出测试用 data 属性** 或在测试中 **mock `CreateEmployeeSkillField`** 为调用 `onSelectedSlugsChange(['pdf'])` 的占位组件。推荐 **mock 子组件** 避免下拉交互：

```typescript
vi.mock('@/pages/Agents/CreateEmployeeSkillField', () => ({
  CreateEmployeeSkillField: ({ onSelectedSlugsChange }: { onSelectedSlugsChange: (s: string[]) => void }) => {
    React.useEffect(() => {
      onSelectedSlugsChange(['pdf', 'doc']);
    }, [onSelectedSlugsChange]);
    return <div data-testid="create-digital-employee-skills-section" />;
  },
}));
```

提交前确认路径别名与 HMR 一致。

运行：

```bash
pnpm test tests/unit/create-digital-employee-dialog.test.tsx
```

- [ ] **Step 4.4：提交**

```bash
git add tests/unit/create-digital-employee-dialog.test.tsx
git commit -m "test: 创建员工对话框 skills 载荷单测"
```

---

### Task 5: Playwright E2E

**Files:**
- Modify: `tests/e2e/employees-create-digital-employee.spec.ts`

- [ ] **Step 5.1：在第一个成功用例中增加断言**

打开对话框后：

```typescript
await expect(page.getByTestId('create-digital-employee-skills-section')).toBeVisible();
```

不强制选技能，现有提交流程应仍成功（继承全部）。

- [ ] **Step 5.2：运行**

```bash
pnpm run test:e2e -- tests/e2e/employees-create-digital-employee.spec.ts
```

预期：PASS（若环境无显示服务器，按项目 README 执行）。

- [ ] **Step 5.3：提交**

```bash
git add tests/e2e/employees-create-digital-employee.spec.ts
git commit -m "test(e2e): 创建员工对话框展示技能区块"
```

---

## Spec 自检（计划覆盖）

| 设计条款 | 对应任务 |
|----------|----------|
| 未选 = 不传 skills / 继承全部 | Task 2 `employee` 构造 |
| 无关键词 = 仅本地列表 | Task 2 分支 |
| 有关键词 = Hub + 本地合并、补漏、已安装标记 | Task 1 + Task 2 |
| 不污染 `useSkillhubListStore` | Task 2 内部仅 `fetchSkillhubPage` |
| Skillhub 失败降级 | Task 2 错误处理 |
| 单元 + E2E | Task 1、4、5 |

**占位符扫描：** 无 TBD；`enabled` 过滤若实现时采用，在 Task 2 提交说明中写清。

---

**Plan complete and saved to `docs/superpowers/plans/2026-04-16-create-digital-employee-skill-allowlist.md`. Two execution options:**

1. **Subagent-Driven（推荐）** — 每任务派生子代理执行，任务间人工复核，迭代快  
2. **Inline Execution** — 本会话用 executing-plans 按检查点批量执行  

**你更倾向哪一种？**
