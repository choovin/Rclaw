import { describe, expect, it } from 'vitest';
import { provisionDigitalEmployeeAgent } from '@electron/utils/agent-config';

describe('digital employee provision validation', () => {
  it('rejects whitespace-only soulContent', async () => {
    await expect(
      provisionDigitalEmployeeAgent({
        nameZh: '人类学家',
        nameEn: 'Anthropologist',
        soulContent: '   ',
        agentsContent: '## agents',
        identityContent: 'vibe',
        emoji: '🌍',
        vibe: 'vibe',
      }),
    ).rejects.toThrow(/soulContent/i);
  });

});

