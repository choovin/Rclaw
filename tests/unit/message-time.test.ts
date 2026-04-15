import { describe, expect, it } from 'vitest';
import { maxRawMessageTimestampMs } from '@/stores/chat/message-time';
import type { RawMessage } from '@/stores/chat/types';

describe('maxRawMessageTimestampMs', () => {
  it('returns the latest timestamp when messages are not ordered by time', () => {
    const messages: RawMessage[] = [
      { role: 'user', content: 'a', timestamp: 1_700_000_000_000 },
      { role: 'assistant', content: 'b', timestamp: 1_700_000_009_000 },
      { role: 'user', content: 'c', timestamp: 1_700_000_005_000 },
    ];
    expect(maxRawMessageTimestampMs(messages)).toBe(1_700_000_009_000);
  });

  it('normalizes second-based timestamps', () => {
    const messages: RawMessage[] = [{ role: 'user', content: 'a', timestamp: 1_700_000_000 }];
    expect(maxRawMessageTimestampMs(messages)).toBe(1_700_000_000_000);
  });
});
