# 聊天技能选择器按 Employee.skills 过滤 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在聊天输入区根据当前会话 Agent 与「我的员工」中的 `Employee.skills` 白名单过滤技能弹层与 `/` 联想命令集合；`skills` 缺失或空数组时继承全部（与现有行为一致）。

**Architecture:** 新增纯函数模块 `src/pages/Chat/chat-visible-skills.ts`，实现 `getChatVisibleSkillsForAgent(agentId, skills, myEmployees)`：无关联员工、无白名单或非空白名单前的继承语义 → 返回原始 `skills` 数组；非空白名单 → 仅保留 `enabled` 且 `normalizeCommandName(slug|id)` 落在白名单 `normalizeCommandName` 集合内的条目。`ChatInput.tsx` 用 `useMemo` 依赖 `currentAgentId`、`skills`、`myEmployees` 得到 `chatVisibleSkills`，替换原先传给 `SkillPickerPopover` 的 `skills` 与构建 `slashChipCommandNames` 的数据源。

**Tech Stack:** TypeScript、React、`normalizeCommandName`（`chat-skill-command.ts`）、Vitest。

---

## 文件结构

| 路径 | 职责 |
|------|------|
| `src/pages/Chat/chat-visible-skills.ts` | `getChatVisibleSkillsForAgent` 及类型导入 |
| `tests/unit/chat-visible-skills.test.ts` | 表驱动单元测试 |
| `src/pages/Chat/ChatInput.tsx` | 接入 `chatVisibleSkills`，更新 `useMemo` 依赖 |

---

### Task 1: 纯函数 `getChatVisibleSkillsForAgent`

**Files:**
- Create: `src/pages/Chat/chat-visible-skills.ts`

- [ ] **Step 1: 新增实现文件**

逻辑要点（与 spec `2026-04-16-chat-skill-picker-employee-allowlist-design.md` 一致）：

1. `agentId` 为 `null`、`undefined` 或去空白后为空字符串 → 返回 `skills ?? []`（不拷贝也可，调用方只读使用）。
2. `emp = myEmployees.find((e) => (e.linkedAgentId ?? '').trim() === agentId.trim())`；无 `emp` → 返回 `skills ?? []`。
3. `const raw = emp.skills`；若 `!raw?.length` → 返回 `skills ?? []`（继承全部）。
4. 否则：`allow = new Set(raw.map((s) => normalizeCommandName(s)))`，返回 `(skills ?? []).filter((s) => s.enabled && allow.has(normalizeCommandName((s.slug ?? s.id) as string)))`。

```typescript
import type { Employee } from '@/types/employee';
import type { Skill } from '@/types/skill';
import { normalizeCommandName } from '@/pages/Chat/chat-skill-command';

export function getChatVisibleSkillsForAgent(
  agentId: string | null | undefined,
  skills: Skill[] | null | undefined,
  myEmployees: Employee[],
): Skill[] {
  const list = skills ?? [];
  const aid = (agentId ?? '').trim();
  if (!aid) return list;

  const emp = myEmployees.find((e) => (e.linkedAgentId ?? '').trim() === aid);
  if (!emp) return list;

  const raw = emp.skills;
  if (!raw?.length) return list;

  const allow = new Set(raw.map((s) => normalizeCommandName(s)));
  return list.filter(
    (s) => s.enabled && allow.has(normalizeCommandName((s.slug ?? s.id) as string)),
  );
}
```

- [ ] **Step 2: 运行类型检查**

```bash
pnpm run typecheck
```

预期：无新增错误。

- [ ] **Step 3: 提交**

```bash
git add src/pages/Chat/chat-visible-skills.ts
git commit -m "feat(chat): 按当前 Agent 与 Employee.skills 计算可见技能列表"
```

---

### Task 2: 单元测试

**Files:**
- Create: `tests/unit/chat-visible-skills.test.ts`

- [ ] **Step 1: 编写 Vitest 用例**

使用最小 `Skill` 对象（`id`、`slug`、`enabled`、`name`、`description`）。覆盖：

| 场景 | 预期 |
|------|------|
| `agentId` 为空 | 返回完整列表（含 disabled） |
| 有 `agentId` 但无 `linkedAgentId` 匹配 | 完整列表 |
| `emp.skills` 缺失或 `[]` | 完整列表 |
| `skills` 非空白名单，仅匹配 enabled | 仅白名单内且 `enabled` |
| 白名单中 slug 与技能 `slug` 经 `normalizeCommandName` 一致 | 保留 |

示例骨架：

```typescript
import { describe, expect, it } from 'vitest';
import { getChatVisibleSkillsForAgent } from '@/pages/Chat/chat-visible-skills';
import type { Skill } from '@/types/skill';
import type { Employee } from '@/types/employee';

function sk(p: Partial<Skill> & Pick<Skill, 'id'>): Skill {
  return {
    name: 'n',
    description: 'd',
    enabled: true,
    ...p,
  };
}

describe('getChatVisibleSkillsForAgent', () => {
  const employees: Employee[] = [
    {
      id: 'e1',
      name: 'r',
      nameZh: '中',
      description: '',
      color: '#000',
      emoji: '🙂',
      vibe: 'v',
      department: 'custom',
      linkedAgentId: 'agent-a',
      skills: ['foo-bar', 'baz'],
    },
  ];

  const skills: Skill[] = [
    sk({ id: '1', slug: 'foo-bar', enabled: true }),
    sk({ id: '2', slug: 'other', enabled: true }),
    sk({ id: '3', slug: 'baz', enabled: false }),
  ];

  it('returns full list when agentId empty', () => {
    expect(getChatVisibleSkillsForAgent('', skills, employees).length).toBe(3);
  });

  it('returns full list when no employee linked', () => {
    expect(getChatVisibleSkillsForAgent('unknown', skills, []).length).toBe(3);
  });

  it('returns full list when skills whitelist empty', () => {
    const empEmpty: Employee[] = [{ ...employees[0]!, skills: [] }];
    expect(getChatVisibleSkillsForAgent('agent-a', skills, empEmpty).length).toBe(3);
  });

  it('filters to enabled whitelist matches only', () => {
    const out = getChatVisibleSkillsForAgent('agent-a', skills, employees);
    expect(out.map((s) => s.slug)).toEqual(['foo-bar']);
  });
});
```

按实际需要补全 `Employee` 必填字段（与 `employees` 测试数据一致）。

- [ ] **Step 2: 运行测试**

```bash
pnpm exec vitest run tests/unit/chat-visible-skills.test.ts
```

预期：全部通过。

- [ ] **Step 3: 提交**

```bash
git add tests/unit/chat-visible-skills.test.ts
git commit -m "test(chat): getChatVisibleSkillsForAgent 白名单与继承语义"
```

---

### Task 3: `ChatInput` 接入

**Files:**
- Modify: `src/pages/Chat/ChatInput.tsx`

- [ ] **Step 1: 导入并计算 `chatVisibleSkills`**

在 `skills` 与 `myEmployees` 之后增加：

```typescript
import { getChatVisibleSkillsForAgent } from '@/pages/Chat/chat-visible-skills';

const chatVisibleSkills = useMemo(
  () => getChatVisibleSkillsForAgent(currentAgentId, skills, myEmployees),
  [currentAgentId, skills, myEmployees],
);
```

- [ ] **Step 2: 将 `slashChipCommandNames` 的数据源从 `skills` 改为 `chatVisibleSkills`**

```typescript
const slashChipCommandNames = useMemo(() => {
  const set = new Set<string>();
  for (const s of chatVisibleSkills ?? []) {
    if (!s.enabled) continue;
    set.add(normalizeCommandName((s.slug ?? s.id) as string));
  }
  return set;
}, [chatVisibleSkills]);
```

（白名单分支下 `getChatVisibleSkillsForAgent` 已只含 `enabled`，`continue` 仍无害。）

- [ ] **Step 3: `SkillPickerPopover` 的 `skills={skills}` 改为 `skills={chatVisibleSkills}`**

- [ ] **Step 4: 运行类型检查与相关单测**

```bash
pnpm run typecheck
pnpm exec vitest run tests/unit/chat-visible-skills.test.ts tests/unit/chat-input-slash-picker-strip-guard.test.ts tests/unit/chat-skill-command.test.ts
```

预期：通过。

- [ ] **Step 5: 提交**

```bash
git add src/pages/Chat/ChatInput.tsx
git commit -m "feat(chat): 技能弹层与 slash 联想按员工技能白名单过滤"
```

---

### Task 4: Lint 与回归单测

- [ ] **Step 1: Lint**

```bash
pnpm run lint
```

- [ ] **Step 2: 全量单元测试（或至少 `pnpm test`）**

```bash
pnpm test
```

预期：通过。

- [ ] **Step 3: 提交（若有自动修复产生 diff）**

仅在有变更时执行 `git add` / `git commit`。

---

### Task 5: E2E（可选）

Spec 称「若对外可见文案或关键交互变化」再补 Playwright。本实现若不新增用户可见文案，可 **跳过**；若产品为「白名单下无可选技能」增加专用 copy，则新增/更新 `e2e` 中与聊天技能选择器相关的 spec。

---

## 计划自检（writing-plans Self-Review）

| Spec 条款 | 对应任务 |
|-----------|----------|
| 弹层与 `/` 同源 | Task 3：`chatVisibleSkills` 同时用于 Popover 与 `slashChipCommandNames` |
| 非员工 / 无白名单 / 空数组 → 继承 | Task 1：`getChatVisibleSkillsForAgent` 早退返回完整 `list` |
| 非空白名单 + `normalizeCommandName` | Task 1 + Task 2 |
| 不读 OpenClaw 文件 | 仅使用 `myEmployees` 与 `skills` store |

**占位符：** 无 TBD。

**类型：** `Employee`、`Skill` 与现有类型一致。

---

**Plan complete and saved to `docs/superpowers/plans/2026-04-16-chat-skill-picker-employee-allowlist.md`. Two execution options:**

1. **Subagent-Driven（推荐）** — 每个任务派生子代理，任务间评审，迭代快  
2. **Inline Execution** — 本会话按 `executing-plans` 批量执行并设检查点  

**Which approach?**

若你确认 spec 无需修改，可直接按本计划实现；实现前请再快速浏览 `docs/superpowers/specs/2026-04-16-chat-skill-picker-employee-allowlist-design.md`。
