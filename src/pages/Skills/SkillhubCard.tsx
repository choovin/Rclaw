import type { SkillhubListItem } from '@/types/skillhub';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

type SkillhubCardProps = {
  item: SkillhubListItem;
  installed: boolean;
  installing: boolean;
  onOpenDetail: () => void;
  onDownload: (e: React.MouseEvent) => void;
};

export function SkillhubCard({ item, installed, installing, onOpenDetail, onDownload }: SkillhubCardProps) {
  const { t } = useTranslation('skills');

  return (
    <div
      data-testid="skillhub-card"
      role="button"
      tabIndex={0}
      onClick={onOpenDetail}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpenDetail();
        }
      }}
      className={cn(
        'group rounded-2xl border border-black/10 dark:border-white/10 bg-white/40 dark:bg-card/40',
        'hover:bg-white/60 dark:hover:bg-card/60 transition-colors cursor-pointer',
        'p-4 flex flex-col',
      )}
    >
      <div className="flex items-start gap-3">
        <div className="h-11 w-11 shrink-0 flex items-center justify-center text-2xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10 rounded-2xl overflow-hidden">
          📦
        </div>
        <div className="min-w-0 flex-1 flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1 flex flex-col gap-0.5">
            <h3
              className="text-[15px] font-semibold leading-tight text-foreground truncate"
              title={item.displayName}
            >
              {item.displayName}
            </h3>
            <div className="text-[14px] font-mono text-foreground/55 truncate leading-none mt-1">
              {item.publishedVersion?.version ?? '1.0.0'}
            </div>
          </div>
          <div className="shrink-0 flex items-start" onClick={(e) => e.stopPropagation()}>
            {installed ? (
              <Badge variant="secondary" className="text-[10px] font-medium px-2 py-0 h-5 border-0 shadow-none">
                {t('skillhub.added')}
              </Badge>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full"
                onClick={onDownload}
                disabled={installing}
                aria-label={t('marketplace.install')}
              >
                {installing ? <LoadingSpinner size="sm" /> : <Download className="h-4 w-4" />}
              </Button>
            )}
          </div>
        </div>
      </div>
      <div className="mt-2 min-h-0 overflow-hidden">
        <p className="text-[13.5px] text-muted-foreground line-clamp-3 leading-relaxed">
          {item.summary}
        </p>
      </div>
    </div>
  );
}
