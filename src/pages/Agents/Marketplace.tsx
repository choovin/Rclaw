/**
 * Marketplace Component
 * Displays all available employees that can be added (Claw Catalog API)
 */
import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EmployeeCard } from './EmployeeCard';
import { EmployeeDetail } from './EmployeeDetail';
import { useEmployeesStore } from '@/stores/employees';
import { useClawCatalogMarketStore } from '@/stores/claw-catalog-market';
import type { EmployeeWithStatus } from '@/types/employee';
import { cn } from '@/lib/utils';
import type { AgentSummary } from '@/types/agent';
import type { GatewayStatus } from '@/types/gateway';
import type { ChannelGroupItem } from './AgentSettingsModal';
import { AlertCircle } from 'lucide-react';

function MarketplaceGridSkeleton({ count = 9 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 pb-4 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse rounded-2xl border border-border/40 bg-card p-5"
          aria-hidden
        >
          <div className="mb-3 flex items-center gap-1.5">
            <div className="h-4 w-4 rounded bg-muted" />
            <div className="h-3 w-16 rounded bg-muted" />
          </div>
          <div className="mx-auto mb-3 h-16 w-16 rounded-full bg-muted" />
          <div className="mb-2 h-5 w-3/4 rounded bg-muted" />
          <div className="mb-3 h-4 w-1/2 rounded bg-muted" />
          <div className="mb-3 h-10 w-full rounded-lg bg-muted" />
          <div className="h-9 w-full rounded-full bg-muted" />
        </div>
      ))}
    </div>
  );
}

const SEARCH_DEBOUNCE_MS = 400;

export interface MarketplaceProps {
  agents: AgentSummary[];
  channelGroups: ChannelGroupItem[];
  gatewayStatus: GatewayStatus;
  agentsError: string | null;
  searchQuery: string;
  onRefreshAgents?: () => void;
}

export function Marketplace({
  agents,
  channelGroups,
  gatewayStatus,
  agentsError,
  searchQuery,
  onRefreshAgents,
}: MarketplaceProps) {
  const { t } = useTranslation('employees');
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastBottomLoadRef = useRef(0);

  const myEmployees = useEmployeesStore((s) => s.myEmployees);
  const {
    setSelectedEmployee,
    selectedEmployee,
  } = useEmployeesStore();

  const departments = useClawCatalogMarketStore((s) => s.departments);
  const departmentsLoading = useClawCatalogMarketStore((s) => s.departmentsLoading);
  const departmentsError = useClawCatalogMarketStore((s) => s.departmentsError);
  const loadDepartments = useClawCatalogMarketStore((s) => s.loadDepartments);

  const items = useClawCatalogMarketStore((s) => s.items);
  const total = useClawCatalogMarketStore((s) => s.total);
  const loading = useClawCatalogMarketStore((s) => s.loading);
  const loadingMore = useClawCatalogMarketStore((s) => s.loadingMore);
  const listError = useClawCatalogMarketStore((s) => s.listError);
  const selectedDepartmentId = useClawCatalogMarketStore((s) => s.selectedDepartmentId);
  const setSelectedDepartmentId = useClawCatalogMarketStore((s) => s.setSelectedDepartmentId);
  const applyDebouncedSearch = useClawCatalogMarketStore((s) => s.applyDebouncedSearch);
  const resetAndFetch = useClawCatalogMarketStore((s) => s.resetAndFetch);
  const loadMore = useClawCatalogMarketStore((s) => s.loadMore);

  const [debouncedSearch, setDebouncedSearch] = useState(searchQuery);

  useEffect(() => {
    const tid = window.setTimeout(() => setDebouncedSearch(searchQuery), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(tid);
  }, [searchQuery]);

  useEffect(() => {
    void loadDepartments();
  }, [loadDepartments]);

  useEffect(() => {
    applyDebouncedSearch(debouncedSearch);
  }, [debouncedSearch, applyDebouncedSearch]);

  const addedIds = useMemo(() => new Set(myEmployees.map((e) => e.id)), [myEmployees]);

  const listWithStatus: EmployeeWithStatus[] = useMemo(
    () =>
      items.map((emp) => ({
        ...emp,
        isAdded: addedIds.has(emp.id),
      })),
    [items, addedIds],
  );

  const scheduleLoadMore = useCallback(() => {
    const now = Date.now();
    if (now - lastBottomLoadRef.current < 400) return;
    lastBottomLoadRef.current = now;
    void loadMore();
  }, [loadMore]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const gap = el.scrollHeight - el.scrollTop - el.clientHeight;
      if (gap > 400) return;
      scheduleLoadMore();
    };
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
  }, [scheduleLoadMore]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const fill = () => {
      if (loading || loadingMore || items.length === 0 || items.length >= total) return;
      if (el.scrollHeight <= el.clientHeight + 160) {
        scheduleLoadMore();
      }
    };
    fill();
    if (typeof ResizeObserver === 'undefined') {
      return;
    }
    const ro = new ResizeObserver(fill);
    ro.observe(el);
    return () => ro.disconnect();
  }, [items.length, total, loading, loadingMore, scheduleLoadMore]);

  const handleEmployeeClick = (employee: EmployeeWithStatus) => {
    setSelectedEmployee(employee);
  };

  const showListSkeleton = loading && items.length === 0;

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="employees-marketplace">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div
          className="mb-4 flex flex-wrap gap-2 overflow-x-auto pb-2"
          data-testid="employees-marketplace-departments"
        >
          {departmentsError ? (
            <div className="flex w-full items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{departmentsError}</span>
              <button
                type="button"
                className="underline"
                onClick={() => void loadDepartments()}
              >
                {t('retry', { defaultValue: '重试' })}
              </button>
            </div>
          ) : (
            <>
              <button
                type="button"
                className={cn(
                  'whitespace-nowrap rounded-full px-4 py-1.5 text-[13px] font-medium transition-all',
                  selectedDepartmentId === 'all'
                    ? 'bg-foreground text-background'
                    : 'border border-border/40 bg-transparent text-foreground/70 hover:bg-secondary',
                )}
                onClick={() => setSelectedDepartmentId('all')}
              >
                {t('allDepartments')}
              </button>
              {departmentsLoading && departments.length === 0 ? (
                <span className="text-sm text-muted-foreground">{t('loading', { defaultValue: '…' })}</span>
              ) : (
                departments.map((dept) => (
                  <button
                    key={dept.id}
                    type="button"
                    className={cn(
                      'whitespace-nowrap rounded-full px-4 py-1.5 text-[13px] font-medium transition-all',
                      selectedDepartmentId === dept.id
                        ? 'bg-foreground text-background'
                        : 'border border-border/40 bg-transparent text-foreground/70 hover:bg-secondary',
                    )}
                    onClick={() => startTransition(() => setSelectedDepartmentId(dept.id))}
                  >
                    {dept.departmentNameZh}
                  </button>
                ))
              )}
            </>
          )}
        </div>

        <div ref={scrollRef} className="flex-1 overflow-auto pr-1">
          {showListSkeleton ? (
            <div aria-busy="true" aria-live="polite">
              <MarketplaceGridSkeleton />
            </div>
          ) : listError && items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
              <p className="text-sm">{listError}</p>
              <button
                type="button"
                className="mt-2 text-sm underline"
                onClick={() => void resetAndFetch()}
              >
                {t('retry', { defaultValue: '重试' })}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 pb-4 md:grid-cols-2 lg:grid-cols-3">
              {listWithStatus.length > 0 ? (
                listWithStatus.map((employee) => (
                  <EmployeeCard
                    key={employee.id}
                    employee={employee}
                    onClick={() => handleEmployeeClick(employee)}
                  />
                ))
              ) : (
                <div className="col-span-full flex items-center justify-center py-12 text-muted-foreground">
                  {t('noEmployees')}
                </div>
              )}
            </div>
          )}
          {listError && items.length > 0 ? (
            <div className="flex items-center gap-2 py-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{listError}</span>
              <button type="button" className="underline" onClick={() => void loadMore()}>
                {t('retry', { defaultValue: '重试' })}
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {selectedEmployee && (
        <EmployeeDetail
          employee={selectedEmployee}
          onClose={() => setSelectedEmployee(null)}
          agents={agents}
          channelGroups={channelGroups}
          gatewayStatus={gatewayStatus}
          agentsError={agentsError}
          onRefreshAgents={onRefreshAgents}
        />
      )}
    </div>
  );
}
