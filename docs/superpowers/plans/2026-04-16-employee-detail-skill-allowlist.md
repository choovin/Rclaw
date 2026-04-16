# 员工详情 Sheet 技能白名单展示 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `EmployeeDetail` Sheet 中展示当前员工的技能白名单：白名单缺失或为空时显示「继承主 Agent」说明；非空时按顺序列出条目，本地已安装且启用显示 `Skill.name`，已安装但禁用显示「已禁用」，未匹配到本地技能显示 slug 与「未安装」。

**Architecture:** 新增纯函数 `getEmployeeSkillAllowlistRows(whitelistSlugs, skills)`（`normalizeCommandName` 与 `getChatVisibleSkillsForAgent` 同源），返回每行 `whitelistSlug`、`primaryLabel`、`state: 'installed' | 'installedDisabled' | 'missing'`。`EmployeeDetail` 用 `skillsWhitelist = linkedRow?.skills ?? employee.skills` 与 `useSkillsStore.skills` 计算行并渲染；文案走 `employees` 命名空间 i18n。单元测试覆盖纯函数；Playwright 断言 Sheet 内技能区块（继承或列表二选一可见）。

**Tech Stack:** TypeScript、React、Zustand（`useSkillsStore`）、Vitest、Playwright（Electron E2E）。

---

## 文件结构

| 路径 | 职责 |
|------|------|
| `src/lib/employee-skill-allowlist-rows.ts` | `getEmployeeSkillAllowlistRows`、导出 `EmployeeSkillAllowlistRow` 类型 |
| `tests/unit/employee-skill-allowlist-rows.test.ts` | 表驱动单元测试 |
| `src/pages/Agents/EmployeeDetail.tsx` | 接入 store、渲染技能区块、`data-testid` |
| `src/i18n/locales/{en,zh,ja}/employees.json` | 继承说明、区块标题、未安装、已禁用 |
| `tests/e2e/employee-detail-skill-allowlist.spec.ts`（或扩展现有 `employees-*.spec.ts`） | 打开首张卡片，断言技能区块 |

---

### Task 1: 纯函数 `getEmployeeSkillAllowlistRows`

**Files:**
- Create: `src/lib/employee-skill-allowlist-rows.ts`

- [ ] **Step 1: 实现**

约定：

1. `whitelistSlugs` 为 `null`/`undefined` 时按 **空数组** 处理；本函数**不**区分「继承」——调用方仅在 `whitelistSlugs?.length > 0` 时调用本函数生成列表行。
2. 对 `whitelistSlugs` 中 **每个 slug 按原数组顺序** 输出一行。
3. 对单个 `slug`，令 `key = normalizeCommandName(slug)`，在 `skills ?? []` 中查找 **第一条** 满足 `normalizeCommandName((s.slug ?? s.id) as string) === key` 的 `Skill`。
4. 若未找到：`state = 'missing'`，`primaryLabel = slug`（保留原始字符串便于对照配置）。
5. 若找到且 `skill.enabled`：`state = 'installed'`，`primaryLabel = skill.name`。
6. 若找到且 `!skill.enabled`：`state = 'installedDisabled'`，`primaryLabel = skill.name`。

```typescript
import type { Skill } from '@/types/skill';
import { normalizeCommandName } from '@/pages/Chat/chat-skill-command';

export type EmployeeSkillAllowlistRowState = 'installed' | 'installedDisabled' | 'missing';

export type EmployeeSkillAllowlistRow = {
  whitelistSlug: string;
  primaryLabel: string;
  state: EmployeeSkillAllowlistRowState;
};

export function getEmployeeSkillAllowlistRows(
  whitelistSlugs: string[],
  skills: Skill[] | null | undefined,
): EmployeeSkillAllowlistRow[] {
  const list = skills ?? [];
  const rows: EmployeeSkillAllowlistRow[] = [];

  for (const slug of whitelistSlugs) {
    const key = normalizeCommandName(slug);
    const skill = list.find(
      (s) => normalizeCommandName((s.slug ?? s.id) as string) === key,
    );
    if (!skill) {
      rows.push({ whitelistSlug: slug, primaryLabel: slug, state: 'missing' });
      continue;
    }
    rows.push({
      whitelistSlug: slug,
      primaryLabel: skill.name,
      state: skill.enabled ? 'installed' : 'installedDisabled',
    });
  }

  return rows;
}
```

- [ ] **Step 2: 类型检查**

```bash
pnpm run typecheck
```

预期：无新增错误。

- [ ] **Step 3: 提交**

```bash
git add src/lib/employee-skill-allowlist-rows.ts
git commit -m "feat(agents): 员工技能白名单展示行纯函数"
```

---

### Task 2: 单元测试

**Files:**
- Create: `tests/unit/employee-skill-allowlist-rows.test.ts`

- [ ] **Step 1: Vitest 用例**

覆盖表：

| 场景 | 预期 |
|------|------|
| 单 slug，本地无匹配 | `missing`，`primaryLabel === slug` |
| 单 slug，本地匹配且 `enabled: true` | `installed`，`primaryLabel === skill.name` |
| 匹配且 `enabled: false` | `installedDisabled` |
| slug 与 `skill.slug` 经 `normalizeCommandName` 等价 | 命中（例：`My-Skill` 与 `my_skill` 若规范化后相同则按实现验证） |
| 多个 slug | **顺序与输入数组一致** |
| `skills` 为 `undefined` | 全部 `missing` |

最小 `Skill` 构造与 `tests/unit/chat-visible-skills.test.ts` 风格对齐。

- [ ] **Step 2: 运行**

```bash
pnpm test tests/unit/employee-skill-allowlist-rows.test.ts
```

预期：全部通过。

- [ ] **Step 3: 提交**

```bash
git add tests/unit/employee-skill-allowlist-rows.test.ts
git commit -m "test(agents): 覆盖员工技能白名单行纯函数"
```

---

### Task 3: i18n

**Files:**
- Modify: `src/i18n/locales/en/employees.json`
- Modify: `src/i18n/locales/zh/employees.json`
- Modify: `src/i18n/locales/ja/employees.json`

- [ ] **Step 1: 新增键（示例，实现时可微调英文/日文）**

在 JSON 顶层增加（与现有 `skills` 键区分，避免冲突）：

| Key | zh | en | ja（示例） |
|-----|----|----|------------|
| `skillAllowlistSectionTitle` | 可用技能 | Available skills | （日文译） |
| `skillAllowlistInheritHint` | 继承主 Agent 技能配置 | Inherits main Agent skill settings | （日文译） |
| `skillAllowlistNotInstalled` | 未安装 | Not installed | （日文译） |
| `skillAllowlistDisabled` | 已禁用 | Disabled | （日文译） |

确保 JSON 合法（尾随逗号按各文件惯例）。

- [ ] **Step 2: 提交**

```bash
git add src/i18n/locales/en/employees.json src/i18n/locales/zh/employees.json src/i18n/locales/ja/employees.json
git commit -m "i18n(employees): 员工详情技能白名单文案"
```

---

### Task 4: `EmployeeDetail` UI

**Files:**
- Modify: `src/pages/Agents/EmployeeDetail.tsx`

- [ ] **Step 1: 接入数据与渲染**

1. `import { useSkillsStore } from '@/stores/skills'`（路径以仓库实际为准）。
2. `const skills = useSkillsStore((s) => s.skills);`
3. `const skillsWhitelist = linkedRow?.skills ?? employee.skills;`
4. `const allowlistRows = useMemo(() => { ... }, [skillsWhitelist, skills]);`  
   - 若 `!skillsWhitelist?.length`：`allowlistRows = null`（或不调用纯函数）。  
   - 否则：`allowlistRows = getEmployeeSkillAllowlistRows(skillsWhitelist, skills);`
5. 在「描述」与「员工 ID」之间（或与 spec 一致的区块顺序）插入 **技能区块**：
   - 外层容器：`data-testid="employee-detail-skill-section"`
   - **继承态**（`!skillsWhitelist?.length`）：  
     - `data-testid="employee-detail-skill-inherit"`  
     - 文案 `t('skillAllowlistInheritHint')`  
     - **不**渲染列表标题行（或仅一段说明，与设计一致）
   - **白名单态**：  
     - 标题 `t('skillAllowlistSectionTitle')`  
     - 容器 `data-testid="employee-detail-skill-allowlist"`  
     - 每行：`data-testid="employee-detail-skill-row"`，子元素展示 `primaryLabel`；`state === 'missing'` 时附 `t('skillAllowlistNotInstalled')`（可用 `Badge` 或 `span`）；`state === 'installedDisabled'` 时附 `t('skillAllowlistDisabled')`。

样式与现有 `h4` + `text-[14px]` 区块保持一致（`uppercase` 小标题可选，与「部门」块对齐）。

- [ ] **Step 2: 类型检查与 lint**

```bash
pnpm run typecheck
pnpm run lint
```

- [ ] **Step 3: 提交**

```bash
git add src/pages/Agents/EmployeeDetail.tsx
git commit -m "feat(agents): 员工详情 Sheet 展示技能白名单与继承说明"
```

---

### Task 5: Playwright E2E

**Files:**
- Create: `tests/e2e/employee-detail-skill-allowlist.spec.ts`（若更愿合并到 `employees-create-digital-employee.spec.ts` 亦可，保持单文件职责清晰即可）

- [ ] **Step 1: 用例**

与现有 E2E 一致：跳过 setup、`#/employees`、等待 `employees-page-toolbar`。

1. 在 **数字员工库** tab，等待非空员工卡片（与现有测试相同超时策略）；点击 **第一张** `EmployeeCard`（可用 `locator('.grid').getByRole(...)` 或给 `EmployeeCard` 根节点加 `data-testid` 若尚无——优先复用可见 heading/按钮，避免大范围改 Marketplace）。
2. `await expect(page.getByTestId('employee-detail-sheet')).toBeVisible();`
3. `await expect(page.getByTestId('employee-detail-skill-section')).toBeVisible();`
4. 继承与列表互斥：  
   `await expect(page.getByTestId('employee-detail-skill-inherit').or(page.getByTestId('employee-detail-skill-allowlist'))).toBeVisible();`

若 CI 中 catalog 为空导致无卡片，可 `test.skip` 并注释原因，或 `test.fail` 与产品确认——优先 **等待列表有项** 再点击（与 marketplace 现有加载逻辑一致）。

- [ ] **Step 2: 运行**

```bash
pnpm run test:e2e -- tests/e2e/employee-detail-skill-allowlist.spec.ts
```

（以 `package.json` 中实际 e2e 脚本为准。）

- [ ] **Step 3: 提交**

```bash
git add tests/e2e/employee-detail-skill-allowlist.spec.ts
git commit -m "test(e2e): 员工详情技能区块可见性"
```

---

## Spec 对照自检

| Spec 要求 | 对应任务 |
|-----------|----------|
| 继承态文案 + 不渲染列表 | Task 4，`employee-detail-skill-inherit` |
| 白名单态顺序、名称、未安装、已禁用 | Task 1 + 4 |
| `linkedRow ?? employee` | Task 4 `skillsWhitelist` |
| 单元测试 | Task 2 |
| E2E | Task 5 |
| 不读 OpenClaw 配置 | 仅 `Employee` + `useSkillsStore` |

---

## 执行交接

Plan 已保存至 `docs/superpowers/plans/2026-04-16-employee-detail-skill-allowlist.md`。

**可选执行方式：**

1. **Subagent-Driven（推荐）** — 按任务逐段派生子代理，任务间复核。  
2. **Inline Execution** — 本会话内用 executing-plans 连续实现并设检查点。

你更倾向哪一种？
