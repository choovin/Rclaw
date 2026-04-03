export type Selection = { start: number; end: number };
export type SlashToken = { startIndex: number; endIndexExclusive: number; text: string };

const MAX_CMD_LEN = 32;
const CMD_RE = /^[a-z0-9_]{1,32}$/;
const PREFIX_BOUNDARY = new Set([' ', '\n', '\r', '\t', '(', '[', '{', '"', "'"]);

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
  return ch == null || ch === ' ' || ch === '\n' || ch === '\r' || ch === '\t';
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
      if (ch === ' ' || ch === '\n' || ch === '\r' || ch === '\t') break;
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

export function deleteTokenAtRange(
  value: string,
  token: Pick<SlashToken, 'startIndex' | 'endIndexExclusive'>,
  selection: Selection,
): { nextValue: string; nextSelection: Selection } {
  const v = value ?? '';
  const startIndex = Math.max(0, Math.min(token.startIndex, v.length));
  const endIndexExclusive = Math.max(startIndex, Math.min(token.endIndexExclusive, v.length));
  const after = v.slice(endIndexExclusive);
  const dropSpace = after.startsWith(' ') ? 1 : 0;
  const nextValue = v.slice(0, startIndex) + after.slice(dropSpace);

  const removedLen = endIndexExclusive - startIndex + dropSpace;
  const selStart = Math.max(0, Math.min(selection.start, v.length));
  const selEnd = Math.max(0, Math.min(selection.end, v.length));
  const lo = Math.min(selStart, selEnd);
  const hi = Math.max(selStart, selEnd);

  let nextCaret = startIndex;
  if (lo >= endIndexExclusive + dropSpace) {
    nextCaret = lo - removedLen;
  } else if (hi <= startIndex) {
    nextCaret = lo;
  } else {
    nextCaret = startIndex;
  }
  nextCaret = Math.max(0, Math.min(nextCaret, nextValue.length));
  return { nextValue, nextSelection: { start: nextCaret, end: nextCaret } };
}
