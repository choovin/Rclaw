export type Selection = { start: number; end: number };
export type SlashToken = { startIndex: number; endIndexExclusive: number; text: string };

/** Inserted before/after skill slash segments so typed text cannot merge into the chip. */
export const COMPOSER_ZWSP = '\u200b';

const MAX_CMD_LEN = 32;
const CMD_RE = /^[a-z0-9_]{1,32}$/;
const PREFIX_BOUNDARY = new Set([' ', '\n', '\r', '\t', '(', '[', '{', '"', "'", COMPOSER_ZWSP]);

export function normalizeCommandName(raw: string): string {
  const s = (raw ?? '').toLowerCase();
  const replaced = s.replace(/[^a-z0-9_]+/g, '_');
  return replaced.slice(0, MAX_CMD_LEN);
}

function isPrefixBoundaryChar(ch: string | undefined): boolean {
  if (ch == null) return true;
  return PREFIX_BOUNDARY.has(ch);
}

function isSuffixBoundaryChar(ch: string | undefined): boolean {
  return ch == null || ch === ' ' || ch === '\n' || ch === '\r' || ch === '\t' || ch === COMPOSER_ZWSP;
}

function isSlashTokenSuffixWhitespace(ch: string): boolean {
  return ch === ' ' || ch === '\n' || ch === '\r' || ch === '\t';
}

export function parseSlashTokens(value: string): SlashToken[] {
  const text = value ?? '';
  const tokens: SlashToken[] = [];
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== '/') continue;
    const prev = i === 0 ? undefined : text[i - 1];
    if (!isPrefixBoundaryChar(prev)) continue;
    let j = i + 1;
    while (j < text.length) {
      const ch = text[j]!;
      if (ch === ' ' || ch === '\n' || ch === '\r' || ch === '\t' || ch === COMPOSER_ZWSP) break;
      if (!/[a-z0-9_]/.test(ch)) {
        j = -1;
        break;
      }
      j++;
      if (j - (i + 1) > MAX_CMD_LEN) {
        j = -1;
        break;
      }
    }
    if (j === -1) continue;
    const cmd = text.slice(i + 1, j);
    if (!CMD_RE.test(cmd)) continue;
    const next = j < text.length ? text[j] : undefined;
    if (!isSuffixBoundaryChar(next)) continue;
    tokens.push({ startIndex: i, endIndexExclusive: j, text: text.slice(i, j) });
    i = j - 1;
  }
  return tokens;
}

/**
 * Builds clipboard text for `value[start:end)` by omitting characters that belong to parsed slash
 * tokens (chip payload), so chip content is never copied even on Ctrl+A.
 */
export function stripSlashTokensFromRange(value: string, start: number, end: number): string {
  const text = value ?? '';
  const s = Math.max(0, Math.min(start, text.length));
  const e = Math.max(0, Math.min(end, text.length));
  if (s >= e) {
    return '';
  }
  const tokens = parseSlashTokens(text);
  let out = '';
  for (let i = s; i < e; i++) {
    if (tokens.some((t) => i >= t.startIndex && i < t.endIndexExclusive)) {
      continue;
    }
    out += text[i];
  }
  return out;
}

/**
 * Trims composer ZWSP and ensures a normal space after each slash token when the next character
 * is not already whitespace, so sent text is `/cmd rest` instead of `/cmdrest`.
 */
export function formatComposerTextForSend(trimmedComposer: string): string {
  const value = trimmedComposer ?? '';
  const tokens = parseSlashTokens(value);
  if (tokens.length === 0) {
    return value.replaceAll(COMPOSER_ZWSP, '');
  }
  let out = value;
  const sorted = [...tokens].sort((a, b) => b.endIndexExclusive - a.endIndexExclusive);
  for (const t of sorted) {
    const j = t.endIndexExclusive;
    if (j >= out.length || out[j] !== COMPOSER_ZWSP) {
      continue;
    }
    const next = out[j + 1];
    if (
      next != null &&
      next !== COMPOSER_ZWSP &&
      next !== ' ' &&
      next !== '\n' &&
      next !== '\r' &&
      next !== '\t'
    ) {
      out = out.slice(0, j + 1) + ' ' + out.slice(j + 1);
    }
  }
  return out.replaceAll(COMPOSER_ZWSP, '');
}

/**
 * Ensures {@link COMPOSER_ZWSP} sits after the slash token's suffix boundary so typed text
 * cannot merge into the chip: prefer ` /cmd␠\u200b` (ZWSP after the delimiter space), not before it.
 */
export function ensureComposerZwspAfterSlashTokens(value: string): string {
  const tokens = parseSlashTokens(value);
  if (tokens.length === 0) {
    return value;
  }
  let out = value;
  const sorted = [...tokens].sort((a, b) => b.endIndexExclusive - a.endIndexExclusive);
  for (const t of sorted) {
    const j = t.endIndexExclusive;
    if (j > out.length) {
      continue;
    }
    if (j === out.length) {
      out = out + COMPOSER_ZWSP;
      continue;
    }
    const ch = out[j]!;
    if (isSlashTokenSuffixWhitespace(ch)) {
      const afterSpace = j + 1;
      const nextCh = afterSpace < out.length ? out[afterSpace] : undefined;
      if (nextCh !== COMPOSER_ZWSP) {
        out = out.slice(0, afterSpace) + COMPOSER_ZWSP + out.slice(afterSpace);
      }
    } else if (ch !== COMPOSER_ZWSP) {
      out = out.slice(0, j) + COMPOSER_ZWSP + out.slice(j);
    }
  }
  return out;
}

/** Maps a caret/offset in `plainBefore` to the same logical position after {@link ensureComposerZwspAfterSlashTokens}. */
export function adjustCaretForComposerZwsp(plainBefore: string, caret: number): number {
  const tokens = parseSlashTokens(plainBefore);
  let delta = 0;
  for (const t of tokens) {
    const j = t.endIndexExclusive;
    if (j > plainBefore.length) {
      continue;
    }
    if (j === plainBefore.length) {
      if (caret >= j) {
        delta++;
      }
      continue;
    }
    const ch = plainBefore[j]!;
    if (isSlashTokenSuffixWhitespace(ch)) {
      const afterSpace = j + 1;
      const nextCh = afterSpace < plainBefore.length ? plainBefore[afterSpace] : undefined;
      if (nextCh !== COMPOSER_ZWSP && caret >= afterSpace) {
        delta++;
      }
    } else if (ch !== COMPOSER_ZWSP && caret >= j) {
      delta++;
    }
  }
  return caret + delta;
}

export function insertAtSelection(
  value: string,
  selection: Selection,
  insertText: string,
): { nextValue: string; nextSelection: Selection } {
  const v = value ?? '';
  const start = Math.max(0, Math.min(selection.start, v.length));
  const end = Math.max(0, Math.min(selection.end, v.length));
  const lo = Math.min(start, end);
  const hi = Math.max(start, end);
  const nextValue = v.slice(0, lo) + insertText + v.slice(hi);
  const caret = lo + insertText.length;
  return { nextValue, nextSelection: { start: caret, end: caret } };
}

/** Full `[start, endExclusive)` slice removed by {@link deleteTokenAtRange} (leading ZWSP + token + trailing space/ZWSP). */
export function getTokenDeletionSpan(
  v: string,
  token: Pick<SlashToken, 'startIndex' | 'endIndexExclusive'>,
): { start: number; endExclusive: number } {
  const value = v ?? '';
  const startIndex = Math.max(0, Math.min(token.startIndex, value.length));
  let deleteStart = startIndex;
  if (startIndex > 0 && value[startIndex - 1] === COMPOSER_ZWSP) {
    deleteStart = startIndex - 1;
  }
  const endIndexExclusive = Math.max(startIndex, Math.min(token.endIndexExclusive, value.length));
  const after = value.slice(endIndexExclusive);
  let dropAfter = 0;
  if (after.startsWith(' ')) {
    dropAfter = 1;
    if (after.slice(1).startsWith(COMPOSER_ZWSP)) {
      dropAfter = 2;
    }
  } else if (after.startsWith(COMPOSER_ZWSP)) {
    dropAfter = 1;
  }
  return { start: deleteStart, endExclusive: endIndexExclusive + dropAfter };
}

/**
 * If Backspace would delete a character inside the removable skill segment, return that token
 * so the caller can delete the whole segment in one step.
 */
export function findSlashTokenForBackspaceDelete(v: string, caret: number): SlashToken | null {
  if (caret <= 0) {
    return null;
  }
  const delIndex = caret - 1;
  const value = v ?? '';
  const tokens = parseSlashTokens(value);
  for (const t of tokens) {
    const span = getTokenDeletionSpan(value, t);
    if (delIndex >= span.start && delIndex < span.endExclusive) {
      return t;
    }
  }
  return null;
}

export function deleteTokenAtRange(
  value: string,
  token: Pick<SlashToken, 'startIndex' | 'endIndexExclusive'>,
  selection: Selection,
): { nextValue: string; nextSelection: Selection } {
  const v = value ?? '';
  const span = getTokenDeletionSpan(v, token);
  const nextValue = v.slice(0, span.start) + v.slice(span.endExclusive);
  const removedLen = span.endExclusive - span.start;
  const selStart = Math.max(0, Math.min(selection.start, v.length));
  const selEnd = Math.max(0, Math.min(selection.end, v.length));
  const lo = Math.min(selStart, selEnd);
  const hi = Math.max(selStart, selEnd);

  let nextCaret: number;
  if (lo >= span.endExclusive) {
    nextCaret = lo - removedLen;
  } else if (hi <= span.start) {
    nextCaret = lo;
  } else {
    nextCaret = span.start;
  }
  nextCaret = Math.max(0, Math.min(nextCaret, nextValue.length));
  return { nextValue, nextSelection: { start: nextCaret, end: nextCaret } };
}
