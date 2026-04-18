import { describe, expect, it } from 'vitest';
import { mergeHydratedEmployeesRows } from '@/stores/employees';
import type { Employee, HostHydratedEmployee } from '@/types/employee';

describe('mergeHydratedEmployeesRows', () => {
  it('merges hydrated fields into existing row by linkedAgentId', () => {
    const current: Employee[] = [
      {
        id: 'catalog-1',
        name: 'OldEn',
        nameZh: '旧名',
        description: 'd',
        color: '#111',
        emoji: '🙂',
        vibe: 'v',
        department: 'custom',
        linkedAgentId: 'agent-a',
      },
    ];
    const hydrated: HostHydratedEmployee[] = [
      {
        linkedAgentId: 'agent-a',
        id: 'catalog-1',
        name: 'NewEn',
        nameZh: '新名',
        description: 'd2',
        color: '#6366f1',
        emoji: '✨',
        vibe: 'nv',
        department: 'engineering',
        skipCatalogDetailFetch: false,
      },
    ];
    const merged = mergeHydratedEmployeesRows(current, hydrated);
    expect(merged).toHaveLength(1);
    expect(merged[0].linkedAgentId).toBe('agent-a');
    expect(merged[0].name).toBe('NewEn');
    expect(merged[0].nameZh).toBe('新名');
    expect(merged[0].department).toBe('engineering');
    expect(merged[0].skipCatalogDetailFetch).toBe(false);
  });

  it('adds one row when current is empty', () => {
    const hydrated: HostHydratedEmployee[] = [
      {
        linkedAgentId: 'agent-b',
        id: 'local-openclaw:agent-b',
        name: 'Role',
        nameZh: '角色',
        description: '',
        color: '#6366f1',
        emoji: '—',
        vibe: '（可随对话补充）',
        department: 'custom',
        skipCatalogDetailFetch: true,
      },
    ];
    const merged = mergeHydratedEmployeesRows([], hydrated);
    expect(merged).toHaveLength(1);
    expect(merged[0].linkedAgentId).toBe('agent-b');
    expect(merged[0].id).toBe('local-openclaw:agent-b');
  });
});
