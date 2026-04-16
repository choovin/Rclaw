import type { ClawCatalogAgent } from '@/types/claw-catalog';
import type { EmployeeWithStatus } from '@/types/employee';

function parseJsonStringArray(raw: string | undefined): string[] {
  if (raw == null || !String(raw).trim()) return [];
  try {
    const v = JSON.parse(String(raw)) as unknown;
    if (!Array.isArray(v)) return [];
    return v.map((x) => String(x));
  } catch {
    return [];
  }
}

/**
 * Map a Claw Catalog agent row to the in-app employee card model. `id` is always `bundleId`.
 */
export function mapCatalogAgentToEmployee(agent: ClawCatalogAgent): EmployeeWithStatus {
  const descriptionZh = agent.descriptionZh?.trim() ?? '';
  const descriptionEn = agent.description?.trim() ?? '';
  const desc = descriptionZh || descriptionEn || '';

  return {
    id: agent.bundleId.trim(),
    name: agent.name?.trim() || agent.nameZh?.trim() || agent.bundleId,
    nameZh: agent.nameZh?.trim() || agent.name?.trim() || agent.bundleId,
    description: desc,
    descriptionZh: descriptionZh || undefined,
    color: agent.color?.trim() || 'slate',
    emoji: agent.emoji?.trim() || '🤖',
    vibe: agent.vibe?.trim() || '',
    vibeZh: agent.vibeZh?.trim() || undefined,
    department: agent.department?.trim() || 'custom',
    departmentId: agent.departmentId,
    skills: parseJsonStringArray(agent.requiredSkills),
    channels: parseJsonStringArray(agent.requiredChannels),
    soulContent: typeof agent.soulContent === 'string' ? agent.soulContent : '',
    agentsContent: typeof agent.agentsContent === 'string' ? agent.agentsContent : '',
    identityContent: typeof agent.identityContent === 'string' ? agent.identityContent : '',
    isAdded: false,
  };
}
