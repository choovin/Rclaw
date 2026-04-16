import { describe, expect, it } from 'vitest';
import { getChatVisibleSkillsForAgent } from '@/pages/Chat/chat-visible-skills';
import type { Employee } from '@/types/employee';
import type { Skill } from '@/types/skill';

function minimalEmployee(partial: Partial<Employee> & Pick<Employee, 'id' | 'name' | 'nameZh'>): Employee {
  return {
    description: '',
    color: '#000',
    emoji: '•',
    vibe: '',
    department: 'custom',
    ...partial,
  };
}

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
    minimalEmployee({
      id: 'e1',
      name: 'r',
      nameZh: '中',
      linkedAgentId: 'agent-a',
      skills: ['foo-bar', 'baz'],
    }),
  ];

  const skills: Skill[] = [
    sk({ id: '1', slug: 'foo-bar', enabled: true }),
    sk({ id: '2', slug: 'other', enabled: true }),
    sk({ id: '3', slug: 'baz', enabled: false }),
  ];

  it('returns full list when agentId is empty', () => {
    expect(getChatVisibleSkillsForAgent('', skills, employees)).toEqual(skills);
  });

  it('returns full list when no employee is linked to agent', () => {
    expect(getChatVisibleSkillsForAgent('unknown', skills, []).length).toBe(3);
  });

  it('returns full list when employee skills whitelist is empty', () => {
    const empEmpty: Employee[] = [minimalEmployee({ ...employees[0]!, skills: [] })];
    expect(getChatVisibleSkillsForAgent('agent-a', skills, empEmpty)).toEqual(skills);
  });

  it('returns full list when employee has no skills field', () => {
    const { skills: _s, ...rest } = employees[0]!;
    const empNoSkills: Employee[] = [minimalEmployee(rest)];
    expect(getChatVisibleSkillsForAgent('agent-a', skills, empNoSkills)).toEqual(skills);
  });

  it('filters to enabled whitelist matches only', () => {
    const out = getChatVisibleSkillsForAgent('agent-a', skills, employees);
    expect(out.map((s) => s.slug)).toEqual(['foo-bar']);
  });

  it('matches employee slug to skill command via normalizeCommandName', () => {
    const mixed: Skill[] = [sk({ id: 'x', slug: 'foo_bar', enabled: true })];
    const out = getChatVisibleSkillsForAgent('agent-a', mixed, employees);
    expect(out.map((s) => s.slug)).toEqual(['foo_bar']);
  });
});
