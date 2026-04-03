import { describe, expect, it } from 'vitest';
import {
  getOffsetsFromSelection,
  getPlainTextFromRoot,
  normalizeComposerPlainText,
  repairComposerPlainTextIfCaretArtifact,
  setSelectionFromOffsets,
} from '@/pages/Chat/chat-composer-plaintext';
import { parseSlashTokens } from '@/pages/Chat/chat-skill-command';

describe('normalizeComposerPlainText', () => {
  it('normalizes CRLF to LF', () => {
    expect(normalizeComposerPlainText('a\r\nb')).toBe('a\nb');
  });

  it('normalizes standalone CR to LF', () => {
    expect(normalizeComposerPlainText('a\rb')).toBe('a\nb');
  });

  it('does not strip other content', () => {
    expect(normalizeComposerPlainText('  x\t')).toBe('  x\t');
  });

  it('keeps parseSlashTokens results aligned after CRLF normalization', () => {
    const raw = '/feishu\r\nx';
    const normalized = normalizeComposerPlainText(raw);
    expect(normalized).toBe('/feishu\nx');
    expect(parseSlashTokens(normalized)).toEqual(parseSlashTokens(raw));
    expect(parseSlashTokens(normalized)).toMatchObject([
      { startIndex: 0, endIndexExclusive: 7, text: '/feishu' },
    ]);
  });
});

describe('getPlainTextFromRoot', () => {
  it('returns innerText passed through normalizeComposerPlainText', () => {
    const root = document.createElement('div');
    root.innerText = 'a\r\nb';
    expect(getPlainTextFromRoot(root)).toBe(normalizeComposerPlainText(root.innerText));
    expect(getPlainTextFromRoot(root)).toBe('a\nb');
  });
});

describe('repairComposerPlainTextIfCaretArtifact', () => {
  it('removes a single ASCII space inserted between newline and following char', () => {
    const root = document.createElement('div');
    root.appendChild(document.createTextNode('\n a'));
    expect(repairComposerPlainTextIfCaretArtifact(root, '\na')).toBe(true);
    expect(getPlainTextFromRoot(root)).toBe('\na');
  });

  it('removes a single NBSP when it is the only extra character', () => {
    const root = document.createElement('div');
    root.appendChild(document.createTextNode('\n\u00a0a'));
    expect(repairComposerPlainTextIfCaretArtifact(root, '\na')).toBe(true);
    expect(getPlainTextFromRoot(root)).toBe('\na');
  });

  it('returns false when mismatch is not a single space artifact', () => {
    const root = document.createElement('div');
    root.appendChild(document.createTextNode('ab'));
    expect(repairComposerPlainTextIfCaretArtifact(root, 'a')).toBe(false);
    expect(getPlainTextFromRoot(root)).toBe('ab');
  });
});

describe('getOffsetsFromSelection / setSelectionFromOffsets', () => {
  it('reads collapsed caret offset (hello world @ 6)', () => {
    const root = document.createElement('div');
    root.textContent = 'hello world';
    document.body.append(root);

    setSelectionFromOffsets(root, 6, 6);
    expect(getOffsetsFromSelection(root)).toEqual({ start: 6, end: 6 });

    root.remove();
  });

  it('reads a range spanning "wor" (offsets 6–9)', () => {
    const root = document.createElement('div');
    root.textContent = 'hello world';
    document.body.append(root);

    setSelectionFromOffsets(root, 6, 9);
    expect(getOffsetsFromSelection(root)).toEqual({ start: 6, end: 9 });

    root.remove();
  });

  it('round-trips arbitrary offsets', () => {
    const root = document.createElement('div');
    root.textContent = 'hello world';
    document.body.append(root);

    const pairs: Array<[number, number]> = [
      [0, 0],
      [0, 5],
      [6, 11],
      [2, 8],
    ];
    for (const [a, b] of pairs) {
      setSelectionFromOffsets(root, a, b);
      expect(getOffsetsFromSelection(root)).toEqual({
        start: Math.min(a, b),
        end: Math.max(a, b),
      });
    }

    root.remove();
  });

  it('handles nested split text nodes (span) and round-trips', () => {
    const root = document.createElement('div');
    root.innerHTML = 'hello <span>wo</span>rld';
    document.body.append(root);

    const total = 'hello world'.length;
    expect(total).toBe(11);

    setSelectionFromOffsets(root, 6, 9);
    expect(getOffsetsFromSelection(root)).toEqual({ start: 6, end: 9 });

    setSelectionFromOffsets(root, 11, 11);
    expect(getOffsetsFromSelection(root)).toEqual({ start: 11, end: 11 });

    setSelectionFromOffsets(root, 0, 11);
    expect(getOffsetsFromSelection(root)).toEqual({ start: 0, end: 11 });

    root.remove();
  });

  it('returns null when selection anchor is outside root', () => {
    const root = document.createElement('div');
    root.textContent = 'inside';
    const outside = document.createElement('div');
    outside.textContent = 'outside';
    document.body.append(root, outside);

    const range = document.createRange();
    range.selectNodeContents(outside.firstChild as Text);
    const sel = window.getSelection()!;
    sel.removeAllRanges();
    sel.addRange(range);

    expect(getOffsetsFromSelection(root)).toBeNull();

    root.remove();
    outside.remove();
  });
});
