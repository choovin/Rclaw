/**
 * Employee Detail Component
 * Displays detailed information about an employee in a sidebar
 */
import { useTranslation } from 'react-i18next';
import type { Employee } from '@/types/employee';
import { useEmployeesStore, getDepartmentInfo } from '@/stores/employees';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface EmployeeDetailProps {
  employee: Employee;
  onClose: () => void;
}

const colorVariants = {
  green: 'bg-green-500/10 text-green-600 dark:text-green-400',
  blue: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  purple: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  yellow: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
  red: 'bg-red-500/10 text-red-600 dark:text-red-400',
  pink: 'bg-pink-500/10 text-pink-600 dark:text-pink-400',
  orange: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
  cyan: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400',
};

export function EmployeeDetail({ employee, onClose }: EmployeeDetailProps) {
  const { t } = useTranslation('employees');
  const { addEmployee, removeEmployee, isEmployeeAdded } = useEmployeesStore();
  const isAdded = isEmployeeAdded(employee.id);

  const departmentInfo = getDepartmentInfo(employee.department);

  const handleAddRemove = () => {
    if (isAdded) {
      removeEmployee(employee.id);
    } else {
      addEmployee(employee);
    }
  };

  return (
    <div className="w-80 shrink-0 border-l bg-card flex flex-col">
      {/* Header */}
      <div className="p-4 border-b flex items-start justify-between">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{employee.emoji}</span>
          <div>
            <h3 className="font-semibold text-lg text-foreground">{employee.nameZh}</h3>
            <p className="text-sm text-muted-foreground">{employee.name}</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 space-y-6">
        {/* Department */}
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-2">
            {t('department')}
          </h4>
          <Badge variant="outline" className={colorVariants[employee.color as keyof typeof colorVariants] || colorVariants.blue}>
            {departmentInfo?.emoji} {departmentInfo?.nameZh}
          </Badge>
        </div>

        {/* Description */}
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-2">
            {t('description')}
          </h4>
          <p className="text-sm text-foreground">{employee.description}</p>
        </div>

        {/* Vibe */}
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-2">
            {t('vibe')}
          </h4>
          <p className="text-sm text-muted-foreground italic">{employee.vibe}</p>
        </div>

        {/* ID */}
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-2">
            {t('employeeId')}
          </h4>
          <code className="text-xs bg-muted px-2 py-1 rounded">{employee.id}</code>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="p-4 border-t">
        <Button
          variant={isAdded ? 'outline' : 'default'}
          className="w-full"
          onClick={handleAddRemove}
        >
          {isAdded ? t('remove') : t('add')}
        </Button>
      </div>
    </div>
  );
}