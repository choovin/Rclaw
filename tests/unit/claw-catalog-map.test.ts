import { describe, expect, it } from 'vitest';
import { mapCatalogAgentToEmployee } from '@/lib/claw-catalog-map';
import type { ClawCatalogAgent } from '@/types/claw-catalog';

function minimalAgent(over: Partial<ClawCatalogAgent> = {}): ClawCatalogAgent {
  return {
    id: 1,
    bundleId: 'acme-demo-worker',
    version: '1.0.0',
    name: 'Demo',
    nameZh: '演示',
    description: 'en',
    descriptionZh: '中文简介',
    avatar: '',
    systemPrompt: 'sys',
    requiredSkills: '["a","b"]',
    requiredChannels: '[]',
    scenario: null,
    tags: '[]',
    tier: 'free',
    permissionProfile: 'default',
    isOfficial: 1,
    status: 1,
    downloadCount: 0,
    rating: 5,
    createTime: 0,
    updateTime: 0,
    departmentId: 18,
    department: 'academic',
    departmentNameZh: '学术',
    color: 'green',
    emoji: '🎓',
    vibe: 'calm',
    vibeZh: '沉稳',
    soulContent: 'soul',
    agentsContent: 'agents',
    identityContent: 'id',
    ...over,
  };
}

describe('mapCatalogAgentToEmployee', () => {
  it('sets id to bundleId', () => {
    const e = mapCatalogAgentToEmployee(minimalAgent({ bundleId: 'my-bundle-id' }));
    expect(e.id).toBe('my-bundle-id');
  });

  it('parses requiredSkills JSON', () => {
    const e = mapCatalogAgentToEmployee(minimalAgent({ requiredSkills: '["x","y"]' }));
    expect(e.skills).toEqual(['x', 'y']);
  });

  it('uses department code string', () => {
    const e = mapCatalogAgentToEmployee(minimalAgent({ department: 'engineering' }));
    expect(e.department).toBe('engineering');
    expect(e.departmentId).toBe(18);
  });
});
