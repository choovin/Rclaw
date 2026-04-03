import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import {
  deleteTokenAtRange,
  insertAtSelection,
  normalizeCommandName,
  parseSlashTokens,
} from '@/pages/Chat/chat-skill-command';
import { SkillPickerPopover } from '@/pages/Chat/SkillPickerPopover';

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

describe('SkillPickerPopover', () => {
  it('shows enabled skills, filters by search, calls onPick with commandName', () => {
    const onPick = vi.fn();
    const onOpenSkills = vi.fn();

    render(
      <SkillPickerPopover
        open
        skills={[
          { id: 'feishu', slug: 'feishu', name: 'Feishu', description: 'desc', enabled: true, icon: '⚙️' },
          {
            id: 'tavily-search',
            slug: 'tavily-search',
            name: 'Tavily',
            description: 'search',
            enabled: true,
            icon: '⚡',
          },
          { id: 'disabled', slug: 'disabled', name: 'Disabled', description: 'x', enabled: false, icon: '❌' },
        ]}
        onPick={onPick}
        onOpenSkills={onOpenSkills}
        onClose={() => {}}
        searchPlaceholder="搜索技能"
        skillsLibraryLabel="技能库"
        emptyEnabledLabel="暂无可用技能"
        noResultsLabel="未找到技能"
      />,
    );

    expect(screen.queryByText('/disabled')).toBeNull();
    expect(screen.getByText('/feishu')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('搜索技能'), { target: { value: 'tavily' } });
    expect(screen.queryByText('/feishu')).toBeNull();
    expect(screen.getByText('/tavily_search')).toBeInTheDocument();

    fireEvent.click(screen.getByText('/tavily_search'));
    expect(onPick).toHaveBeenCalledWith({ commandName: 'tavily_search', display: '/tavily_search' });

    fireEvent.click(screen.getByText('技能库'));
    expect(onOpenSkills).toHaveBeenCalled();
  });
});
