/**
 * Controlled contenteditable composer: plain text is source of truth; slash tokens render as chips.
 */
import { forwardRef, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import { buildComposerBody } from './chat-composer-decoration';
import {
  getCaretRectFromDomSelection,
  getOffsetsFromSelection,
  getPlainTextFromRoot,
  getRectAtPlainTextOffset,
  repairComposerPlainTextIfCaretArtifact,
  setSelectionFromOffsets,
} from './chat-composer-plaintext';
import {
  adjustCaretForComposerZwsp,
  deleteTokenAtRange,
  ensureComposerZwspAfterSlashTokens,
  findSlashTokenForBackspaceDelete,
  stripSlashTokensFromRange,
  type SlashToken,
} from './chat-skill-command';
import { cn } from '@/lib/utils';

export type ChatComposerHandle = {
  focus: () => void;
  getSelectionOffsets: () => { start: number; end: number } | null;
  /** Rect at a plain-text offset (for anchoring UI to `/`, not only the caret). */
  getRectAtPlainTextOffset: (offset: number) => DOMRect | null;
  setPlainTextAndSelection: (text: string, sel: { start: number; end: number }) => void;
};

export type ChatComposerChangeMeta = { caret: number; caretRect?: DOMRect };

export type ChatComposerProps = {
  value: string;
  onChange: (v: string, meta?: ChatComposerChangeMeta) => void;
  disabled?: boolean;
  placeholder?: string;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  className?: string;
  removeButtonAriaLabel?: string;
  /** 仅对此集合内的命令名渲染 chip 并参与 ZWSP/复制/整块删除；未传则与旧行为一致（全部 token） */
  slashChipCommandNames?: ReadonlySet<string>;
  onCompositionStart?: () => void;
  onCompositionEnd?: () => void;
};

export const ChatComposer = forwardRef<ChatComposerHandle, ChatComposerProps>(
  function ChatComposer(
    {
      value,
      onChange,
      disabled = false,
      placeholder = '',
      onKeyDown,
      className,
      removeButtonAriaLabel = '',
      slashChipCommandNames,
      onCompositionStart,
      onCompositionEnd,
    },
    ref,
  ) {
    const rootRef = useRef<HTMLDivElement>(null);
    const [isComposing, setIsComposing] = useState(false);
    const selectionAfterInputRef = useRef<{ start: number; end: number } | null>(null);
    /** Last known offsets inside the composer (e.g. before focus moves to a toolbar button). */
    const lastKnownSelectionRef = useRef<{ start: number; end: number } | null>(null);
    const pendingProgrammaticRef = useRef<{ text: string; sel: { start: number; end: number } } | null>(
      null,
    );

    useImperativeHandle(
      ref,
      () => ({
        focus: () => {
          rootRef.current?.focus();
        },
        getSelectionOffsets: () => {
          const root = rootRef.current;
          if (!root) {
            return null;
          }
          return getOffsetsFromSelection(root) ?? lastKnownSelectionRef.current;
        },
        getRectAtPlainTextOffset: (offset: number) => {
          const root = rootRef.current;
          if (!root) {
            return null;
          }
          return getRectAtPlainTextOffset(root, offset);
        },
        setPlainTextAndSelection: (text: string, sel: { start: number; end: number }) => {
          pendingProgrammaticRef.current = { text, sel };
          lastKnownSelectionRef.current = sel;
        },
      }),
      [],
    );

    useLayoutEffect(() => {
      const root = rootRef.current;
      if (!root) {
        return;
      }
      if (isComposing) {
        return;
      }
      root.replaceChildren(
        buildComposerBody(value, {
          removeButtonAriaLabel,
          showRemoveButtons: true,
          slashChipCommandNames,
        }),
      );

      const pending = pendingProgrammaticRef.current;
      let snapSel: { start: number; end: number } | null = null;
      if (pending && pending.text === value) {
        snapSel = pending.sel;
        pendingProgrammaticRef.current = null;
        selectionAfterInputRef.current = null;
      } else if (selectionAfterInputRef.current) {
        snapSel = selectionAfterInputRef.current;
        selectionAfterInputRef.current = null;
      } else {
        const lk = lastKnownSelectionRef.current;
        if (lk) {
          const max = value.length;
          const lo = Math.max(0, Math.min(Math.min(lk.start, lk.end), max));
          const hi = Math.max(0, Math.min(Math.max(lk.start, lk.end), max));
          if (lo <= hi) {
            snapSel = { start: lo, end: hi };
          }
        }
      }
      if (snapSel) {
        setSelectionFromOffsets(root, snapSel.start, snapSel.end);
        lastKnownSelectionRef.current = snapSel;
        let attempts = 0;
        while (attempts < 3 && getPlainTextFromRoot(root) !== value) {
          if (!repairComposerPlainTextIfCaretArtifact(root, value)) {
            break;
          }
          setSelectionFromOffsets(root, snapSel.start, snapSel.end);
          attempts++;
        }
      }

      root.style.height = 'auto';
      const nextH = Math.min(Math.max(root.scrollHeight, 44), 200);
      root.style.height = `${nextH}px`;
    }, [value, isComposing, removeButtonAriaLabel, slashChipCommandNames]);

    const handleInput = () => {
      const root = rootRef.current;
      if (!root) {
        return;
      }
      const plain = getPlainTextFromRoot(root);
      const normalized = ensureComposerZwspAfterSlashTokens(plain, slashChipCommandNames);
      const sel = getOffsetsFromSelection(root);
      if (sel) {
        const adjStart = adjustCaretForComposerZwsp(plain, sel.start, slashChipCommandNames);
        const adjEnd = adjustCaretForComposerZwsp(plain, sel.end, slashChipCommandNames);
        selectionAfterInputRef.current = { start: adjStart, end: adjEnd };
        lastKnownSelectionRef.current = { start: adjStart, end: adjEnd };
      }
      const effectiveSel =
        sel ?? lastKnownSelectionRef.current ?? { start: plain.length, end: plain.length };
      const caretPlain = effectiveSel.end;
      const outPlain = normalized !== plain ? normalized : plain;
      let caret: number;
      if (sel) {
        caret = adjustCaretForComposerZwsp(plain, caretPlain, slashChipCommandNames);
      } else if (normalized !== plain) {
        caret = adjustCaretForComposerZwsp(plain, Math.min(caretPlain, plain.length), slashChipCommandNames);
      } else {
        caret = caretPlain;
      }
      let caretRect: DOMRect | undefined;
      try {
        caretRect = getCaretRectFromDomSelection(root) ?? undefined;
      } catch {
        caretRect = undefined;
      }
      onChange(outPlain, { caret, caretRect });
    };

    const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
      const items = e.clipboardData?.items;
      if (items) {
        for (const item of Array.from(items)) {
          if (item.kind === 'file') {
            return;
          }
        }
      }
      e.preventDefault();
      e.stopPropagation();
      const text = e.clipboardData?.getData('text/plain') ?? '';
      if (!text) {
        return;
      }
      const root = rootRef.current;
      if (!root) {
        return;
      }
      if (typeof document.execCommand === 'function') {
        try {
          if (document.queryCommandSupported?.('insertText') !== false) {
            const ok = document.execCommand('insertText', false, text);
            if (ok) {
              handleInput();
              return;
            }
          }
        } catch {
          /* fall through */
        }
      }
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) {
        return;
      }
      const range = sel.getRangeAt(0);
      if (!root.contains(range.commonAncestorContainer)) {
        return;
      }
      range.deleteContents();
      range.insertNode(document.createTextNode(text));
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
      handleInput();
    };

    const handleCopy = (e: React.ClipboardEvent<HTMLDivElement>) => {
      if (disabled || isComposing) {
        return;
      }
      const root = rootRef.current;
      if (!root) {
        return;
      }
      const sel = getOffsetsFromSelection(root);
      if (!sel) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      const text = stripSlashTokensFromRange(value, sel.start, sel.end, slashChipCommandNames);
      e.clipboardData?.setData('text/plain', text);
    };

    const handleCut = (e: React.ClipboardEvent<HTMLDivElement>) => {
      if (disabled || isComposing) {
        return;
      }
      const root = rootRef.current;
      if (!root) {
        return;
      }
      const sel = getOffsetsFromSelection(root);
      if (!sel) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      const text = stripSlashTokensFromRange(value, sel.start, sel.end, slashChipCommandNames);
      e.clipboardData?.setData('text/plain', text);
      const next = value.slice(0, sel.start) + value.slice(sel.end);
      pendingProgrammaticRef.current = { text: next, sel: { start: sel.start, end: sel.start } };
      lastKnownSelectionRef.current = { start: sel.start, end: sel.start };
      onChange(next, { caret: sel.start });
    };

    const handleComposerKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Backspace' && !isComposing && !disabled && value) {
        const root = rootRef.current;
        if (root) {
          const sel = getOffsetsFromSelection(root);
          if (sel && sel.start === sel.end) {
            const token = findSlashTokenForBackspaceDelete(value, sel.end, slashChipCommandNames);
            if (token) {
              e.preventDefault();
              e.stopPropagation();
              const { nextValue, nextSelection } = deleteTokenAtRange(value, token, sel);
              pendingProgrammaticRef.current = { text: nextValue, sel: nextSelection };
              lastKnownSelectionRef.current = nextSelection;
              onChange(nextValue, { caret: nextSelection.end, caretRect: undefined });
              return;
            }
          }
        }
      }
      onKeyDown?.(e);
    };

    const handleRootClick = (e: React.MouseEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement;
      const removeBtn = target.closest('[data-testid="chat-skill-chip-remove"]');
      if (!removeBtn || !rootRef.current) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      const chip = removeBtn.closest('[data-testid="chat-skill-chip"]') as HTMLElement | null;
      if (!chip) {
        return;
      }
      const root = rootRef.current;
      const startStr = chip.getAttribute('data-token-start');
      const endStr = chip.getAttribute('data-token-end');
      if (startStr == null || endStr == null) {
        return;
      }
      const startIndex = Number(startStr);
      const endIndexExclusive = Number(endStr);
      const token: SlashToken = {
        startIndex,
        endIndexExclusive,
        text: value.slice(startIndex, endIndexExclusive),
      };
      const sel = getOffsetsFromSelection(root) ?? { start: 0, end: 0 };
      const { nextValue, nextSelection } = deleteTokenAtRange(value, token, sel);
      pendingProgrammaticRef.current = { text: nextValue, sel: nextSelection };
      lastKnownSelectionRef.current = nextSelection;
      onChange(nextValue, { caret: nextSelection.end, caretRect: undefined });
    };

    const editable = !disabled;
    const contentEditableProp =
      !editable ? false : 'plaintextOnly' in HTMLElement.prototype ? ('plaintext-only' as const) : true;

    return (
      <div className="relative min-w-0 w-full">
        {placeholder && !value && !isComposing && (
          <span
            className="pointer-events-none absolute left-2 top-3 z-[0] text-[15px] leading-relaxed text-muted-foreground/50"
            aria-hidden
          >
            {placeholder}
          </span>
        )}
        <div
          ref={rootRef}
          data-testid="chat-composer"
          role="textbox"
          aria-multiline
          aria-disabled={disabled || undefined}
          contentEditable={contentEditableProp}
          suppressContentEditableWarning
          className={cn(
            'relative z-[1] min-h-[44px] max-h-[200px] overflow-y-auto py-3 px-2 text-[15px] leading-relaxed break-words',
            'border-0 bg-transparent text-foreground shadow-none outline-none selection:bg-blue-500/30',
            'focus-visible:ring-0 focus-visible:ring-offset-0',
            disabled && 'cursor-not-allowed opacity-60',
            className,
          )}
          onInput={handleInput}
          onKeyDown={handleComposerKeyDown}
          onCopy={handleCopy}
          onCut={handleCut}
          onPaste={handlePaste}
          onClick={handleRootClick}
          onCompositionStart={() => {
            setIsComposing(true);
            onCompositionStart?.();
          }}
          onCompositionEnd={() => {
            setIsComposing(false);
            onCompositionEnd?.();
          }}
        />
      </div>
    );
  },
);
