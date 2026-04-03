import { describe, expect, it } from 'vitest';
import { getAllDepartments } from '@/stores/employees';

describe('employees departments', () => {
  it('includes custom department', () => {
    const all = getAllDepartments();
    expect(all.some((d) => d.id === 'custom')).toBe(true);
  });
});
