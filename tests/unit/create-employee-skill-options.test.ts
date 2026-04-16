import { describe, expect, it } from 'vitest';
import {
  buildInstalledSlugKeySet,
  filterLocalSkillsForPicker,
  mergeSkillhubRowsWithLocal,
  resolveLocalSkillInstallStatus,
  toggleSelectedSkillRow,
  truncateSkillDescription,
  type CreateEmployeeSkillOptionRow,
} from '@/lib/create-employee-skill-options';
import type { Skill } from '@/types/skill';
import type { SkillhubListItem } from '@/types/skillhub';

function skill(partial: Partial<Skill> & Pick<Skill, 'id' | 'name'>): Skill {
  return {
    description: '',
    enabled: true,
    ...partial,
  };
}

describe('create-employee-skill-options', () => {
  it('buildInstalledSlugKeySet collects distinct slug keys and skips empty', () => {
    const skills: Skill[] = [
      skill({ id: 'a', name: 'A', slug: 'pdf' }),
      skill({ id: 'b', name: 'B', slug: 'doc' }),
      skill({ id: 'empty', name: 'E', slug: '' }),
    ];
    const set = buildInstalledSlugKeySet(skills);
    expect(set.size).toBe(2);
    expect(set.has('pdf')).toBe(true);
    expect(set.has('doc')).toBe(true);
  });

  it('mergeSkillhubRowsWithLocal marks hub row installed when local has same slug', () => {
    const hub: SkillhubListItem[] = [
      {
        id: 1,
        slug: 'pdf',
        displayName: 'PDF',
        summary: '',
        status: 'ACTIVE',
        namespace: 'global',
        updatedAt: '',
        resolutionMode: 'PUBLISHED',
      },
    ];
    const local: Skill[] = [skill({ id: 'x', name: 'PDF local', slug: 'pdf' })];
    const keys = buildInstalledSlugKeySet(local);
    const rows = mergeSkillhubRowsWithLocal(hub, filterLocalSkillsForPicker(local, 'pdf'), keys);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.section).toBe('hub');
    expect(rows[0]?.installed).toBe(true);
    expect(rows[0]?.slug).toBe('pdf');
    expect(rows[0]?.description).toBe('');
  });

  it('mergeSkillhubRowsWithLocal includes truncated description from local and hub', () => {
    const hub: SkillhubListItem[] = [
      {
        id: 1,
        slug: 'remote',
        displayName: 'Remote',
        summary: 'Hub summary text',
        status: 'ACTIVE',
        namespace: 'global',
        updatedAt: '',
        resolutionMode: 'PUBLISHED',
      },
    ];
    const local: Skill[] = [
      skill({
        id: '1',
        name: 'Local',
        slug: 'local',
        description: 'Local desc',
      }),
    ];
    const keys = buildInstalledSlugKeySet([]);
    const rows = mergeSkillhubRowsWithLocal(hub, filterLocalSkillsForPicker(local, ''), keys);
    expect(rows.find((r) => r.slug === 'local')?.description).toBe('Local desc');
    expect(rows.find((r) => r.slug === 'remote')?.description).toBe('Hub summary text');
  });

  it('toggleSelectedSkillRow adds and removes by slug', () => {
    const row: CreateEmployeeSkillOptionRow = {
      slug: 'a',
      title: 'A',
      description: 'd',
      installed: true,
      section: 'hub',
    };
    let sel = toggleSelectedSkillRow(row, []);
    expect(sel).toHaveLength(1);
    sel = toggleSelectedSkillRow(row, sel);
    expect(sel).toHaveLength(0);
  });

  it('truncateSkillDescription trims and truncates', () => {
    expect(truncateSkillDescription('  a  b  ', 3)).toBe('a b');
    expect(truncateSkillDescription('x'.repeat(100), 10)).toHaveLength(11);
  });

  it('mergeSkillhubRowsWithLocal appends local-only row when slug not in hub', () => {
    const hub: SkillhubListItem[] = [
      {
        id: 1,
        slug: 'foo',
        displayName: 'Foo',
        summary: '',
        status: 'ACTIVE',
        namespace: 'global',
        updatedAt: '',
        resolutionMode: 'PUBLISHED',
      },
    ];
    const local: Skill[] = [
      skill({ id: '1', name: 'Foo', slug: 'foo' }),
      skill({ id: '2', name: 'Bar skill', slug: 'bar' }),
    ];
    const keys = buildInstalledSlugKeySet(local);
    const filtered = filterLocalSkillsForPicker(local, 'bar');
    const rows = mergeSkillhubRowsWithLocal(hub, filtered, keys);
    expect(rows.map((r) => r.slug)).toEqual(['bar', 'foo']);
    const hubRow = rows.find((r) => r.slug === 'foo');
    const localOnly = rows.find((r) => r.slug === 'bar');
    expect(hubRow?.section).toBe('hub');
    expect(localOnly?.section).toBe('local-only');
    expect(localOnly?.installed).toBe(true);
  });

  it('filterLocalSkillsForPicker returns full list when query empty', () => {
    const skills: Skill[] = [skill({ id: '1', name: 'A', slug: 'a' }), skill({ id: '2', name: 'B', slug: 'b' })];
    expect(filterLocalSkillsForPicker(skills, '').length).toBe(2);
    expect(filterLocalSkillsForPicker(skills, '   ').length).toBe(2);
  });

  it('filterLocalSkillsForPicker filters by slug or name substring', () => {
    const skills: Skill[] = [
      skill({ id: '1', name: 'Alpha', slug: 'alpha' }),
      skill({ id: '2', name: 'Beta', slug: 'beta' }),
    ];
    const out = filterLocalSkillsForPicker(skills, 'alp');
    expect(out.map((s) => s.slug)).toEqual(['alpha']);
  });

  it('resolveLocalSkillInstallStatus reflects local skill presence and enabled', () => {
    const skills: Skill[] = [
      skill({ id: '1', name: 'A', slug: 'on', enabled: true }),
      skill({ id: '2', name: 'B', slug: 'off', enabled: false }),
    ];
    expect(resolveLocalSkillInstallStatus('on', skills)).toBe('installed');
    expect(resolveLocalSkillInstallStatus('off', skills)).toBe('disabled');
    expect(resolveLocalSkillInstallStatus('missing', skills)).toBe('not_installed');
  });
});
