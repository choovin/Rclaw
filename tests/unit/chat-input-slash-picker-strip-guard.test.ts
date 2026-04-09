import { describe, expect, it } from 'vitest';
import { getSlashQueryAtCaret } from '@/pages/Chat/chat-composer-slash-query';
import { COMPOSER_ZWSP, parseSlashTokens } from '@/pages/Chat/chat-skill-command';

/** Mirrors ChatInput handleComposerChange guard before picker sync strip. */
function skipPickerStripBecauseCompleteToken(plain: string, caret: number): boolean {
  const qu = getSlashQueryAtCaret(plain, caret);
  if (!qu) {
    return false;
  }
  const completedAtSlash = parseSlashTokens(plain).find((tok) => tok.startIndex === qu.slashIndex);
  if (!completedAtSlash || caret < completedAtSlash.endIndexExclusive) {
    return false;
  }
  const j = completedAtSlash.endIndexExclusive;
  const ch = j < plain.length ? plain[j] : undefined;
  return (
    ch === ' ' ||
    ch === '\n' ||
    ch === '\r' ||
    ch === '\t' ||
    ch === COMPOSER_ZWSP
  );
}

describe('slash picker strip guard (ChatInput)', () => {
  it('skips strip when a full slash token ends at or before caret', () => {
    expect(skipPickerStripBecauseCompleteToken('hello /foo world', 10)).toBe(true);
  });

  it('does not skip while still typing a longer command', () => {
    expect(skipPickerStripBecauseCompleteToken('hello /foobar', 10)).toBe(false);
  });

  it('picker typing after / is unchanged', () => {
    expect(skipPickerStripBecauseCompleteToken('/fe', 3)).toBe(false);
  });

  it('skips strip when command is followed by ZWSP (composer chip)', () => {
    const s = `hello /foo${COMPOSER_ZWSP}bar`;
    // Caret immediately before ZWSP (suffix boundary): same offset as token endIndexExclusive.
    const caret = s.indexOf(COMPOSER_ZWSP);
    expect(skipPickerStripBecauseCompleteToken(s, caret)).toBe(true);
  });
});
