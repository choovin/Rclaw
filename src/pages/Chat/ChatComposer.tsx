/**
 * Controlled contenteditable composer: plain text is source of truth; slash tokens render as chips.
 */
import { forwardRef, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import { buildComposerBody } from './chat-composer-decoration';
import {
  getOffsetsFromSelection,
  getPlainTextFromRoot,
  setSelectionFromOffsets,
} from './chat-composer-plaintext';
import { deleteTokenAtRange, type SlashToken } from './chat-skill-command';
import { cn } from '@/lib/utils';

export type ChatComposerHandle = {
  focus: () => void;
  getSelectionOffsets: () => { start: number; end: number } | null;
  setPlainTextAndSelection: (text: string, sel: { start: number; end: number }) => void;
};

export type ChatComposerProps = {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  placeholder?: string;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  className?: string;
  removeButtonAriaLabel?: string;
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
      onCompositionStart,
      onCompositionEnd,
    },
    ref,
  ) {
    const rootRef = useRef<HTMLDivElement>(null);
    const [isComposing, setIsComposing] = useState(false);
    const selectionAfterInputRef = useRef<{ start: number; end: number } | null>(null);
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
          return getOffsetsFromSelection(root);
        },
        setPlainTextAndSelection: (text: string, sel: { start: number; end: number }) => {
          pendingProgrammaticRef.current = { text, sel };
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
        }),
      );

      const pending = pendingProgrammaticRef.current;
      if (pending && pending.text === value) {
        setSelectionFromOffsets(root, pending.sel.start, pending.sel.end);
        pendingProgrammaticRef.current = null;
        selectionAfterInputRef.current = null;
      } else if (selectionAfterInputRef.current) {
        const s = selectionAfterInputRef.current;
        setSelectionFromOffsets(root, s.start, s.end);
        selectionAfterInputRef.current = null;
      }

      root.style.height = 'auto';
      const nextH = Math.min(Math.max(root.scrollHeight, 44), 200);
      root.style.height = `${nextH}px`;
    }, [value, isComposing, removeButtonAriaLabel]);

    const handleInput = () => {
      const root = rootRef.current;
      if (!root) {
        return;
      }
      const plain = getPlainTextFromRoot(root);
      const sel = getOffsetsFromSelection(root);
      if (sel) {
        selectionAfterInputRef.current = sel;
      }
      onChange(plain);
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
      onChange(nextValue);
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
          onKeyDown={onKeyDown}
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
