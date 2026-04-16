import { describe, expect, it } from 'vitest';
import { reconcileMyEmployeesWithOpenClawAgentIds } from '@/stores/employees';
import type { Employee } from '@/types/employee';

describe('reconcileMyEmployeesWithOpenClawAgentIds', () => {
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
    const next = reconcileMyEmployeesWithOpenClawAgentIds(myEmployees, ['still-here'], null);
    expect(next.myEmployees).toHaveLength(1);
    expect(next.myEmployees[0].linkedAgentId).toBe('still-here');
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
    const next = reconcileMyEmployeesWithOpenClawAgentIds([row], [], row);
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
    const next = reconcileMyEmployeesWithOpenClawAgentIds(myEmployees, ['main'], null);
    expect(next.myEmployees).toHaveLength(0);
  });
});
