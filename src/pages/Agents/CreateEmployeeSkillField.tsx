import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Trash2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { fetchSkillhubPage } from '@/lib/skillhub-api';
import {
  buildInstalledSlugKeySet,
  filterLocalSkillsForPicker,
  isSlugInSelectedSkills,
  mergeSkillhubRowsWithLocal,
  toggleSelectedSkillRow,
  type CreateEmployeeSkillOptionRow,
  type SelectedEmployeeSkill,
} from '@/lib/create-employee-skill-options';
import { normalizeCommandName } from '@/pages/Chat/chat-skill-command';
import { useSkillsStore } from '@/stores/skills';
import type { SkillhubListItem } from '@/types/skillhub';

export type { SelectedEmployeeSkill } from '@/lib/create-employee-skill-options';

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
  selectedSkills: SelectedEmployeeSkill[];
  onSelectedSkillsChange: (next: SelectedEmployeeSkill[]) => void;
};

type PickerModalProps = {
  open: boolean;
  onClose: () => void;
  selectedSkills: SelectedEmployeeSkill[];
  onSelectedSkillsChange: (next: SelectedEmployeeSkill[]) => void;
};

function CreateEmployeeSkillPickerModal({
  open,
  onClose,
  selectedSkills,
  onSelectedSkillsChange,
}: PickerModalProps) {
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
    if (open) void fetchSkills();
  }, [open, fetchSkills]);

  useEffect(() => {
    if (!open) {
      setSearchInput('');
      setDebouncedQuery('');
      setHubItems([]);
      setHubTotal(0);
      setHubNextPage(1);
      setHubFetchError(null);
      setHubLoading(false);
    }
  }, [open]);

  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedQuery(searchInput), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [searchInput]);

  useEffect(() => {
    if (!open) return;

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
  }, [debouncedQuery, t, open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

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

  const togglePick = (row: CreateEmployeeSkillOptionRow) => {
    onSelectedSkillsChange(toggleSelectedSkillRow(row, selectedSkills));
  };

  const qTrim = debouncedQuery.trim();
  const showLoadMore = Boolean(qTrim) && hubItems.length < hubTotal && !hubLoading;

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-employee-skill-picker-title"
      data-testid="create-digital-employee-skill-picker"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="flex max-h-[min(85vh,640px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-black/10 bg-white shadow-2xl dark:border-white/10 dark:bg-black"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-black/10 px-4 py-3 dark:border-white/10">
          <h2 id="create-employee-skill-picker-title" className="text-base font-semibold text-black dark:text-white">
            {t('createDigitalEmployee.skillPickerTitle')}
          </h2>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full"
            aria-label={t('common:actions.close')}
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="min-h-0 flex flex-1 flex-col gap-2 p-4">
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
              'min-h-0 flex-1 rounded-xl border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.03] overflow-y-auto overflow-x-hidden',
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
                  const selected = isSlugInSelectedSkills(row.slug, selectedSkills);
                  return (
                    <li key={`${row.section}-${row.slug}`}>
                      <button
                        type="button"
                        onClick={() => togglePick(row)}
                        className={cn(
                          'w-full text-left px-3 py-2.5 flex items-start justify-between gap-2 text-[13px] transition-colors',
                          'hover:bg-black/5 dark:hover:bg-white/10',
                          selected && 'bg-black/8 dark:bg-white/10',
                        )}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="font-medium text-black dark:text-white block truncate">{row.title}</span>
                          <span className="text-[11px] font-mono text-black/50 dark:text-white/45 block truncate">
                            {row.slug}
                          </span>
                          {row.description ? (
                            <span className="text-[11px] text-black/45 dark:text-white/40 line-clamp-2 mt-0.5">
                              {row.description}
                            </span>
                          ) : null}
                        </span>
                        <span className="shrink-0 flex flex-col items-end gap-0.5 text-[10px] uppercase tracking-wide">
                          {row.section === 'local-only' ? (
                            <span className="text-black/45 dark:text-white/40">{t('createDigitalEmployee.skillLocalOnly')}</span>
                          ) : null}
                          <span
                            className={
                              row.installed ? 'text-emerald-700 dark:text-emerald-400' : 'text-black/50 dark:text-white/45'
                            }
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

        <div className="shrink-0 border-t border-black/10 px-4 py-3 dark:border-white/10">
          <Button type="button" className="w-full rounded-xl" onClick={onClose}>
            {t('createDigitalEmployee.skillPickerDone')}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function CreateEmployeeSkillField({ selectedSkills, onSelectedSkillsChange }: CreateEmployeeSkillFieldProps) {
  const { t } = useTranslation('employees');
  const [pickerOpen, setPickerOpen] = useState(false);

  const removeSlug = (slug: string) => {
    const k = normalizeCommandName(slug);
    onSelectedSkillsChange(selectedSkills.filter((s) => normalizeCommandName(s.slug) !== k));
  };

  return (
    <div className="space-y-2.5" data-testid="create-digital-employee-skills-section">
      <div>
        <Label className="text-[14px] text-black/80 dark:text-white/80 font-bold inline-flex flex-wrap items-baseline gap-x-1 gap-y-0">
          <span>{t('createDigitalEmployee.skillsLabel')}</span>
          {selectedSkills.length > 0 ? (
            <span className="font-semibold tabular-nums text-black/70 dark:text-white/70">
              {t('createDigitalEmployee.skillsCountSuffix', { count: selectedSkills.length })}
            </span>
          ) : null}
        </Label>
        <p className="text-[12px] text-black/55 dark:text-white/50 mt-1">{t('createDigitalEmployee.skillsHint')}</p>
      </div>

      {selectedSkills.length > 0 ? (
        <ul className="rounded-xl border border-black/10 dark:border-white/10 divide-y divide-black/10 dark:divide-white/10 overflow-hidden">
          {selectedSkills.map((item) => (
            <li key={item.slug} className="flex items-start gap-2 px-3 py-2.5 bg-black/[0.02] dark:bg-white/[0.03]">
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-medium text-black dark:text-white truncate">{item.title}</div>
                <div className="text-[11px] text-black/55 dark:text-white/45 mt-0.5 break-words">
                  <span className="font-mono">{item.slug}</span>
                  {item.description ? (
                    <>
                      <span className="mx-1 opacity-50">·</span>
                      <span>{item.description}</span>
                    </>
                  ) : null}
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-black/60 hover:text-black dark:text-white/60 dark:hover:text-white"
                aria-label={t('createDigitalEmployee.removeSkillRow')}
                onClick={() => removeSlug(item.slug)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}

      <Button
        type="button"
        variant="outline"
        data-testid="create-digital-employee-select-skills-button"
        className="w-full h-10 rounded-xl text-[13px] border-black/20 dark:border-white/20"
        onClick={() => setPickerOpen(true)}
      >
        {t('createDigitalEmployee.selectSkillsButton')}
      </Button>

      <CreateEmployeeSkillPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        selectedSkills={selectedSkills}
        onSelectedSkillsChange={onSelectedSkillsChange}
      />
    </div>
  );
}
