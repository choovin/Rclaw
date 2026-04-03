import { describe, expect, it } from 'vitest';
import {
  deleteTokenAtRange,
  insertAtSelection,
  normalizeCommandName,
  parseSlashTokens,
} from '@/pages/Chat/chat-skill-command';

describe('chat-skill-command', () => {
  it('normalizeCommandName: lowercases, replaces invalid chars with _, truncates 32', () => {
    expect(normalizeCommandName('Feishu')).toBe('feishu');
    expect(normalizeCommandName('tavily-search')).toBe('tavily_search');
    expect(normalizeCommandName('a'.repeat(40))).toBe('a'.repeat(32));
  });

  it('parseSlashTokens: recognizes token only with prefix boundary + suffix boundary (space/newline/EOF)', () => {
    expect(parseSlashTokens('/feishu ')).toMatchObject([
      { startIndex: 0, endIndexExclusive: 7, text: '/feishu' },
    ]);
    expect(parseSlashTokens('use /feishu ')).toHaveLength(1);
    expect(parseSlashTokens('http://a/b ')).toHaveLength(0);
    expect(parseSlashTokens('foo/bar ')).toHaveLength(0);
    expect(parseSlashTokens('/feishu,')).toHaveLength(0);
  });

  it('parseSlashTokens: treats CRLF after command as valid suffix boundary', () => {
    expect(parseSlashTokens('/feishu\r\nx')).toMatchObject([
      { startIndex: 0, endIndexExclusive: 7, text: '/feishu' },
    ]);
  });

  it('insertAtSelection: inserts at caret or replaces selection and returns next selection', () => {
    const r1 = insertAtSelection('hello world', { start: 6, end: 6 }, '/feishu ');
    expect(r1.nextValue).toBe('hello /feishu world');
    expect(r1.nextSelection).toEqual({ start: 14, end: 14 });

    const r2 = insertAtSelection('hello world', { start: 0, end: 6 }, '/feishu ');
    expect(r2.nextValue).toBe('/feishu world');
    expect(r2.nextSelection).toEqual({ start: 8, end: 8 });
  });

  it('deleteTokenAtRange: deletes token and one trailing space only, updates selection deterministically', () => {
    const value = '/a /a test';
    const tokens = parseSlashTokens(value);
    expect(tokens).toHaveLength(2);
    const del = deleteTokenAtRange(
      value,
      { startIndex: tokens[1]!.startIndex, endIndexExclusive: tokens[1]!.endIndexExclusive },
      { start: value.length, end: value.length },
    );
    expect(del.nextValue).toBe('/a test');
    // 光标原在串尾；删除中间 token 后应落在新的串尾
    expect(del.nextSelection).toEqual({ start: del.nextValue.length, end: del.nextValue.length });
  });
});
