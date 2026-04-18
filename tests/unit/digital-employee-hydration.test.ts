import { mkdtemp, rm, writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { describe, expect, it } from 'vitest';
import { buildIdentityMd } from '@electron/utils/digital-employee-workspace';
import {
  classifyDigitalEmployeeWorkspace,
  parseIdentityMdForHydrate,
  RCLAW_TODO_MARKER,
  writeDigitalEmployeeSidecar,
} from '@electron/utils/digital-employee-hydration';

describe('classifyDigitalEmployeeWorkspace', () => {
  it('classifies strong when workspace has valid sidecar only (TODO may be empty or missing)', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'de-hydr-'));
    try {
      writeDigitalEmployeeSidecar(dir, { version: 1, catalogEmployeeId: 'cat-1' });

      const cls = await classifyDigitalEmployeeWorkspace('agent-x', dir);
      expect(cls).toBe('strong');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('classifies weak when TODO has marker and SOUL/AGENTS are non-empty, with no sidecar', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'de-hydr-'));
    try {
      await writeFile(
        join(dir, 'TODO.md'),
        `# Todo\n\n---\n*${RCLAW_TODO_MARKER}*\n`,
        'utf8',
      );
      await writeFile(join(dir, 'SOUL.md'), 'soul body', 'utf8');
      await writeFile(join(dir, 'AGENTS.md'), 'agents body', 'utf8');

      const cls = await classifyDigitalEmployeeWorkspace('agent-y', dir);
      expect(cls).toBe('weak');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('classifies none for folder without marker and without valid sidecar', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'de-hydr-'));
    try {
      await writeFile(join(dir, 'README.md'), '# main\n', 'utf8');

      const cls = await classifyDigitalEmployeeWorkspace('main', dir);
      expect(cls).toBe('none');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe('parseIdentityMdForHydrate', () => {
  it('parses IDENTITY content consistent with buildIdentityMd', () => {
    const md = buildIdentityMd({
      nameZh: '张三',
      roleTitle: '人类学家',
      soulContent: '',
      agentsContent: '',
      identityContent: 'extra block',
      emoji: '🌍',
      vibe: '沉稳',
    });

    expect(parseIdentityMdForHydrate(md)).toEqual({
      nameZh: '张三',
      name: '人类学家',
      emoji: '🌍',
      vibe: '沉稳',
    });
  });

  it('returns null when Name line is missing', () => {
    const content = `# IDENTITY.md - 我是谁

- Creature: 数字员工（职能角色：人类学家）
- Vibe: （可随对话补充）
- Emoji: —
`;
    expect(parseIdentityMdForHydrate(content)).toBeNull();
  });
});
