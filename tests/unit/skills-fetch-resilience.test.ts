import { beforeEach, describe, expect, it, vi } from 'vitest';

const hostApiFetchMock = vi.fn();
const rpcMock = vi.fn();

vi.mock('@/lib/host-api', () => ({
  hostApiFetch: (...args: unknown[]) => hostApiFetchMock(...args),
}));

vi.mock('@/stores/gateway', () => ({
  useGatewayStore: {
    getState: () => ({
      rpc: (...args: unknown[]) => rpcMock(...args),
    }),
  },
}));

describe('fetchSkills resilience', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('continues when skills.status rejects and merges ClawHub list', async () => {
    rpcMock.mockRejectedValueOnce(new Error('gateway down'));
    hostApiFetchMock.mockImplementation(async (path: string) => {
      if (path === '/api/clawhub/list') {
        return { success: true, results: [{ slug: 'disk-only', version: '1', baseDir: '/x' }] };
      }
      if (path === '/api/skills/configs') {
        return { 'disk-only': {} };
      }
      return {};
    });

    const { useSkillsStore } = await import('@/stores/skills');
    await useSkillsStore.getState().fetchSkills();

    expect(hostApiFetchMock).toHaveBeenCalledWith('/api/clawhub/list');
    expect(hostApiFetchMock).toHaveBeenCalledWith('/api/skills/configs');
    const skills = useSkillsStore.getState().skills;
    expect(skills.some((s) => s.id === 'disk-only')).toBe(true);
    expect(skills.find((s) => s.id === 'disk-only')?.enabled).toBe(true);
  });

  it('respects config enabled false for disk-only skill', async () => {
    rpcMock.mockRejectedValueOnce(new Error('gateway down'));
    hostApiFetchMock.mockImplementation(async (path: string) => {
      if (path === '/api/clawhub/list') {
        return { success: true, results: [{ slug: 'off-skill', version: '1' }] };
      }
      if (path === '/api/skills/configs') {
        return { 'off-skill': { enabled: false } };
      }
      return {};
    });

    const { useSkillsStore } = await import('@/stores/skills');
    await useSkillsStore.getState().fetchSkills();

    const skill = useSkillsStore.getState().skills.find((s) => s.id === 'off-skill');
    expect(skill?.enabled).toBe(false);
  });
});
