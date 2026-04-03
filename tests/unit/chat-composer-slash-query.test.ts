import { describe, expect, it } from 'vitest';
import { getSlashQueryAtCaret } from '@/pages/Chat/chat-composer-slash-query';
import { COMPOSER_ZWSP } from '@/pages/Chat/chat-skill-command';

describe('getSlashQueryAtCaret', () => {
  it('returns query when typing after / with valid prefix', () => {
    expect(getSlashQueryAtCaret('/fe', 3)).toEqual({ slashIndex: 0, query: 'fe' });
    expect(getSlashQueryAtCaret('hello /fe', 9)).toEqual({ slashIndex: 6, query: 'fe' });
  });

  it('returns empty query for lone /', () => {
    expect(getSlashQueryAtCaret('/', 1)).toEqual({ slashIndex: 0, query: '' });
  });

  it('returns null for URL-like slash', () => {
    expect(getSlashQueryAtCaret('http://a', 8)).toBeNull();
  });

  it('returns null when slash is part of path without boundary', () => {
    expect(getSlashQueryAtCaret('foo/bar', 7)).toBeNull();
  });

  it('returns null when caret is before the slash', () => {
    expect(getSlashQueryAtCaret('/fe', 0)).toBeNull();
  });

  it('returns null when ZWSP breaks cmd segment after a slash (post-chip typing)', () => {
    const s = `/feishu${COMPOSER_ZWSP}hello`;
    expect(getSlashQueryAtCaret(s, s.length)).toBeNull();
  });
});
