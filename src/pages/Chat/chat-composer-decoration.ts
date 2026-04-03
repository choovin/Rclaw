import { parseSlashTokens, type SlashToken } from './chat-skill-command';

type SlashMirrorPart = { kind: 'text'; text: string } | { kind: 'token'; token: SlashToken };

function buildSlashMirrorParts(value: string): SlashMirrorPart[] {
  const text = value ?? '';
  const tokens = parseSlashTokens(text);
  const parts: SlashMirrorPart[] = [];
  let i = 0;
  for (const token of tokens) {
    if (i < token.startIndex) {
      parts.push({ kind: 'text', text: text.slice(i, token.startIndex) });
    }
    parts.push({ kind: 'token', token });
    i = token.endIndexExclusive;
  }
  if (i < text.length) {
    parts.push({ kind: 'text', text: text.slice(i) });
  }
  return parts;
}

function appendLucideXIcon(button: HTMLButtonElement): void {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'h-2.5 w-2.5');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M18 6 6 18M6 6l12 12');
  svg.appendChild(path);
  button.appendChild(svg);
}

export type BuildComposerBodyOptions = {
  showRemoveButtons?: boolean;
  /** 有值时写入删除按钮的 `aria-label` */
  removeButtonAriaLabel?: string;
};

const OUTER_CHIP_CLASS = 'group relative inline max-w-full align-baseline';
const INNER_LABEL_CLASS =
  'rounded-md bg-secondary/80 text-foreground ring-1 ring-inset ring-border/50';
const REMOVE_BTN_CLASS =
  'pointer-events-auto absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full border border-border/60 bg-card text-muted-foreground opacity-0 shadow-sm transition-opacity hover:text-foreground group-hover:opacity-100';

/**
 * 将纯文本中的完整 slash token 渲染为 chip DOM，其余为 `Text` 节点。
 * 删除按钮使用 SVG 图标，避免向 `textContent` 注入额外字符，便于与 `plainText` 对齐。
 */
export function buildComposerBody(
  plainText: string,
  options?: BuildComposerBodyOptions,
): DocumentFragment {
  const showRemoveButtons = options?.showRemoveButtons !== false;
  const removeButtonAriaLabel = options?.removeButtonAriaLabel ?? '';
  const parts = buildSlashMirrorParts(plainText);
  const frag = document.createDocumentFragment();

  for (const part of parts) {
    if (part.kind === 'text') {
      if (part.text.length > 0) {
        frag.appendChild(document.createTextNode(part.text));
      }
      continue;
    }

    const outer = document.createElement('span');
    outer.setAttribute('data-testid', 'chat-skill-chip');
    outer.setAttribute('data-token-start', String(part.token.startIndex));
    outer.setAttribute('data-token-end', String(part.token.endIndexExclusive));
    outer.className = OUTER_CHIP_CLASS;
    outer.contentEditable = 'false';

    const inner = document.createElement('span');
    inner.className = INNER_LABEL_CLASS;
    inner.textContent = part.token.text;
    outer.appendChild(inner);

    if (showRemoveButtons) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.setAttribute('data-testid', 'chat-skill-chip-remove');
      btn.className = REMOVE_BTN_CLASS;
      if (removeButtonAriaLabel) {
        btn.setAttribute('aria-label', removeButtonAriaLabel);
      }
      btn.addEventListener('mousedown', (ev) => {
        ev.preventDefault();
      });
      appendLucideXIcon(btn);
      outer.appendChild(btn);
    }

    frag.appendChild(outer);
  }

  return frag;
}
