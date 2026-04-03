export function normalizeComposerPlainText(s: string): string {
  return String(s ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

export function getPlainTextFromRoot(el: HTMLElement): string {
  // JSDOM often leaves `innerText` empty while `textContent` reflects nodes; browsers prefer `innerText` for line breaks.
  const raw = el.innerText || el.textContent || '';
  return normalizeComposerPlainText(raw);
}

function isBoundaryInsideRoot(root: HTMLElement, node: Node | null): boolean {
  if (!node) {
    return false;
  }
  return node === root || root.contains(node);
}

/** Sum of lengths of all text nodes under `root` in document order. */
function getTotalTextLength(root: HTMLElement): number {
  let len = 0;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let n: Node | null;
  while ((n = walker.nextNode())) {
    len += (n as Text).length;
  }
  return len;
}

function getTextOffsetInRoot(root: HTMLElement, node: Node, offset: number): number {
  if (node.nodeType === Node.TEXT_NODE) {
    let total = 0;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let n: Node | null;
    while ((n = walker.nextNode())) {
      const tn = n as Text;
      if (tn === node) {
        const clamped = Math.min(Math.max(0, offset), tn.length);
        return total + clamped;
      }
      total += tn.length;
    }
    return total;
  }

  const range = document.createRange();
  range.setStart(root, 0);
  range.setEnd(node, offset);
  return range.toString().length;
}

/**
 * Maps a character offset in the concatenation of text nodes under `root` to a DOM boundary.
 * When there is no text, returns `(root, 0)` for a collapsed range inside the empty root.
 */
function offsetToNodeBoundary(root: HTMLElement, offset: number): [Node, number] {
  const total = getTotalTextLength(root);
  const off = Math.max(0, Math.min(offset, total));
  if (total === 0) {
    return [root, 0];
  }

  let seen = 0;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let n: Node | null;
  while ((n = walker.nextNode())) {
    const tn = n as Text;
    const next = seen + tn.length;
    if (off <= next) {
      return [tn, off - seen];
    }
    seen = next;
  }

  const lastWalker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let last: Node | null = null;
  while ((n = lastWalker.nextNode())) {
    last = n;
  }
  if (last && last.nodeType === Node.TEXT_NODE) {
    const t = last as Text;
    return [t, t.length];
  }
  return [root, 0];
}

/**
 * Returns start/end offsets (in root text-node order, 0-based, end exclusive) for the current
 * window selection, or `null` if the caret/selection is not fully inside `root`.
 */

/**
 * Caret rectangle at the **focus end** of the current selection, if it lies inside `root`.
 * JSDOM may omit `getClientRects` on Range; fall back to `getBoundingClientRect`.
 */
export function getCaretRectFromDomSelection(root: HTMLElement): DOMRect | null {
  try {
    if (typeof window === 'undefined') {
      return null;
    }
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) {
      return null;
    }
    const range = sel.getRangeAt(0).cloneRange();
    if (!root.contains(range.commonAncestorContainer)) {
      return null;
    }
    range.collapse(false);
    if (typeof range.getClientRects === 'function') {
      try {
        const rects = range.getClientRects();
        if (rects.length > 0) {
          return rects[rects.length - 1]!;
        }
      } catch {
        /* ignore */
      }
    }
    if (typeof range.getBoundingClientRect !== 'function') {
      return null;
    }
    const br = range.getBoundingClientRect();
    if (br.width === 0 && br.height === 0) {
      return null;
    }
    return br;
  } catch {
    return null;
  }
}

export function getOffsetsFromSelection(root: HTMLElement): { start: number; end: number } | null {
  const sel = typeof window !== 'undefined' ? window.getSelection() : null;
  if (!sel || sel.rangeCount === 0) {
    return null;
  }

  const anchorNode = sel.anchorNode;
  const focusNode = sel.focusNode;
  if (!isBoundaryInsideRoot(root, anchorNode) || !isBoundaryInsideRoot(root, focusNode)) {
    return null;
  }

  const a = getTextOffsetInRoot(root, anchorNode!, sel.anchorOffset);
  const b = getTextOffsetInRoot(root, focusNode!, sel.focusOffset);
  const start = Math.min(a, b);
  const end = Math.max(a, b);
  return { start, end };
}

/**
 * Sets the window selection to the given character offsets within `root`'s text-node content.
 * Offsets are clamped to `[0, totalLength]`; if `start > end` after clamping, they are swapped.
 */
export function setSelectionFromOffsets(root: HTMLElement, start: number, end: number): void {
  const total = getTotalTextLength(root);
  let s = Math.max(0, Math.min(start, total));
  let e = Math.max(0, Math.min(end, total));
  if (s > e) {
    const t = s;
    s = e;
    e = t;
  }

  const [startNode, startOff] = offsetToNodeBoundary(root, s);
  const [endNode, endOff] = offsetToNodeBoundary(root, e);

  const range = document.createRange();
  range.setStart(startNode, startOff);
  range.setEnd(endNode, endOff);

  const sel = typeof window !== 'undefined' ? window.getSelection() : null;
  if (!sel) {
    return;
  }
  sel.removeAllRanges();
  sel.addRange(range);
}
