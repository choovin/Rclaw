import { describe, expect, it } from 'vitest';
import { mergeWorkspaceSoulAgentsIntoEmployees } from '@/stores/employees';
import type { Employee } from '@/types/employee';

function baseEmp(overrides: Partial<Employee> = {}): Employee {
  return {
    id: 'e1',
    name: 'A',
    nameZh: '甲',
    description: '',
    color: '#000',
    emoji: '🙂',
    vibe: 'v',
    department: 'custom',
    soulContent: 'old soul',
    agentsContent: 'old agents',
    ...overrides,
  };
}

describe('mergeWorkspaceSoulAgentsIntoEmployees', () => {
  it('merges soul/agents for matching employee id', () => {
    const row = baseEmp({ id: 'e1' });
    const other = baseEmp({ id: 'e2', soulContent: 'x', agentsContent: 'y' });
    const { myEmployees } = mergeWorkspaceSoulAgentsIntoEmployees(
      'e1',
      { soulContent: 'new soul', agentsContent: 'new agents' },
      [row, other],
      null,
    );
    expect(myEmployees[0].soulContent).toBe('new soul');
    expect(myEmployees[0].agentsContent).toBe('new agents');
    expect(myEmployees[1].soulContent).toBe('x');
  });

  it('updates selectedEmployee when same id', () => {
    const row = baseEmp();
    const { selectedEmployee } = mergeWorkspaceSoulAgentsIntoEmployees(
      'e1',
      { soulContent: 'disk-soul', agentsContent: 'disk-agents' },
      [row],
      row,
    );
    expect(selectedEmployee?.soulContent).toBe('disk-soul');
    expect(selectedEmployee?.agentsContent).toBe('disk-agents');
  });

  it('leaves selectedEmployee unchanged when different id', () => {
    const row = baseEmp({ id: 'e1' });
    const selected = baseEmp({ id: 'e2' });
    const { selectedEmployee } = mergeWorkspaceSoulAgentsIntoEmployees(
      'e1',
      { soulContent: 'a', agentsContent: 'b' },
      [row, selected],
      selected,
    );
    expect(selectedEmployee?.id).toBe('e2');
    expect(selectedEmployee?.soulContent).toBe('old soul');
  });
});
