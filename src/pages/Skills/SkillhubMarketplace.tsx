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
  const loadMore = useSkillhubListStore((s) => s.loadMore);
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

  useEffect(() => {
    const el = scrollElementRef.current;
    if (!el) return;
    const onScroll = () => {
      const { scrollTop, clientHeight, scrollHeight } = el;
      const nearBottom = scrollTop + clientHeight > scrollHeight - 200;
      if (!nearBottom) return;
      const now = Date.now();
      if (now - lastBottomLoadRef.current < 500) return;
      lastBottomLoadRef.current = now;
      void loadMore();
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [scrollElementRef, loadMore]);

  useEffect(() => {
    const el = scrollElementRef.current;
    if (!el || loading || loadingMore) return;
    if (items.length >= total) return;
    const fill = () => {
      if (items.length === 0) return;
      if (el.scrollHeight <= el.clientHeight + 100) {
        const now = Date.now();
        if (now - lastBottomLoadRef.current < 500) return;
        lastBottomLoadRef.current = now;
        void loadMore();
      }
    };
    fill();
    const ro = new ResizeObserver(fill);
    ro.observe(el);
    return () => ro.disconnect();
  }, [items.length, total, loading, loadingMore, loadMore, scrollElementRef]);

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
      {loadingMore && (
        <div className="flex justify-center py-4">
          <LoadingSpinner size="sm" />
        </div>
      )}
    </>
  );
}
