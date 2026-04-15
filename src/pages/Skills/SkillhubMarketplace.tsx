import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Puzzle, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSkillhubListStore } from '@/stores/skillhub-list';
import { useSkillsStore } from '@/stores/skills';
import type { Skill } from '@/types/skill';
import type { SkillhubListItem } from '@/types/skillhub';
import { getSkillHubSkillPageUrl } from '@/lib/skillhub-url';
import { invokeIpc } from '@/lib/api-client';
import { toast } from 'sonner';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { SkillhubCard } from './SkillhubCard';

const ROW_GAP_PX = 12;
const ESTIMATE_ROW_HEIGHT = 200;

function useSkillhubColumnsPerRow(): number {
  const [cols, setCols] = useState(1);
  useEffect(() => {
    const mqMd = window.matchMedia('(min-width: 768px)');
    const mqXl = window.matchMedia('(min-width: 1280px)');
    const update = () => {
      if (mqXl.matches) setCols(3);
      else if (mqMd.matches) setCols(2);
      else setCols(1);
    };
    update();
    mqMd.addEventListener('change', update);
    mqXl.addEventListener('change', update);
    return () => {
      mqMd.removeEventListener('change', update);
      mqXl.removeEventListener('change', update);
    };
  }, []);
  return cols;
}

type SkillhubMarketplaceProps = {
  scrollElementRef: React.RefObject<HTMLDivElement | null>;
  skills: Skill[];
  onInstall: (slug: string) => Promise<void>;
};

export function SkillhubMarketplace({ scrollElementRef, skills, onInstall }: SkillhubMarketplaceProps) {
  const { t } = useTranslation('skills');
  const items = useSkillhubListStore((s) => s.items);
  const total = useSkillhubListStore((s) => s.total);
  const loading = useSkillhubListStore((s) => s.loading);
  const loadingMore = useSkillhubListStore((s) => s.loadingMore);
  const error = useSkillhubListStore((s) => s.error);
  const installing = useSkillsStore((s) => s.installing);

  const columnsPerRow = useSkillhubColumnsPerRow();

  const rows = useMemo(() => {
    const out: SkillhubListItem[][] = [];
    for (let i = 0; i < items.length; i += columnsPerRow) {
      out.push(items.slice(i, i + columnsPerRow));
    }
    return out;
  }, [items, columnsPerRow]);

  // TanStack Virtual: React Compiler skips memoizing this hook by design.
  // eslint-disable-next-line react-hooks/incompatible-library -- useVirtualizer from @tanstack/react-virtual
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollElementRef.current,
    estimateSize: (_index: number) => ESTIMATE_ROW_HEIGHT + ROW_GAP_PX,
    overscan: 4,
  });

  const lastBottomLoadRef = useRef(0);
  const loadSentinelRef = useRef<HTMLDivElement | null>(null);

  const scheduleLoadMore = useCallback(() => {
    const now = Date.now();
    if (now - lastBottomLoadRef.current < 400) return;
    lastBottomLoadRef.current = now;
    void useSkillhubListStore.getState().loadMore();
  }, []);

  useEffect(() => {
    const el = scrollElementRef.current;
    if (!el) return;
    const onScroll = () => {
      const gap = el.scrollHeight - el.scrollTop - el.clientHeight;
      if (gap > 400) return;
      scheduleLoadMore();
    };
    /** 已触底时 scroll 不再触发，用户继续滚轮只会产生 wheel —— 需与 onScroll 同条件触发加载 */
    const onWheel = () => {
      const gap = el.scrollHeight - el.scrollTop - el.clientHeight;
      if (gap > 400) return;
      scheduleLoadMore();
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    el.addEventListener('wheel', onWheel, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      el.removeEventListener('wheel', onWheel);
    };
  }, [scrollElementRef, scheduleLoadMore]);

  /** 以滚动容器为 root 的哨兵：虚拟列表 + 触底判断在部分环境下不可靠，IO 更稳 */
  useEffect(() => {
    const el = scrollElementRef.current;
    const sentinel = loadSentinelRef.current;
    if (!el || !sentinel) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        scheduleLoadMore();
      },
      { root: el, rootMargin: '0px 0px 520px 0px', threshold: 0 },
    );
    io.observe(sentinel);
    return () => io.disconnect();
  }, [scrollElementRef, scheduleLoadMore, items.length, rows.length, total]);

  useEffect(() => {
    const el = scrollElementRef.current;
    if (!el) return;
    const fill = () => {
      const s = useSkillhubListStore.getState();
      if (s.loading || s.loadingMore || s.items.length === 0 || s.items.length >= s.total) return;
      if (el.scrollHeight <= el.clientHeight + 160) {
        scheduleLoadMore();
      }
    };
    fill();
    const ro = new ResizeObserver(fill);
    ro.observe(el);
    return () => ro.disconnect();
  }, [items.length, total, loading, loadingMore, scrollElementRef, scheduleLoadMore]);

  const isInstalled = useCallback(
    (item: SkillhubListItem) => skills.some((s) => s.slug === item.slug || s.id === item.slug),
    [skills],
  );

  const handleOpenCard = useCallback(
    (slug: string) => {
      const url = getSkillHubSkillPageUrl(slug);
      if (!url) {
        toast.error(t('skillhub.missingHubUrl'));
        return;
      }
      void invokeIpc('shell:openExternal', url);
    },
    [t],
  );

  const handleDownload = useCallback(
    async (e: React.MouseEvent, slug: string) => {
      e.stopPropagation();
      await onInstall(slug);
    },
    [onInstall],
  );

  if (loading && items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <LoadingSpinner size="lg" />
        <p className="mt-4 text-sm">{t('skillhub.loading')}</p>
      </div>
    );
  }

  if (error && items.length === 0) {
    return (
      <div className="mb-4 p-4 rounded-xl border border-destructive/50 bg-destructive/10 text-destructive text-sm font-medium flex items-center gap-2">
        <AlertCircle className="h-5 w-5 shrink-0" />
        <span>{error}</span>
      </div>
    );
  }

  if (!loading && items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <Puzzle className="h-10 w-10 mb-4 opacity-50" />
        <p>{t('skillhub.empty')}</p>
      </div>
    );
  }

  return (
    <>
      {error && items.length > 0 && (
        <div className="mb-4 p-4 rounded-xl border border-destructive/50 bg-destructive/10 text-destructive text-sm font-medium flex items-center gap-2">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>
            {t('skillhub.loadMoreError')}
            {error ? <span className="block text-xs font-normal mt-1 opacity-90">{error}</span> : null}
          </span>
        </div>
      )}
      <div
        data-testid="skillhub-grid"
        className="relative w-full"
        style={{ height: virtualizer.getTotalSize() }}
      >
        {virtualizer.getVirtualItems().map((vi) => {
          const row = rows[vi.index];
          if (!row) return null;
          return (
            <div
              key={vi.key}
              data-index={vi.index}
              ref={virtualizer.measureElement}
              className="absolute left-0 top-0 w-full pb-3"
              style={{ transform: `translateY(${vi.start}px)` }}
            >
              <div
                className="grid w-full gap-3"
                style={{
                  gridTemplateColumns: `repeat(${columnsPerRow}, minmax(0, 1fr))`,
                }}
              >
                {row.map((item) => (
                  <SkillhubCard
                    key={item.slug}
                    item={item}
                    installed={isInstalled(item)}
                    installing={!!installing[item.slug]}
                    onOpenDetail={() => handleOpenCard(item.slug)}
                    onDownload={(e) => void handleDownload(e, item.slug)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {items.length < total ? (
        <div
          ref={loadSentinelRef}
          className="h-px w-full shrink-0"
          aria-hidden
          data-testid="skillhub-load-sentinel"
        />
      ) : null}
      <div
        data-testid="skillhub-list-footer"
        className="flex flex-col items-center justify-center gap-2 py-6 text-sm text-muted-foreground"
      >
        {loadingMore ? (
          <>
            <LoadingSpinner size="sm" data-testid="skillhub-footer-loading" />
            <span>{t('skillhub.loadingMore')}</span>
          </>
        ) : items.length < total ? (
          <span data-testid="skillhub-footer-hint">{t('skillhub.scrollForMore')}</span>
        ) : (
          <span data-testid="skillhub-footer-end">{t('skillhub.noMore')}</span>
        )}
      </div>
    </>
  );
}
