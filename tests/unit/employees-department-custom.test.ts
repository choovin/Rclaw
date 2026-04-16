import { describe, expect, it } from 'vitest';
import { DEPARTMENT_MAP } from '@/types/employee';

describe('employees departments', () => {
  it('includes custom department', () => {
    const all = Object.values(DEPARTMENT_MAP);
    expect(all.some((d) => d.id === 'custom')).toBe(true);
  });
});
