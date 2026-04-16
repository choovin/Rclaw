import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { fetchSkillhubPage } from '@/lib/skillhub-api';
import {
  buildInstalledSlugKeySet,
  filterLocalSkillsForPicker,
  isSlugInSelectedList,
  mergeSkillhubRowsWithLocal,
  type CreateEmployeeSkillOptionRow,
} from '@/lib/create-employee-skill-options';
import { normalizeCommandName } from '@/pages/Chat/chat-skill-command';
import { useSkillsStore } from '@/stores/skills';
import type { Skill } from '@/types/skill';
import type { SkillhubListItem } from '@/types/skillhub';

const SEARCH_DEBOUNCE_MS = 400;

function normalizeSkillhubTotal(raw: unknown, loadedCount: number): number {
  if (loadedCount === 0) {
    const n = raw === null || raw === undefined || raw === '' ? NaN : Number(raw as number | string);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  }
  const n = raw === null || raw === undefined || raw === '' ? NaN : Number(raw as number | string);
  if (Number.isFinite(n) && n >= loadedCount) {
    return n;
  }
  return Math.max(loadedCount + 1, 1);
}

export type CreateEmployeeSkillFieldProps = {
  selectedSlugs: string[];
  onSelectedSlugsChange: (slugs: string[]) => void;
};

function labelForSlug(skills: Skill[], rawSlug: string): string {
  const k = normalizeCommandName(rawSlug);
  const s = skills.find((ss) => normalizeCommandName(ss.slug ?? ss.id) === k);
  return s?.name?.trim() || rawSlug;
}

export function CreateEmployeeSkillField({ selectedSlugs, onSelectedSlugsChange }: CreateEmployeeSkillFieldProps) {
  const { t } = useTranslation('employees');
  const skills = useSkillsStore((s) => s.skills);
  const skillsLoading = useSkillsStore((s) => s.loading);
  const fetchSkills = useSkillsStore((s) => s.fetchSkills);

  const [searchInput, setSearchInput] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  const [hubItems, setHubItems] = useState<SkillhubListItem[]>([]);
  const [hubTotal, setHubTotal] = useState(0);
  const [hubNextPage, setHubNextPage] = useState(1);
  const [hubLoading, setHubLoading] = useState(false);
  const [hubLoadingMore, setHubLoadingMore] = useState(false);
  const [hubFetchError, setHubFetchError] = useState<string | null>(null);

  useEffect(() => {
    void fetchSkills();
  }, [fetchSkills]);

  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedQuery(searchInput), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [searchInput]);

  useEffect(() => {
    const q = debouncedQuery.trim();
    if (!q) {
      setHubItems([]);
      setHubTotal(0);
      setHubNextPage(1);
      setHubFetchError(null);
      setHubLoading(false);
      return;
    }

    let cancelled = false;
    setHubLoading(true);
    setHubFetchError(null);

    fetchSkillhubPage(q, 1)
      .then((res) => {
        if (cancelled) return;
        if (res.code === 0) {
          const list = res.data.list ?? [];
          setHubItems(list);
          setHubTotal(normalizeSkillhubTotal(res.data.total, list.length));
          setHubNextPage(2);
        } else {
          const msg = res.msg?.trim() || t('createDigitalEmployee.skillhubError');
          setHubItems([]);
          setHubTotal(0);
          setHubFetchError(msg);
          toast.error(msg);
        }
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : t('createDigitalEmployee.skillhubError');
        setHubItems([]);
        setHubTotal(0);
        setHubFetchError(msg);
        toast.error(msg);
      })
      .finally(() => {
        if (!cancelled) setHubLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, t]);

  const installedKeys = useMemo(() => buildInstalledSlugKeySet(skills), [skills]);

  const optionRows: CreateEmployeeSkillOptionRow[] = useMemo(() => {
    const localFiltered = filterLocalSkillsForPicker(skills, debouncedQuery);
    const q = debouncedQuery.trim();
    if (!q) {
      return mergeSkillhubRowsWithLocal([], localFiltered, installedKeys);
    }
    return mergeSkillhubRowsWithLocal(hubItems, localFiltered, installedKeys);
  }, [skills, debouncedQuery, hubItems, installedKeys]);

  const loadMoreHub = useCallback(async () => {
    const q = debouncedQuery.trim();
    if (!q || hubLoadingMore || hubItems.length >= hubTotal) return;
    setHubLoadingMore(true);
    try {
      const res = await fetchSkillhubPage(q, hubNextPage);
      if (res.code !== 0) {
        toast.error(res.msg?.trim() || t('createDigitalEmployee.skillhubError'));
        return;
      }
      const pageList = res.data.list ?? [];
      setHubItems((prev) => {
        const merged = [...prev, ...pageList];
        setHubTotal(normalizeSkillhubTotal(res.data.total, merged.length));
        return merged;
      });
      setHubNextPage((p) => p + 1);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t('createDigitalEmployee.skillhubError'));
    } finally {
      setHubLoadingMore(false);
    }
  }, [debouncedQuery, hubLoadingMore, hubItems.length, hubTotal, hubNextPage, t]);

  const togglePick = (slug: string) => {
    const k = normalizeCommandName(slug);
    const exists = selectedSlugs.some((s) => normalizeCommandName(s) === k);
    if (exists) {
      onSelectedSlugsChange(selectedSlugs.filter((s) => normalizeCommandName(s) !== k));
    } else {
      onSelectedSlugsChange([...selectedSlugs, slug.trim()]);
    }
  };

  const removeSlug = (slug: string) => {
    const k = normalizeCommandName(slug);
    onSelectedSlugsChange(selectedSlugs.filter((s) => normalizeCommandName(s) !== k));
  };

  const qTrim = debouncedQuery.trim();
  const showLoadMore = Boolean(qTrim) && hubItems.length < hubTotal && !hubLoading;

  return (
    <div className="space-y-2.5" data-testid="create-digital-employee-skills-section">
      <div>
        <Label className="text-[14px] text-black/80 dark:text-white/80 font-bold">{t('createDigitalEmployee.skillsLabel')}</Label>
        <p className="text-[12px] text-black/55 dark:text-white/50 mt-1">{t('createDigitalEmployee.skillsHint')}</p>
      </div>

      {selectedSlugs.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedSlugs.map((slug) => (
            <Badge
              key={slug}
              variant="outline"
              className="gap-1 pr-1 pl-2.5 py-1 text-[12px] font-normal border-black/20 dark:border-white/20"
            >
              <span className="max-w-[200px] truncate">{labelForSlug(skills, slug)}</span>
              <button
                type="button"
                className="rounded-full p-0.5 hover:bg-black/10 dark:hover:bg-white/10"
                aria-label={t('createDigitalEmployee.removeSkillChip')}
                onClick={() => removeSlug(slug)}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      <Input
        data-testid="create-digital-employee-skill-search-input"
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
        placeholder={t('createDigitalEmployee.skillSearchPlaceholder')}
        className="h-[40px] rounded-xl font-mono text-[13px] bg-white dark:bg-black border-black/15 dark:border-white/15"
      />

      {hubFetchError && qTrim ? (
        <p className="text-[12px] text-amber-700 dark:text-amber-300">{hubFetchError}</p>
      ) : null}

      <div
        className={cn(
          'rounded-xl border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.03] max-h-[min(240px,40vh)] overflow-y-auto overflow-x-hidden',
        )}
      >
        {skillsLoading && skills.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-8 text-[13px] text-black/60 dark:text-white/50">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t('createDigitalEmployee.skillsLoading')}
          </div>
        ) : optionRows.length === 0 ? (
          <div className="py-8 px-3 text-center text-[13px] text-black/55 dark:text-white/50">
            {t('createDigitalEmployee.skillsEmpty')}
          </div>
        ) : (
          <ul className="py-1">
            {optionRows.map((row) => {
              const selected = isSlugInSelectedList(row.slug, selectedSlugs);
              return (
                <li key={`${row.section}-${row.slug}`}>
                  <button
                    type="button"
                    onClick={() => togglePick(row.slug)}
                    className={cn(
                      'w-full text-left px-3 py-2.5 flex items-start justify-between gap-2 text-[13px] transition-colors',
                      'hover:bg-black/5 dark:hover:bg-white/10',
                      selected && 'bg-black/8 dark:bg-white/10',
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="font-medium text-black dark:text-white block truncate">{row.title}</span>
                      <span className="text-[11px] font-mono text-black/50 dark:text-white/45 block truncate">{row.slug}</span>
                    </span>
                    <span className="shrink-0 flex flex-col items-end gap-0.5 text-[10px] uppercase tracking-wide">
                      {row.section === 'local-only' ? (
                        <span className="text-black/45 dark:text-white/40">{t('createDigitalEmployee.skillLocalOnly')}</span>
                      ) : null}
                      <span
                        className={row.installed ? 'text-emerald-700 dark:text-emerald-400' : 'text-black/50 dark:text-white/45'}
                      >
                        {row.installed ? t('createDigitalEmployee.skillInstalled') : t('createDigitalEmployee.skillNotInstalled')}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {showLoadMore ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full rounded-xl text-[12px]"
          disabled={hubLoadingMore}
          onClick={() => void loadMoreHub()}
        >
          {hubLoadingMore ? (
            <>
              <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
              {t('createDigitalEmployee.loadMoreSkills')}
            </>
          ) : (
            t('createDigitalEmployee.loadMoreSkills')
          )}
        </Button>
      ) : null}

      {hubLoading && qTrim ? (
        <div className="flex items-center gap-2 text-[12px] text-black/50 dark:text-white/45">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {t('createDigitalEmployee.skillhubSearching')}
        </div>
      ) : null}
    </div>
  );
}
