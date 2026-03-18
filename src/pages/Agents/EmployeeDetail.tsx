/**
 * Employee Detail Component
 * Displays detailed information about an employee in a sidebar
 */
import { useTranslation } from 'react-i18next';
import type { Employee } from '@/types/employee';
import { useEmployeesStore } from '@/stores/employees';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

interface EmployeeDetailProps {
  employee: Employee;
  onClose: () => void;
}

export function EmployeeDetail({ employee, onClose }: EmployeeDetailProps) {
  const { t } = useTranslation('employees');
  const { addEmployee, removeEmployee, isEmployeeAdded } = useEmployeesStore();
  const isAdded = isEmployeeAdded(employee.id);

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
      <div className="p-5 border-b flex items-start justify-between">
        <div className="flex items-center gap-3">
          <span className="text-4xl">{employee.emoji}</span>
          <div>
            <h3 className="text-[17px] font-semibold text-foreground">{employee.nameZh}</h3>
            <p className="text-[13px] text-muted-foreground">{employee.name}</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-5 space-y-5">
        {/* Department */}
        <div>
          <h4 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
            {t('department')}
          </h4>
          <div className="flex items-center gap-1.5 text-[14px] text-foreground">
            <span>{employee.emoji}</span>
            <span>{t(`departments.${employee.department}`)}</span>
          </div>
        </div>

        {/* Vibe */}
        {employee.vibe && (
          <div>
            <h4 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
              {t('vibe')}
            </h4>
            <p className="text-[14px] text-foreground/80 italic">{employee.vibe}</p>
          </div>
        )}

        {/* Description */}
        <div>
          <h4 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
            {t('description')}
          </h4>
          <p className="text-[14px] text-foreground leading-relaxed">{employee.description}</p>
        </div>

        {/* ID */}
        <div>
          <h4 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
            {t('employeeId')}
          </h4>
          <code className="text-xs bg-secondary px-2 py-1.5 rounded-md block text-muted-foreground truncate">
            {employee.id}
          </code>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="p-5 border-t">
        <Button
          variant={isAdded ? 'outline' : 'default'}
          className="w-full rounded-full"
          onClick={handleAddRemove}
        >
          {isAdded ? t('remove') : t('addToMyEmployees')}
        </Button>
      </div>
    </div>
  );
}