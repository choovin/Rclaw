/**
 * Marketplace Component
 * Displays all available employees that can be added
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EmployeeCard } from './EmployeeCard';
import { EmployeeDetail } from './EmployeeDetail';
import { useEmployeesStore, getAllDepartments } from '@/stores/employees';
import type { EmployeeWithStatus, Department } from '@/types/employee';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import employeesData from '@/data/employees/index.json';

export function Marketplace() {
  const { t } = useTranslation('employees');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoaded, setIsLoaded] = useState(false);

  const {
    employees,
    setEmployees,
    selectedDepartment,
    setSelectedDepartment,
    selectedEmployee,
    setSelectedEmployee,
    getFilteredEmployees,
  } = useEmployeesStore();

  const departments = getAllDepartments();

  // Load employees on mount
  useEffect(() => {
    if (isLoaded) return;

    // Add isAdded property to each employee
    const employeesWithStatus: EmployeeWithStatus[] = (employeesData as EmployeeWithStatus[]).map((emp) => ({
      ...emp,
      isAdded: false,
    }));

    setEmployees(employeesWithStatus);
    setIsLoaded(true);
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-4">
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
        </div>
      </div>

      {/* Detail Sidebar */}
      {selectedEmployee && (
        <EmployeeDetail
          employee={selectedEmployee}
          onClose={() => setSelectedEmployee(null)}
        />
      )}
    </div>
  );
}