import { describe, expect, it } from 'vitest';
import {
  adjustCaretForComposerZwspBeforeSlashTokens,
  ensureComposerZwspAfterSlashTokens,
  ensureComposerZwspBeforeSlashTokens,
  getComposerSlashChipDeletionSpans,
  parseSlashTokens,
  resolveComposerArrowCaretOffset,
} from '@/pages/Chat/chat-skill-command';

const chipFoo = new Set(['foo']);

describe('ensureComposerZwspBeforeSlashTokens', () => {
  it('repairs prefix when user typed before / so token parses again', () => {
    const broken = 'hello x/foo ';
    const fixed = ensureComposerZwspBeforeSlashTokens(broken, chipFoo);
    expect(fixed).toBe('hello x\u200b/foo ');
    expect(parseSlashTokens(fixed).length).toBe(1);
  });

  it('does not insert when prefix is already a boundary', () => {
    const ok = 'hello /foo ';
    expect(ensureComposerZwspBeforeSlashTokens(ok, chipFoo)).toBe(ok);
  });
});

describe('adjustCaretForComposerZwspBeforeSlashTokens', () => {
  it('shifts caret after inserted zwsp when caret was past the slash', () => {
    const plain = 'hello x/foo ';
    const caret = plain.indexOf('/') + 1;
    const next = adjustCaretForComposerZwspBeforeSlashTokens(plain, caret, chipFoo);
    expect(next).toBe(caret + 1);
  });
});

describe('resolveComposerArrowCaretOffset', () => {
  it('ArrowLeft from end of chip block jumps to block start', () => {
    const plain = ensureComposerZwspAfterSlashTokens(' /foo ', chipFoo);
    const spans = getComposerSlashChipDeletionSpans(plain, chipFoo);
    expect(spans.length).toBe(1);
    const sp = spans[0]!;
    const left = resolveComposerArrowCaretOffset(plain, sp.endExclusive, 'left', chipFoo);
    expect(left).toBe(sp.start);
  });

  it('ArrowRight from just before chip jumps past chip', () => {
    const plain = ensureComposerZwspAfterSlashTokens('hi /foo ', chipFoo);
    const spans = getComposerSlashChipDeletionSpans(plain, chipFoo);
    const sp = spans[0]!;
    const right = resolveComposerArrowCaretOffset(plain, sp.start - 1, 'right', chipFoo);
    expect(right).toBe(sp.endExclusive);
  });
});
