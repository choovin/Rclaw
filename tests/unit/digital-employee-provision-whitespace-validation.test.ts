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

  it('rejects missing vibe', async () => {
    await expect(
      provisionDigitalEmployeeAgent({
        nameZh: '人类学家',
        nameEn: 'Anthropologist',
        soulContent: '## soul',
        agentsContent: '## agents',
        identityContent: 'vibe',
        emoji: '🌍',
        // @ts-expect-error - test missing vibe
        vibe: undefined,
      }),
    ).rejects.toThrow(/vibe/i);
  });
});

