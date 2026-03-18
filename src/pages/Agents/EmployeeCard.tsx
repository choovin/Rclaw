/**
 * Employee Card Component
 * Displays an employee in the marketplace or my employees list
 */
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import type { EmployeeWithStatus } from '@/types/employee';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { useEmployeesStore } from '@/stores/employees';

interface EmployeeCardProps {
  employee: EmployeeWithStatus;
  onClick?: () => void;
  showAddButton?: boolean;
  className?: string;
}

export function EmployeeCard({
  employee,
  onClick,
  showAddButton = true,
  className,
}: EmployeeCardProps) {
  const { t } = useTranslation('employees');
  const { addEmployee, removeEmployee, isEmployeeAdded } = useEmployeesStore();
  const isAdded = isEmployeeAdded(employee.id);

  const handleAddClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isAdded) {
      removeEmployee(employee.id);
    } else {
      addEmployee(employee);
    }
  };

  return (
    <div
      onClick={onClick}
      className={cn(
        'employee-card bg-card border border-border/40 rounded-2xl p-5 hover:shadow-md transition-all cursor-pointer',
        className
      )}
    >
      {/* Department Tag */}
      <div className="flex items-center gap-1.5 mb-3">
        <span className="text-sm">{employee.emoji}</span>
        <span className="text-xs text-muted-foreground">
          {t(`departments.${employee.department}`)}
        </span>
      </div>

      {/* Chinese Name (Primary) */}
      <h3 className="text-[17px] font-semibold text-foreground mb-0.5">
        {employee.nameZh}
      </h3>

      {/* English Name */}
      <p className="text-[13px] text-muted-foreground mb-3">
        {employee.name}
      </p>

      {/* Vibe */}
      {employee.vibe && (
        <p className="text-[13px] text-foreground/70 mb-3 line-clamp-2">
          {employee.vibe}
        </p>
      )}

      {/* Description */}
      <p className="text-[13px] text-muted-foreground line-clamp-2 mb-4">
        {employee.description}
      </p>

      {/* Add Button */}
      {showAddButton && (
        <Button
          size="sm"
          className="w-full rounded-full"
          variant={isAdded ? 'outline' : 'default'}
          onClick={handleAddClick}
        >
          <Plus className="h-4 w-4 mr-1" />
          {isAdded ? t('remove') : t('addEmployee')}
        </Button>
      )}
    </div>
  );
}