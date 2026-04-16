# 员工 provision 按 `requiredSkills` 配置技能 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `POST /api/employees/provision` 链路中，根据 Catalog / 前端传入的技能 slug 列表，先按需走 ClawHub 安装，再写入 `~/.openclaw/openclaw.json` 中对应 Agent 的 `agents.list[].skills`；空列表或缺失表示不写入该字段（继承 OpenClaw 默认：见 `agents.defaults.skills` 与官方「省略则继承」规则）。

**Architecture:** 新增 `electron/utils/agent-skill-allowlist.ts`：归一化 slug、检测 `~/.openclaw/skills/<slug>` 是否存在、不存在则调用现有 `ClawHubService.install`（与 IPC `clawhub:install` 同源）、收集成功 slug 后通过 `withConfigLock` 更新 `agents.list` 中目标 `id === agentId` 的条目的 `skills` 字段。渲染进程在 `useEmployeesStore.addEmployee` 的 provision 请求体中附带 `Employee.skills`（来自 `mapCatalogAgentToEmployee` 的 `requiredSkills` 解析结果）。**禁止**使用全局 `skills.entries.*.enabled` 批量开关冒充 per-agent 限制。

**权威配置形状（OpenClaw 文档）：** [Skills Config — Agent skill allowlists](https://docs.openclaw.ai/tools/skills-config)：`agents.list[].skills` 为该 Agent 的**最终**白名单且不合并 `agents.defaults.skills`；省略 `agents.list[].skills` 则继承 `agents.defaults.skills`；全局省略 `agents.defaults.skills` 时为默认无限制。实现时以仓库锁定的 `openclaw` 包版本行为为准。

**Tech Stack:** TypeScript、Node `fs`、`withConfigLock`（`electron/utils/config-mutex.ts`）、`readOpenClawConfig` / `writeOpenClawConfig`（`electron/utils/channel-config.ts`）、`ClawHubService`（`electron/gateway/clawhub.ts`）、Vitest、`hostApiFetch`。

---

## 文件结构（创建 / 修改一览）

| 路径 | 职责 |
|------|------|
| `electron/utils/agent-skill-allowlist.ts`（新建） | `normalizeProvisionSkillSlugs`、`isSkillPresentOnDisk`、`ensureSlugsViaClawHub`、`applyAgentSkillAllowlist`（写入/省略 `agents.list[].skills`） |
| `electron/api/routes/agents.ts` | `POST /api/employees/provision` 解析可选 `skills?: string[]`；`provisionDigitalEmployeeAgent` 成功后调用上述工具 |
| `electron/api/context.ts` | 无需改（已有 `clawHubService`） |
| `src/stores/employees.ts` | `hostApiFetch` body 增加 `skills: payload.skills`（仅当存在且 `length > 0` 时可显式传，或始终传 `undefined`/省略——以实现与类型为准） |
| `tests/unit/agent-skill-allowlist.test.ts`（新建） | 归一化、空输入、`resolved` 为空时不写入（mock 配置读写与 ClawHub） |

---

### Task 1: `agent-skill-allowlist` 工具模块 + 单元测试

**Files:**
- Create: `electron/utils/agent-skill-allowlist.ts`
- Create: `tests/unit/agent-skill-allowlist.test.ts`
- Modify: `vitest.config.ts` 或现有 `tests/unit` 入口（若需 `alias` 指向 `electron/` — 仅当现网测试无法解析路径时再加）

**依赖导入约定：** `readOpenClawConfig` / `writeOpenClawConfig` 从 `electron/utils/channel-config.ts`；`withConfigLock` 从 `electron/utils/config-mutex.ts`；`getOpenClawConfigDir` 或 `join(homedir(), '.openclaw', 'skills')` 从 `electron/utils/paths.ts` / `os`；logger 用 `electron/utils/logger`。

- [ ] **Step 1.1：实现 `normalizeProvisionSkillSlugs(input: unknown): string[]`**

行为：

- `input` 不是数组 → `[]`
- 过滤非字符串、trim、去掉空串、**去重**（保持首次出现顺序）

```typescript
export function normalizeProvisionSkillSlugs(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of input) {
    if (typeof x !== 'string') continue;
    const t = x.trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}
```

- [ ] **Step 1.2：实现 `isSkillPresentOnDisk(slug: string): boolean`**

使用 `join(getOpenClawConfigDir(), 'skills', slug)`（或项目中等价 helper）+ `fs.existsSync` 判断目录存在即可作为「已安装」的一阶启发（与 ClawHub 安装落盘位置一致）。

- [ ] **Step 1.3：实现 `ensureSlugsViaClawHub(slugs: string[], clawHub: ClawHubService, log: { employeeId: string; agentId: string }): Promise<string[]>`**

对每个 `slug` 顺序执行：

1. 若 `isSkillPresentOnDisk(slug)` 为 true → 将 `slug` 加入结果，继续下一个。
2. 否则 `try { await clawHub.install({ slug }); } catch (e) { logger.warn(... slug, error) }`，若 `isSkillPresentOnDisk(slug)` 仍为 false 则**不加入**结果。

返回成功 slug 列表（顺序与输入一致，仅含成功项）。

- [ ] **Step 1.4：实现 `applyAgentSkillAllowlist(agentId: string, slugs: string[] | null): Promise<void>`**

语义：

- `slugs === null` 或 `slugs.length === 0`：**不设置**「继承」——从对应 `agents.list[]` 条目中 **`delete entry.skills`**（若键不存在则 no-op），以匹配「Catalog 空/[] / 全部安装失败 → 继承」且避免误写入 `skills: []`（OpenClaw 中 `skills: []` 表示**无技能**，与本产品「继承全部」不同）。
- `slugs.length > 0`：`entry.skills = slugs`（字符串数组）。

在 `withConfigLock` 内：`readOpenClawConfig()` → 定位 `config.agents.list` 中 `id === agentId` 的项 → 更新 → `writeOpenClawConfig(config)`。找不到 `agentId` 时 `throw new Error`（provision 刚创建应存在）。

类型：`config` 使用 `OpenClawConfig` 或 `Record<string, unknown>` 安全收窄，与 `agent-config.ts` 风格一致。

- [ ] **Step 1.5：单元测试 `tests/unit/agent-skill-allowlist.test.ts`**

使用 `vi.mock` mock `channel-config` 与 `config-mutex`（直接执行回调）、mock `ClawHubService`。

用例至少包括：

1. `normalizeProvisionSkillSlugs([' a ', 'b', 'a'])` → `['a','b']`
2. `applyAgentSkillAllowlist('x', [])`：合并后的 config 中 `list` 里 id `x` 的条目**无** `skills` 键
3. `applyAgentSkillAllowlist('x', ['pdf'])`：条目 `skills` 为 `['pdf']`
4. `ensureSlugsViaClawHub`：磁盘已存在则不调 `install`；不存在则调 `install`，失败则结果中不含该 slug

运行：

```bash
pnpm test tests/unit/agent-skill-allowlist.test.ts
```

预期：全部 PASS。

- [ ] **Step 1.6：提交**

```bash
git add electron/utils/agent-skill-allowlist.ts tests/unit/agent-skill-allowlist.test.ts
git commit -m "feat(electron): 员工 provision 技能 slug 归一化、ClawHub 安装与 agents.list.skills 写入"
```

---

### Task 2: 接入 `POST /api/employees/provision`

**Files:**
- Modify: `electron/api/routes/agents.ts`

- [ ] **Step 2.1：扩展 `parseJsonBody` 类型**

在 `body` 类型中增加可选字段：

```typescript
skills?: string[];
```

- [ ] **Step 2.2：在 `provisionDigitalEmployeeAgent` 成功返回后编排技能策略**

伪代码（放在 `sendJson` 成功之前、与现有 `sync_reload` / `scheduleGatewayReload` 顺序协调——**建议**先完成技能写入再 `scheduleGatewayReload`，以便 Gateway 读到新配置）：

```typescript
import {
  normalizeProvisionSkillSlugs,
  ensureSlugsViaClawHub,
  applyAgentSkillAllowlist,
} from '../../utils/agent-skill-allowlist';

// ... 已有 const result = await provisionDigitalEmployeeAgent(...)

const requested = normalizeProvisionSkillSlugs(body.skills);
if (requested.length === 0) {
  // 继承：不调用 apply（createAgent 新建的 list 条目本就没有 skills 键，避免无意义读写 openclaw.json）
} else {
  const resolved = await ensureSlugsViaClawHub(requested, ctx.clawHubService, {
    employeeId,
    agentId: result.agentId,
  });
  if (resolved.length > 0) {
    await applyAgentSkillAllowlist(result.agentId, resolved);
  } else {
    await applyAgentSkillAllowlist(result.agentId, null);
    logger.warn('[provision] 全部技能 slug 安装失败，继承默认技能策略', { employeeId, agentId: result.agentId });
  }
}
```

说明：`applyAgentSkillAllowlist(agentId, null)` 用于在「曾打算写白名单」的场景下删除 `skills` 键；对新 Agent 通常为 no-op，但保留调用以便与「解析出非空但全部安装失败」的语义一致。

注意：从 `electron/api/routes/agents.ts` 到 `../../utils/` 的相对路径以仓库实际层级为准（若不一致请修正）。

- [ ] **Step 2.3：手动验证命令（开发者本地）**

1. 启动应用或仅跑 Host API 测试环境。
2. 调用 `POST /api/employees/provision`，带 `skills: ['不存在的-slug-xxx']`，确认 `openclaw.json` 中该 agent 条目**无** `skills` 键且日志含 warn。

- [ ] **Step 2.4：提交**

```bash
git add electron/api/routes/agents.ts
git commit -m "feat(electron): provision 接口根据 skills 应用 per-agent allowlist"
```

---

### Task 3: 渲染进程传入 `skills`

**Files:**
- Modify: `src/stores/employees.ts`

- [ ] **Step 3.1：在 `hostApiFetch('/api/employees/provision', { body: JSON.stringify({...}) })` 中增加字段**

当 `payload.skills` 为 **非空数组** 时传入 `skills: payload.skills`；当 `undefined`、空数组、或无需限制时 **不传** `skills` 字段（或传 `undefined` 并在 `JSON.stringify` 前剔除 undefined——与项目 JSON 习惯一致）。

与 `Employee` 类型（`src/types/employee.ts`）一致：`skills?: string[]` 已由 `mapCatalogAgentToEmployee` 填充。

- [ ] **Step 3.2：运行类型检查**

```bash
pnpm run typecheck
```

预期：无新增错误。

- [ ] **Step 3.3：提交**

```bash
git add src/stores/employees.ts
git commit -m "feat(renderer): provision 请求携带 Employee.skills 供 Host 应用技能白名单"
```

---

### Task 4：文档与自检

- [ ] **Step 4.1：在设计 spec 文末增加「OpenClaw 配置键」引用（可选一行）**  
修改 `docs/superpowers/specs/2026-04-16-employee-provision-required-skills-design.md`，指向官方 `agents.list[].skills` 说明链接。

- [ ] **Step 4.2：运行全量单测与 lint**

```bash
pnpm test
pnpm run lint
```

- [ ] **Step 4.3：提交**

```bash
git add docs/superpowers/specs/2026-04-16-employee-provision-required-skills-design.md
git commit -m "docs: 补充 requiredSkills 设计文档中的 OpenClaw 字段引用"
```

---

## 计划自检（writing-plans Self-Review）

| Spec 条款 | 对应任务 |
|-----------|----------|
| 空/[]/缺失 → 继承 | Task 2：`requested.length === 0` 时不调用 `apply`（新 Agent 无 `skills` 键）；Task 3 不传 `skills` |
| 非空 → 白名单 | Task 2：`resolved.length > 0` 时 `applyAgentSkillAllowlist(agentId, resolved)` |
| 未知 slug → ClawHub 安装；失败跳过 | Task 1 `ensureSlugsViaClawHub` |
| 全部失败 → 继承 + 日志 | Task 2 `else` 分支 warn + `applyAgentSkillAllowlist(..., null)` |
| 禁止全局 `skills.entries` 批量开关 | 计划中明确禁止；实现勿调用 `setSkillsEnabled` 式全局策略 |

**占位符扫描：** 无 TBD 步骤；OpenClaw 字段名已锚定官方文档。

**类型一致性：** `body.skills`、`Employee.skills`、`applyAgentSkillAllowlist` 均为 `string[]` / optional 一致。

---

**Plan complete and saved to `docs/superpowers/plans/2026-04-16-employee-provision-required-skills.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — 每个任务派生子代理，任务间人工复核，迭代快  

**2. Inline Execution** — 在本会话用 executing-plans 顺序执行，批量推进并设检查点  

**Which approach?**
