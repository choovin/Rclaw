import { mkdtemp, readFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { describe, expect, it } from 'vitest';

describe('writeDigitalEmployeeWorkspaceFiles', () => {
  it('writes SOUL, AGENTS, IDENTITY, user, todo under absDir', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'emp-ws-'));
    try {
      const { writeDigitalEmployeeWorkspaceFiles } = await import(
        '@electron/utils/digital-employee-workspace'
      );

      writeDigitalEmployeeWorkspaceFiles(dir, {
        nameZh: '张三',
        nameEn: 'Agent',
        soulContent: 'SOUL-BODY',
        agentsContent: 'AGENTS-BODY',
        identityContent: 'IDENTITY-BODY',
      });

      expect(await readFile(join(dir, 'SOUL.md'), 'utf8')).toBe('SOUL-BODY');
      expect(await readFile(join(dir, 'AGENTS.md'), 'utf8')).toBe('AGENTS-BODY');
      expect(await readFile(join(dir, 'IDENTITY.md'), 'utf8')).toBe('IDENTITY-BODY');
      const user = await readFile(join(dir, 'user.md'), 'utf8');
      expect(user).toContain('张三');
      expect(user).toContain('Agent');
      expect(await readFile(join(dir, 'todo.md'), 'utf8')).toContain('待办事项');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
