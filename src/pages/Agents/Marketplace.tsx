/**
 * Marketplace Component
 * Displays all available employees that can be added
 */
import { startTransition, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EmployeeCard } from './EmployeeCard';
import { EmployeeDetail } from './EmployeeDetail';
import { useEmployeesStore, getAllDepartments } from '@/stores/employees';
import type { Employee, EmployeeWithStatus, Department } from '@/types/employee';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { AgentSummary } from '@/types/agent';
import type { GatewayStatus } from '@/types/gateway';
import type { ChannelGroupItem } from './AgentSettingsModal';

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

export interface MarketplaceProps {
  agents: AgentSummary[];
  channelGroups: ChannelGroupItem[];
  gatewayStatus: GatewayStatus;
  agentsError: string | null;
  onRefreshAgents?: () => void;
}

export function Marketplace({
  agents,
  channelGroups,
  gatewayStatus,
  agentsError,
  onRefreshAgents,
}: MarketplaceProps) {
  const { t } = useTranslation('employees');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const {
    setEmployees,
    selectedDepartment,
    setSelectedDepartment,
    selectedEmployee,
    setSelectedEmployee,
    getFilteredEmployees,
  } = useEmployeesStore();

  const departments = getAllDepartments();

  // Async-load catalog JSON (separate chunk) + defer heavy store update so the shell paints first.
  useEffect(() => {
    if (isLoaded) return;

    const cached = useEmployeesStore.getState().employees;
    if (cached.length > 0) {
      startTransition(() => setIsLoaded(true));
      return;
    }

    let cancelled = false;
    const frame = requestAnimationFrame(() => {
      void import('@/data/employees/index.json')
        .then((mod) => {
          if (cancelled) return;
          const raw = mod.default as unknown as Employee[];
          startTransition(() => {
            if (cancelled) return;
            const employeesWithStatus: EmployeeWithStatus[] = raw.map((emp) => ({
              ...emp,
              isAdded: false,
            }));
            setEmployees(employeesWithStatus);
            setIsLoaded(true);
            setLoadError(null);
          });
        })
        .catch((err: unknown) => {
          if (!cancelled) {
            setLoadError(err instanceof Error ? err.message : String(err));
            setIsLoaded(true);
          }
        });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [setEmployees, isLoaded]);

  // Filter employees by search query
  const filteredEmployees = getFilteredEmployees().filter((emp) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      emp.name.toLowerCase().includes(query) ||
      emp.nameZh.includes(query) ||
      emp.description.toLowerCase().includes(query)
    );
  });

  const handleEmployeeClick = (employee: EmployeeWithStatus) => {
    setSelectedEmployee(employee);
  };

  return (
    <div className="flex h-full gap-4">
      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Search */}
        <div className="mb-4">
          <Input
            placeholder={t('searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-md"
          />
        </div>

        {/* Department Filter */}
        <div className="mb-4 flex flex-wrap gap-2 overflow-x-auto pb-2">
          <button
            className={cn(
              "px-4 py-1.5 rounded-full text-[13px] font-medium transition-all whitespace-nowrap",
              selectedDepartment === 'all'
                ? "bg-foreground text-background"
                : "border border-border/40 bg-transparent text-foreground/70 hover:bg-secondary"
            )}
            onClick={() => setSelectedDepartment('all')}
          >
            {t('allDepartments')}
          </button>
          {departments.map((dept) => (
            <button
              key={dept.id}
              className={cn(
                "px-4 py-1.5 rounded-full text-[13px] font-medium transition-all whitespace-nowrap",
                selectedDepartment === dept.id
                  ? "bg-foreground text-background"
                  : "border border-border/40 bg-transparent text-foreground/70 hover:bg-secondary"
              )}
              onClick={() => setSelectedDepartment(dept.id as Department)}
            >
              {dept.emoji} {dept.nameZh}
            </button>
          ))}
        </div>

        {/* Employees Grid */}
        <div className="flex-1 overflow-auto pr-1">
          {!isLoaded ? (
            <div aria-busy="true" aria-live="polite">
              <MarketplaceGridSkeleton />
            </div>
          ) : loadError ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
              <p className="text-sm">{loadError}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 pb-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredEmployees.length > 0 ? (
                filteredEmployees.map((employee) => (
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
        </div>
      </div>

      {/* Detail Sidebar */}
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