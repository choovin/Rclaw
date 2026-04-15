import { afterEach, describe, expect, it, vi } from 'vitest';

describe('getSkillHubSkillPageUrl', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('joins base without double slashes', async () => {
    vi.stubEnv('VITE_SKILL_HUB_BASE_URL', 'https://hub.example.com/');
    vi.resetModules();
    const { getSkillHubSkillPageUrl } = await import('@/lib/skillhub-url');
    expect(getSkillHubSkillPageUrl('my-skill')).toBe('https://hub.example.com/skills/my-skill');
  });

  it('returns null when env is missing or empty', async () => {
    vi.stubEnv('VITE_SKILL_HUB_BASE_URL', '');
    vi.resetModules();
    const { getSkillHubSkillPageUrl: emptyEnv } = await import('@/lib/skillhub-url');
    expect(emptyEnv('my-skill')).toBeNull();

    vi.unstubAllEnvs();
    vi.resetModules();
    const { getSkillHubSkillPageUrl: missingEnv } = await import('@/lib/skillhub-url');
    expect(missingEnv('my-skill')).toBeNull();
  });
});
