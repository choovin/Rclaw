import { describe, expect, it } from 'vitest';
import { formatAgentSessionDisplayName } from '@/lib/format-agent-session-display-name';
import type { Employee } from '@/types/employee';

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

describe('formatAgentSessionDisplayName', () => {
  it('returns nameZh(name) when a my-employee links to the agent', () => {
    const my: Employee[] = [
      minimalEmployee({
        id: 'emp-1',
        nameZh: '叶春梅',
        name: '人类学家',
        linkedAgentId: 'ye-chunmei',
      }),
    ];
    expect(formatAgentSessionDisplayName('ye-chunmei', '叶春梅', my)).toBe('叶春梅(人类学家)');
  });

  it('falls back to agent display name when no linked employee', () => {
    expect(formatAgentSessionDisplayName('main', 'RClaw', [])).toBe('RClaw');
  });

  it('falls back when linked employee lacks nameZh or name', () => {
    const my: Employee[] = [
      minimalEmployee({
        id: 'emp-1',
        nameZh: '',
        name: '人类学家',
        linkedAgentId: 'x',
      }),
    ];
    expect(formatAgentSessionDisplayName('x', 'slug-display', my)).toBe('slug-display');
  });
});
