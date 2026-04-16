import type { Skill } from '@/types/skill';
import type { SkillhubListItem } from '@/types/skillhub';
import { normalizeCommandName } from '@/pages/Chat/chat-skill-command';

export type CreateEmployeeSkillSection = 'hub' | 'local-only';

/** 创建员工表单中已选技能（提交时仅取 slug 数组） */
export type SelectedEmployeeSkill = {
  slug: string;
  title: string;
  description: string;
};

export type CreateEmployeeSkillOptionRow = {
  slug: string;
  title: string;
  /** 摘要：用于表单第二行与选中项展示 */
  description: string;
  installed: boolean;
  section: CreateEmployeeSkillSection;
};

/** 折叠空白并截断，用于列表第二行摘要 */
export function truncateSkillDescription(raw: string, maxLen = 96): string {
  const t = raw.replace(/\s+/g, ' ').trim();
  if (!t) return '';
  if (t.length <= maxLen) return t;
  return `${t.slice(0, maxLen)}…`;
}

/** Keys for「本地是否已有该技能」判断（与聊天白名单一致）。 */
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

/**
 * **本地优先**：先输出 `localFiltered` 中的技能（与 Hub 同 slug 时只保留本地这一行，标题用本地 `name`）；
 * 再按 Hub 接口顺序追加「尚未出现过的」商店条目。
 */
export function mergeSkillhubRowsWithLocal(
  hubItems: SkillhubListItem[],
  localFiltered: Skill[],
  installedKeys: Set<string>,
): CreateEmployeeSkillOptionRow[] {
  const hubSlugKeys = new Set<string>();
  for (const h of hubItems) {
    const slug = (h.slug ?? '').trim();
    if (!slug) continue;
    hubSlugKeys.add(normalizeCommandName(slug));
  }

  const emittedKeys = new Set<string>();
  const out: CreateEmployeeSkillOptionRow[] = [];

  for (const s of localFiltered) {
    const raw = (s.slug ?? s.id ?? '').trim();
    if (!raw) continue;
    const k = normalizeCommandName(raw);
    if (emittedKeys.has(k)) continue;
    emittedKeys.add(k);
    const inHub = hubSlugKeys.has(k);
    out.push({
      slug: raw,
      title: (s.name?.trim() || raw).trim() || raw,
      description: truncateSkillDescription(s.description ?? ''),
      installed: true,
      section: inHub ? 'hub' : 'local-only',
    });
  }

  for (const h of hubItems) {
    const slug = (h.slug ?? '').trim();
    if (!slug) continue;
    const k = normalizeCommandName(slug);
    if (emittedKeys.has(k)) continue;
    emittedKeys.add(k);
    out.push({
      slug,
      title: (h.displayName?.trim() || slug).trim() || slug,
      description: truncateSkillDescription(h.summary ?? ''),
      installed: installedKeys.has(k),
      section: 'hub',
    });
  }

  return out;
}

export function isSlugInSelectedList(rawSlug: string, selectedSlugs: string[]): boolean {
  const k = normalizeCommandName(rawSlug);
  return selectedSlugs.some((s) => normalizeCommandName(s) === k);
}

export function isSlugInSelectedSkills(rawSlug: string, selected: SelectedEmployeeSkill[]): boolean {
  const k = normalizeCommandName(rawSlug);
  return selected.some((s) => normalizeCommandName(s.slug) === k);
}

/** 根据当前 `useSkillsStore.skills` 判断 slug 在本地的启用状态（用于已选列表展示）。 */
export type LocalSkillInstallStatus = 'installed' | 'disabled' | 'not_installed';

export function resolveLocalSkillInstallStatus(slug: string, skills: Skill[]): LocalSkillInstallStatus {
  const k = normalizeCommandName(slug);
  const s = skills.find((row) => normalizeCommandName(row.slug ?? row.id) === k);
  if (!s) return 'not_installed';
  if (!s.enabled) return 'disabled';
  return 'installed';
}

/** 在弹窗中点选一行：已选则移除，未选则加入（含标题与描述摘要）。 */
export function toggleSelectedSkillRow(
  row: CreateEmployeeSkillOptionRow,
  selected: SelectedEmployeeSkill[],
): SelectedEmployeeSkill[] {
  const k = normalizeCommandName(row.slug);
  const exists = selected.some((s) => normalizeCommandName(s.slug) === k);
  if (exists) {
    return selected.filter((s) => normalizeCommandName(s.slug) !== k);
  }
  return [
    ...selected,
    {
      slug: row.slug,
      title: row.title,
      description: row.description,
    },
  ];
}
