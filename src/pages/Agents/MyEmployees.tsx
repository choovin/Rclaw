/**
 * My Employees Component
 * Displays the list of employees added by the user
 */
import { useTranslation } from 'react-i18next';
import { EmployeeCard } from './EmployeeCard';
import { EmployeeDetail } from './EmployeeDetail';
import { useEmployeesStore } from '@/stores/employees';
import type { Employee } from '@/types/employee';
import { EmployeeWithStatus } from '@/types/employee';

export function MyEmployees() {
  const { t } = useTranslation('employees');
  const { myEmployees, selectedEmployee, setSelectedEmployee } = useEmployeesStore();

  // Convert myEmployees to include isAdded status for the card
  const employeesWithStatus: EmployeeWithStatus[] = myEmployees.map((emp) => ({
    ...emp,
    isAdded: true,
  }));

  const handleEmployeeClick = (employee: Employee) => {
    setSelectedEmployee(employee);
  };

  const handleCloseDetail = () => {
    setSelectedEmployee(null);
  };

  return (
    <div className="flex h-full gap-4">
      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="mb-4">
          <h2 className="text-lg font-semibold">{t('myEmployees')}</h2>
          <p className="text-sm text-muted-foreground">
            {t('myEmployeesDesc', { count: myEmployees.length })}
          </p>
        </div>

        {/* Employees Grid */}
        <div className="flex-1 overflow-auto pr-1">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-4">
            {employeesWithStatus.length > 0 ? (
              employeesWithStatus.map((employee) => (
                <EmployeeCard
                  key={employee.id}
                  employee={employee}
                  onClick={() => handleEmployeeClick(employee)}
                />
              ))
            ) : (
              <div className="col-span-full flex flex-col items-center justify-center py-12 text-muted-foreground">
                <p className="text-lg mb-2">{t('noMyEmployees')}</p>
                <p className="text-sm">{t('noMyEmployeesDesc')}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Detail Sidebar */}
      {selectedEmployee && (
        <EmployeeDetail
          employee={selectedEmployee}
          onClose={handleCloseDetail}
        />
      )}
    </div>
  );
}