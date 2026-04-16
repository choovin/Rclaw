import { describe, expect, it } from 'vitest';
import { getEmployeeSkillAllowlistRows } from '@/lib/employee-skill-allowlist-rows';
import type { Skill } from '@/types/skill';

function sk(p: Partial<Skill> & Pick<Skill, 'id'>): Skill {
  return {
    name: 'n',
    description: 'd',
    enabled: true,
    ...p,
  };
}

describe('getEmployeeSkillAllowlistRows', () => {
  it('returns missing when no local skill matches', () => {
    const rows = getEmployeeSkillAllowlistRows(['unknown-slug'], [sk({ id: '1', slug: 'other' })]);
    expect(rows).toEqual([
      { whitelistSlug: 'unknown-slug', primaryLabel: 'unknown-slug', state: 'missing' },
    ]);
  });

  it('returns installed with skill name when matched and enabled', () => {
    const rows = getEmployeeSkillAllowlistRows(['foo-bar'], [
      sk({ id: '1', slug: 'foo-bar', name: 'Foo Name', enabled: true }),
    ]);
    expect(rows).toEqual([
      { whitelistSlug: 'foo-bar', primaryLabel: 'Foo Name', state: 'installed' },
    ]);
  });

  it('returns installedDisabled when matched but disabled', () => {
    const rows = getEmployeeSkillAllowlistRows(['baz'], [
      sk({ id: '2', slug: 'baz', name: 'Baz', enabled: false }),
    ]);
    expect(rows).toEqual([
      { whitelistSlug: 'baz', primaryLabel: 'Baz', state: 'installedDisabled' },
    ]);
  });

  it('matches whitelist slug to skill via normalizeCommandName', () => {
    const rows = getEmployeeSkillAllowlistRows(['foo-bar'], [
      sk({ id: 'x', slug: 'foo_bar', name: 'Foo', enabled: true }),
    ]);
    expect(rows).toEqual([
      { whitelistSlug: 'foo-bar', primaryLabel: 'Foo', state: 'installed' },
    ]);
  });

  it('preserves whitelist order', () => {
    const rows = getEmployeeSkillAllowlistRows(['z', 'a', 'm'], [
      sk({ id: '1', slug: 'z', name: 'Z', enabled: true }),
      sk({ id: '2', slug: 'a', name: 'A', enabled: true }),
      sk({ id: '3', slug: 'm', name: 'M', enabled: true }),
    ]);
    expect(rows.map((r) => r.whitelistSlug)).toEqual(['z', 'a', 'm']);
  });

  it('treats undefined skills as empty list (all missing)', () => {
    const rows = getEmployeeSkillAllowlistRows(['a', 'b'], undefined);
    expect(rows).toEqual([
      { whitelistSlug: 'a', primaryLabel: 'a', state: 'missing' },
      { whitelistSlug: 'b', primaryLabel: 'b', state: 'missing' },
    ]);
  });
});
