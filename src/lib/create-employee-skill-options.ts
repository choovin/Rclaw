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
 * Hub 行保持接口顺序；随后追加「仅本地匹配、未出现在当前 Hub 列表中的」行（补漏）。
 */
export function mergeSkillhubRowsWithLocal(
  hubItems: SkillhubListItem[],
  localFiltered: Skill[],
  installedKeys: Set<string>,
): CreateEmployeeSkillOptionRow[] {
  const out: CreateEmployeeSkillOptionRow[] = [];
  const hubSlugKeys = new Set<string>();

  for (const h of hubItems) {
    const slug = (h.slug ?? '').trim();
    if (!slug) continue;
    const k = normalizeCommandName(slug);
    hubSlugKeys.add(k);
    out.push({
      slug,
      title: (h.displayName?.trim() || slug).trim() || slug,
      installed: installedKeys.has(k),
      section: 'hub',
    });
  }

  const seenLocalOnly = new Set<string>();
  for (const s of localFiltered) {
    const raw = (s.slug ?? s.id ?? '').trim();
    if (!raw) continue;
    const k = normalizeCommandName(raw);
    if (hubSlugKeys.has(k)) continue;
    if (seenLocalOnly.has(k)) continue;
    seenLocalOnly.add(k);
    out.push({
      slug: raw,
      title: (s.name?.trim() || raw).trim() || raw,
      installed: true,
      section: 'local-only',
    });
  }

  return out;
}

export function isSlugInSelectedList(rawSlug: string, selectedSlugs: string[]): boolean {
  const k = normalizeCommandName(rawSlug);
  return selectedSlugs.some((s) => normalizeCommandName(s) === k);
}
