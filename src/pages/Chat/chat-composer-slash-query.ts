/** Detects inline `/command` typing (incomplete token) for slash menu. */

import { COMPOSER_ZWSP } from './chat-skill-command';

const PREFIX_BOUNDARY = new Set([' ', '\n', '\r', '\t', '(', '[', '{', '"', "'", COMPOSER_ZWSP]);

function isPrefixBoundaryChar(ch: string | undefined): boolean {
  if (ch == null) {
    return true;
  }
  return PREFIX_BOUNDARY.has(ch);
}

const MAX_CMD = 32;

/**
 * If the caret is immediately after a `/` that starts a slash command being typed
 * (only `[a-z0-9_]` between `/` and caret), returns the slash position and query segment.
 * Uses the **last** `/` before the caret with a valid prefix boundary (same spirit as `parseSlashTokens`).
 */
export function getSlashQueryAtCaret(text: string, caret: number): { slashIndex: number; query: string } | null {
  const t = text ?? '';
  const c = Math.max(0, Math.min(caret, t.length));
  const before = t.slice(0, c);
  let slashPos = -1;
  for (let i = before.length - 1; i >= 0; i--) {
    if (before[i] === '/') {
      slashPos = i;
      break;
    }
  }
  if (slashPos < 0) {
    return null;
  }
  const prev = slashPos === 0 ? undefined : before[slashPos - 1];
  if (!isPrefixBoundaryChar(prev)) {
    return null;
  }
  const cmdPart = before.slice(slashPos + 1);
  if (!/^[a-z0-9_]*$/.test(cmdPart)) {
    return null;
  }
  if (cmdPart.length > MAX_CMD) {
    return null;
  }
  return { slashIndex: slashPos, query: cmdPart };
}
