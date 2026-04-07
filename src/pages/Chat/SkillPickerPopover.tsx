import { useEffect, useMemo, useRef, useState } from 'react';
import type { Skill } from '@/types/skill';
import { cn } from '@/lib/utils';
import { normalizeCommandName } from './chat-skill-command';

export type SkillPickerPopoverProps = {
  open: boolean;
  skills: Skill[];
  onPick: (payload: { commandName: string; display: string }) => void;
  onOpenSkills: () => void;
  /** 由上层处理（如点击外部、Esc）；面板内也可触发 */
  onClose: () => void;
  searchPlaceholder: string;
  skillsLibraryLabel: string;
  emptyEnabledLabel: string;
  noResultsLabel: string;
  /** 受控搜索；与 `onSearchChange` 同时传入时生效 */
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
  /** 打开时将焦点移入搜索框 */
  autoFocusSearch?: boolean;
};

export function SkillPickerPopover(props: SkillPickerPopoverProps) {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [internalQ, setInternalQ] = useState('');
  const controlled = props.searchQuery !== undefined;
  const q = controlled ? props.searchQuery! : internalQ;
  const setQ = (next: string) => {
    if (next !== q) {
      setHighlightIndex(0);
    }
    if (controlled) {
      props.onSearchChange?.(next);
    } else {
      setInternalQ(next);
    }
  };

  const [highlightIndex, setHighlightIndex] = useState(0);

  const enabled = useMemo(() => props.skills.filter((s) => s.enabled), [props.skills]);
  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return enabled;
    return enabled.filter(
      (s) =>
        (s.name || '').toLowerCase().includes(query) ||
        (s.slug ?? s.id).toLowerCase().includes(query) ||
        (s.description || '').toLowerCase().includes(query),
    );
  }, [enabled, q]);

  const maxHi = Math.max(0, filtered.length - 1);
  const highlightForList = Math.min(highlightIndex, maxHi);

  useEffect(() => {
    if (!props.open || !props.autoFocusSearch) {
      return;
    }
    const id = requestAnimationFrame(() => {
      searchInputRef.current?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [props.open, props.autoFocusSearch]);

  if (!props.open) return null;

  const pickAt = (index: number) => {
    const s = filtered[index];
    if (!s) return;
    const raw = (s.slug ?? s.id) as string;
    const cmd = normalizeCommandName(raw);
    props.onPick({ commandName: cmd, display: `/${cmd}` });
  };

  return (
    <div
      className="absolute bottom-full left-0 z-30 mb-2.5 w-96 overflow-hidden rounded-2xl border border-border/60 bg-card shadow-lg"
      data-testid="chat-skill-picker-popover"
    >
      <div className="p-2">
        <input
          ref={searchInputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              e.stopPropagation();
              props.onClose();
              return;
            }
            if (filtered.length === 0) {
              return;
            }
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setHighlightIndex((i) => Math.min(i + 1, maxHi));
              return;
            }
            if (e.key === 'ArrowUp') {
              e.preventDefault();
              setHighlightIndex((i) => Math.max(i - 1, 0));
              return;
            }
            if (e.key === 'Enter') {
              e.preventDefault();
              e.stopPropagation();
              pickAt(highlightForList);
            }
          }}
          placeholder={props.searchPlaceholder}
          data-testid="chat-skill-picker-search"
          className="h-10 w-full rounded-xl border border-border/60 bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
        />
      </div>
      <div className="max-h-72 overflow-y-auto p-2 pt-0">
        {enabled.length === 0 ? (
          <div className="px-3 py-3 text-sm text-muted-foreground" data-testid="chat-skill-picker-empty">
            {props.emptyEnabledLabel}
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-3 py-3 text-sm text-muted-foreground" data-testid="chat-skill-picker-no-results">
            {props.noResultsLabel}
          </div>
        ) : (
          <div className="space-y-1">
            {filtered.map((s, idx) => {
              const raw = (s.slug ?? s.id) as string;
              const cmd = normalizeCommandName(raw);
              const display = `/${cmd}`;
              return (
                <button
                  key={s.id}
                  type="button"
                  data-testid="chat-skill-picker-option"
                  data-skill-slug={cmd}
                  className={cn(
                    'w-full rounded-xl px-3 py-2 text-left transition-colors hover:bg-secondary/60',
                    idx === highlightForList && 'bg-secondary/60',
                  )}
                  onClick={() => props.onPick({ commandName: cmd, display })}
                  onMouseEnter={() => setHighlightIndex(idx)}
                >
                  <div className="flex items-start gap-2">
                    <div className="mt-0.5 w-6 shrink-0 text-center">{s.icon ?? '✨'}</div>
                    <div className="min-w-0">
                      <div className="font-mono text-[13px] font-semibold text-foreground">{display}</div>
                      <div className="line-clamp-2 text-[12px] text-muted-foreground">{s.description}</div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
      <button
        type="button"
        className="w-full border-t border-border/60 px-3 py-2 text-left text-sm text-foreground/70 hover:bg-secondary/50"
        onClick={props.onOpenSkills}
      >
        {props.skillsLibraryLabel}
      </button>
    </div>
  );
}
