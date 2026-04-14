import { mkdtemp, readFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { describe, expect, it } from 'vitest';
import { buildIdentityMd } from '@electron/utils/digital-employee-workspace';

describe('buildIdentityMd', () => {
  it('uses placeholder Vibe line when vibe is omitted or blank', () => {
    const md = buildIdentityMd({
      nameZh: '张三',
      roleTitle: '人类学家',
      soulContent: '',
      agentsContent: '',
      identityContent: '',
      emoji: '🌍',
    });
    expect(md).toContain('Vibe: （可随对话补充）');
  });
});

describe('writeDigitalEmployeeWorkspaceFiles', () => {
  it('writes SOUL, AGENTS, IDENTITY, USER.md, TODO.md under absDir', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'emp-ws-'));
    try {
      const { writeDigitalEmployeeWorkspaceFiles, OPENCLAW_USER_FILENAME } = await import(
        '@electron/utils/digital-employee-workspace'
      );

      writeDigitalEmployeeWorkspaceFiles(dir, {
        nameZh: '张三',
        roleTitle: '人类学家',
        soulContent: 'SOUL-BODY',
        agentsContent: 'AGENTS-BODY',
        identityContent: 'IDENTITY-BODY',
        emoji: '🌍',
        vibe: '沉稳',
      });

      expect(await readFile(join(dir, 'SOUL.md'), 'utf8')).toBe('SOUL-BODY');
      expect(await readFile(join(dir, 'AGENTS.md'), 'utf8')).toBe('AGENTS-BODY');
      const identity = await readFile(join(dir, 'IDENTITY.md'), 'utf8');
      expect(identity).toContain('Name: 张三');
      expect(identity).toContain('职能角色：人类学家');
      expect(identity).toContain('🌍');
      expect(identity).toContain('沉稳');
      expect(identity).toContain('IDENTITY-BODY');

      const user = await readFile(join(dir, OPENCLAW_USER_FILENAME), 'utf8');
      expect(user).toContain('关于使用本工作区的人类');
      expect(user).not.toContain('张三');

      expect(await readFile(join(dir, 'TODO.md'), 'utf8')).toContain('待办事项');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('writes default Vibe placeholder in IDENTITY when vibe omitted', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'emp-ws-'));
    try {
      const { writeDigitalEmployeeWorkspaceFiles } = await import('@electron/utils/digital-employee-workspace');

      writeDigitalEmployeeWorkspaceFiles(dir, {
        nameZh: '李四',
        roleTitle: '测试岗',
        soulContent: 'S',
        agentsContent: 'A',
        identityContent: '',
        emoji: '⭐',
      });

      const identity = await readFile(join(dir, 'IDENTITY.md'), 'utf8');
      expect(identity).toContain('Vibe: （可随对话补充）');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
