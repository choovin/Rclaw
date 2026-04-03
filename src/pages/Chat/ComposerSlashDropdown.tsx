import { useMemo } from 'react';
import type { Skill } from '@/types/skill';
import { cn } from '@/lib/utils';
import { normalizeCommandName } from './chat-skill-command';

const PANEL_W = 384;
const PANEL_MAX_H = 288;
const GAP = 6;

export function ComposerSlashDropdown(props: {
  open: boolean;
  anchorRect: DOMRect | null;
  skills: Skill[];
  query: string;
  onPick: (payload: { commandName: string; display: string }) => void;
  highlightIndex: number;
  emptyEnabledLabel: string;
  noResultsLabel: string;
}) {
  const enabled = useMemo(() => props.skills.filter((s) => s.enabled), [props.skills]);
  const filtered = useMemo(() => {
    const q = props.query.trim().toLowerCase();
    if (!q) {
      return enabled;
    }
    return enabled.filter(
      (s) =>
        (s.name || '').toLowerCase().includes(q) ||
        (s.slug ?? s.id).toLowerCase().includes(q) ||
        (s.description || '').toLowerCase().includes(q),
    );
  }, [enabled, props.query]);

  const pos = useMemo(() => {
    if (!props.open || !props.anchorRect || typeof window === 'undefined') {
      return null;
    }
    const rect = props.anchorRect;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = Math.min(rect.left, vw - PANEL_W - 8);
    left = Math.max(8, left);
    let top = rect.bottom + GAP;
    if (top + PANEL_MAX_H > vh - 8) {
      top = Math.max(8, rect.top - PANEL_MAX_H - GAP);
    }
    return { left, top };
  }, [props.open, props.anchorRect]);

  if (!props.open || !props.anchorRect || !pos) {
    return null;
  }

  return (
    <div
      role="listbox"
      data-testid="chat-skill-inline-picker"
      className="fixed z-[100] w-96 overflow-hidden rounded-2xl border border-border/60 bg-card shadow-lg"
      style={{ left: pos.left, top: pos.top, width: PANEL_W, maxHeight: PANEL_MAX_H }}
    >
      <div className="max-h-72 overflow-y-auto p-2">
        {enabled.length === 0 ? (
          <div className="px-3 py-3 text-sm text-muted-foreground" data-testid="chat-skill-inline-empty">
            {props.emptyEnabledLabel}
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-3 py-3 text-sm text-muted-foreground" data-testid="chat-skill-inline-no-results">
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
                  role="option"
                  aria-selected={idx === props.highlightIndex}
                  data-testid="chat-skill-inline-option"
                  data-skill-slug={cmd}
                  className={cn(
                    'w-full rounded-xl px-3 py-2 text-left transition-colors',
                    idx === props.highlightIndex ? 'bg-secondary/80' : 'hover:bg-secondary/60',
                  )}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => props.onPick({ commandName: cmd, display })}
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
    </div>
  );
}
