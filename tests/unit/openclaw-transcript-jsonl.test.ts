import { describe, expect, it } from 'vitest';
import { parseOpenClawTranscriptJsonlToMessages } from '@electron/utils/openclaw-transcript-jsonl';

describe('parseOpenClawTranscriptJsonlToMessages', () => {
  it('accepts lines without type field when message is present', () => {
    const raw = [
      JSON.stringify({
        timestamp: '2026-01-01T00:00:00.000Z',
        message: { role: 'user', content: 'hi', timestamp: 1 },
      }),
    ].join('\n');
    const msgs = parseOpenClawTranscriptJsonlToMessages(raw, 200);
    expect(msgs).toHaveLength(1);
    expect((msgs[0] as { role?: string }).role).toBe('user');
  });

  it('still accepts type:message wrapper', () => {
    const raw = [
      JSON.stringify({
        type: 'message',
        message: { role: 'assistant', content: 'ok', timestamp: 2 },
      }),
    ].join('\n');
    const msgs = parseOpenClawTranscriptJsonlToMessages(raw, 200);
    expect(msgs).toHaveLength(1);
    expect((msgs[0] as { role?: string }).role).toBe('assistant');
  });

  it('skips non-message line types', () => {
    const raw = [
      JSON.stringify({ type: 'meta', foo: 1 }),
      JSON.stringify({ message: { role: 'user', content: 'x', timestamp: 1 } }),
    ].join('\n');
    const msgs = parseOpenClawTranscriptJsonlToMessages(raw, 200);
    expect(msgs).toHaveLength(1);
  });

  it('respects limit from the tail', () => {
    const lines = [];
    for (let i = 0; i < 5; i += 1) {
      lines.push(JSON.stringify({ message: { role: 'user', content: String(i), timestamp: i } }));
    }
    const raw = lines.join('\n');
    const msgs = parseOpenClawTranscriptJsonlToMessages(raw, 2);
    expect(msgs).toHaveLength(2);
    expect((msgs[1] as { content?: string }).content).toBe('4');
  });
});
