import type { Employee } from '@/types/employee';
import type { Skill } from '@/types/skill';
import { normalizeCommandName } from '@/pages/Chat/chat-skill-command';

/**
 * Skills shown in the chat skill picker and slash-command chip set for the current session.
 * When the agent is linked to a my-employee with a non-empty `skills` list, only enabled skills
 * whose slug matches that allowlist (via {@link normalizeCommandName}) are visible.
 * Otherwise inherits the full local skill list (Popover still hides disabled entries).
 */
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
