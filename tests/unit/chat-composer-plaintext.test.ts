import { describe, expect, it } from 'vitest';
import {
  getPlainTextFromRoot,
  normalizeComposerPlainText,
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
