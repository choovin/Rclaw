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
import { Badge } from '@/components/ui/badge';

export function Marketplace() {
  const { t } = useTranslation('employees');
  const [searchQuery, setSearchQuery] = useState('');

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
    const loadEmployees = async () => {
      try {
        const response = await fetch('/data/employees/index.json');
        const data: EmployeeWithStatus[] = await response.json();

        // Add isAdded property to each employee
        const employeesWithStatus = data.map((emp) => ({
          ...emp,
          isAdded: false,
        }));

        setEmployees(employeesWithStatus);
      } catch (error) {
        console.error('Failed to load employees:', error);
      }
    };

    if (employees.length === 0) {
      loadEmployees();
    }
  }, [setEmployees, employees.length]);

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

  // Group employees by department for display
  const groupedEmployees = filteredEmployees.reduce((acc, emp) => {
    if (!acc[emp.department]) {
      acc[emp.department] = [];
    }
    acc[emp.department].push(emp);
    return acc;
  }, {} as Record<string, EmployeeWithStatus[]>);

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
        <div className="mb-4 flex flex-wrap gap-2">
          <Badge
            variant={selectedDepartment === 'all' ? 'default' : 'outline'}
            className="cursor-pointer hover:bg-primary/10"
            onClick={() => setSelectedDepartment('all')}
          >
            {t('allDepartments')}
          </Badge>
          {departments.map((dept) => (
            <Badge
              key={dept.id}
              variant={selectedDepartment === dept.id ? 'default' : 'outline'}
              className="cursor-pointer hover:bg-primary/10"
              onClick={() => setSelectedDepartment(dept.id as Department)}
            >
              {dept.emoji} {dept.nameZh}
            </Badge>
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