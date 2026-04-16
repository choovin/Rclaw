import { describe, expect, it } from 'vitest';
import { reconcileEmployeeRowsWithAgentIds } from '@/stores/employees';
import type { Employee, EmployeeWithStatus } from '@/types/employee';

describe('reconcileEmployeeRowsWithAgentIds', () => {
  it('removes myEmployees whose linkedAgentId is not in OpenClaw', () => {
    const myEmployees: Employee[] = [
      {
        id: 'e1',
        name: 'A',
        nameZh: '甲',
        description: '',
        color: '#000',
        emoji: '🙂',
        vibe: '',
        department: 'custom',
        linkedAgentId: 'gone',
      },
      {
        id: 'e2',
        name: 'B',
        nameZh: '乙',
        description: '',
        color: '#000',
        emoji: '🙂',
        vibe: '',
        department: 'custom',
        linkedAgentId: 'still-here',
      },
    ];
    const catalog: EmployeeWithStatus[] = [
      { ...myEmployees[0], isAdded: true },
      { ...myEmployees[1], isAdded: true },
    ];
    const next = reconcileEmployeeRowsWithAgentIds(myEmployees, catalog, ['still-here'], null);
    expect(next.myEmployees).toHaveLength(1);
    expect(next.myEmployees[0].linkedAgentId).toBe('still-here');
    expect(next.employees.find((e) => e.id === 'e1')?.isAdded).toBe(false);
    expect(next.employees.find((e) => e.id === 'e2')?.isAdded).toBe(true);
  });

  it('clears selectedEmployee when that row is removed', () => {
    const row: Employee = {
      id: 'e1',
      name: 'A',
      nameZh: '甲',
      description: '',
      color: '#000',
      emoji: '🙂',
      vibe: '',
      department: 'custom',
      linkedAgentId: 'gone',
    };
    const next = reconcileEmployeeRowsWithAgentIds([row], [], [], row);
    expect(next.selectedEmployee).toBeNull();
  });

  it('drops rows with missing linkedAgentId', () => {
    const myEmployees: Employee[] = [
      {
        id: 'e1',
        name: 'A',
        nameZh: '甲',
        description: '',
        color: '#000',
        emoji: '🙂',
        vibe: '',
        department: 'custom',
      },
    ];
    const next = reconcileEmployeeRowsWithAgentIds(myEmployees, [], ['main'], null);
    expect(next.myEmployees).toHaveLength(0);
  });
});
