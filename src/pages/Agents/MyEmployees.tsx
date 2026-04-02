/**
 * My Employees Component
 * Displays the list of employees added by the user
 */
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { EmployeeCard } from './EmployeeCard';
import { EmployeeDetail } from './EmployeeDetail';
import { useEmployeesStore } from '@/stores/employees';
import type { Employee } from '@/types/employee';
import { EmployeeWithStatus } from '@/types/employee';
import type { AgentSummary } from '@/types/agent';
import type { GatewayStatus } from '@/types/gateway';
import type { ChannelGroupItem } from './AgentSettingsModal';

export interface MyEmployeesProps {
  agents: AgentSummary[];
  channelGroups: ChannelGroupItem[];
  gatewayStatus: GatewayStatus;
  agentsError: string | null;
  searchQuery: string;
  onRefreshAgents?: () => void;
}

export function MyEmployees({
  agents,
  channelGroups,
  gatewayStatus,
  agentsError,
  searchQuery,
  onRefreshAgents,
}: MyEmployeesProps) {
  const { t } = useTranslation('employees');
  const { myEmployees, selectedEmployee, setSelectedEmployee } = useEmployeesStore();

  // Convert myEmployees to include isAdded status for the card
  const employeesWithStatus: EmployeeWithStatus[] = useMemo(
    () =>
      myEmployees.map((emp) => ({
        ...emp,
        isAdded: true,
      })),
    [myEmployees],
  );

  const filteredEmployees = useMemo(() => {
    if (!searchQuery.trim()) return employeesWithStatus;
    const q = searchQuery.toLowerCase();
    return employeesWithStatus.filter(
      (emp) =>
        emp.name.toLowerCase().includes(q) ||
        emp.nameZh.includes(q) ||
        emp.description.toLowerCase().includes(q),
    );
  }, [employeesWithStatus, searchQuery]);

  const handleEmployeeClick = (employee: Employee) => {
    setSelectedEmployee(employee);
  };

  const handleCloseDetail = () => {
    setSelectedEmployee(null);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="mb-4">
          <h2 className="text-lg font-semibold">{t('myEmployees')}</h2>
          <p className="text-sm text-muted-foreground">
            {t('myEmployeesDesc', { count: myEmployees.length })}
          </p>
        </div>

        {/* Employees Grid */}
        <div className="flex-1 overflow-auto pr-1">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-4">
            {filteredEmployees.length > 0 ? (
              filteredEmployees.map((employee) => (
                <EmployeeCard
                  key={employee.id}
                  employee={employee}
                  onClick={() => handleEmployeeClick(employee)}
                />
              ))
            ) : myEmployees.length === 0 ? (
              <div className="col-span-full flex flex-col items-center justify-center py-12 text-muted-foreground">
                <p className="mb-2 text-lg">{t('noMyEmployees')}</p>
                <p className="text-sm">{t('noMyEmployeesDesc')}</p>
              </div>
            ) : (
              <div className="col-span-full flex items-center justify-center py-12 text-muted-foreground">
                {t('noEmployees')}
              </div>
            )}
          </div>
        </div>
      </div>

      {selectedEmployee && (
        <EmployeeDetail
          employee={selectedEmployee}
          onClose={handleCloseDetail}
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