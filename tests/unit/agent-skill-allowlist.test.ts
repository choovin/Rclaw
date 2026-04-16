import { describe, expect, it, vi, beforeEach } from 'vitest';

const readMock = vi.fn();
const writeMock = vi.fn();

vi.mock('@electron/utils/config-mutex', () => ({
  withConfigLock: async (fn: () => Promise<void>) => {
    await fn();
  },
}));

vi.mock('@electron/utils/channel-config', () => ({
  readOpenClawConfig: (...args: unknown[]) => readMock(...args),
  writeOpenClawConfig: (...args: unknown[]) => writeMock(...args),
}));

describe('agent-skill-allowlist', () => {
  beforeEach(() => {
    readMock.mockReset();
    writeMock.mockReset();
  });

  describe('normalizeProvisionSkillSlugs', () => {
    it('trims, dedupes, skips non-strings', async () => {
      const { normalizeProvisionSkillSlugs } = await import('@electron/utils/agent-skill-allowlist');
      expect(normalizeProvisionSkillSlugs([' a ', 'b', 'a', '', 3 as unknown as string])).toEqual(['a', 'b']);
    });

    it('returns [] for non-array', async () => {
      const { normalizeProvisionSkillSlugs } = await import('@electron/utils/agent-skill-allowlist');
      expect(normalizeProvisionSkillSlugs(null)).toEqual([]);
    });
  });

  describe('applyAgentSkillAllowlist', () => {
    it('sets skills when non-empty', async () => {
      readMock.mockResolvedValue({
        agents: {
          list: [{ id: 'writer', name: 'Writer' }],
        },
      });
      const { applyAgentSkillAllowlist } = await import('@electron/utils/agent-skill-allowlist');
      await applyAgentSkillAllowlist('writer', ['pdf']);

      expect(writeMock).toHaveBeenCalledTimes(1);
      const written = writeMock.mock.calls[0][0] as { agents: { list: Array<Record<string, unknown>> } };
      expect(written.agents.list[0].skills).toEqual(['pdf']);
    });

    it('removes skills key when null or empty', async () => {
      readMock.mockResolvedValue({
        agents: {
          list: [{ id: 'writer', skills: ['x'] }],
        },
      });
      const { applyAgentSkillAllowlist } = await import('@electron/utils/agent-skill-allowlist');
      await applyAgentSkillAllowlist('writer', null);

      const written = writeMock.mock.calls[0][0] as { agents: { list: Array<Record<string, unknown>> } };
      expect(written.agents.list[0].skills).toBeUndefined();
    });
  });

  describe('ensureSlugsViaClawHub', () => {
    it('skips install when already on disk', async () => {
      const install = vi.fn();
      const { ensureSlugsViaClawHub } = await import('@electron/utils/agent-skill-allowlist');
      const out = await ensureSlugsViaClawHub(['pdf'], { install }, { employeeId: 'e1', agentId: 'a1' }, {
        isPresent: () => true,
      });
      expect(out).toEqual(['pdf']);
      expect(install).not.toHaveBeenCalled();
    });

    it('calls install when missing and includes slug after install', async () => {
      const isPresent = vi.fn().mockReturnValueOnce(false).mockReturnValue(true);
      const install = vi.fn().mockResolvedValue(undefined);
      const { ensureSlugsViaClawHub } = await import('@electron/utils/agent-skill-allowlist');
      const out = await ensureSlugsViaClawHub(['new-skill'], { install }, { employeeId: 'e1', agentId: 'a1' }, {
        isPresent,
      });
      expect(install).toHaveBeenCalledWith({ slug: 'new-skill' });
      expect(out).toEqual(['new-skill']);
      expect(isPresent).toHaveBeenCalled();
    });

    it('omits slug when install fails and still not on disk', async () => {
      const install = vi.fn().mockRejectedValue(new Error('network'));
      const { ensureSlugsViaClawHub } = await import('@electron/utils/agent-skill-allowlist');
      const out = await ensureSlugsViaClawHub(['bad'], { install }, { employeeId: 'e1', agentId: 'a1' }, {
        isPresent: () => false,
      });
      expect(out).toEqual([]);
    });
  });
});
