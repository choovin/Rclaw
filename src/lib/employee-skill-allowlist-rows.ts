import type { Skill } from '@/types/skill';
import { normalizeCommandName } from '@/pages/Chat/chat-skill-command';

export type EmployeeSkillAllowlistRowState = 'installed' | 'installedDisabled' | 'missing';

export type EmployeeSkillAllowlistRow = {
  whitelistSlug: string;
  primaryLabel: string;
  state: EmployeeSkillAllowlistRowState;
};

/**
 * Maps catalog / employee whitelist slugs to display rows using the same
 * {@link normalizeCommandName} matching rules as chat allowlist filtering.
 */
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
