import { describe, expect, it } from 'vitest';
import { buildComposerBody } from '@/pages/Chat/chat-composer-decoration';

describe('buildComposerBody', () => {
  it('renders /feishu as one chip and preserves slash command in fragment text', () => {
    const plain = '/feishu ';
    const frag = buildComposerBody(plain);
    expect(frag.textContent).toContain('/feishu');
    const chips = Array.from(frag.querySelectorAll('[data-testid="chat-skill-chip"]'));
    expect(chips).toHaveLength(1);
  });

  it('does not treat slashes inside URLs as slash commands', () => {
    const plain = 'http://a/b ';
    const frag = buildComposerBody(plain);
    const chips = frag.querySelectorAll('[data-testid="chat-skill-chip"]');
    expect(chips.length).toBe(0);
    expect(frag.textContent).toBe(plain);
  });

  it('serializes fragment textContent back to plainText for tokens and spaces', () => {
    const cases = ['/feishu ', 'before /x after', '/a /b '];
    for (const plain of cases) {
      const frag = buildComposerBody(plain);
      expect(frag.textContent).toBe(plain);
    }
  });

  it('omits remove button when showRemoveButtons is false', () => {
    const frag = buildComposerBody('/x ', { showRemoveButtons: false });
    expect(frag.querySelector('[data-testid="chat-skill-chip-remove"]')).toBeNull();
    expect(frag.textContent).toBe('/x ');
  });
});
