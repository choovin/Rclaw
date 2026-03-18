/**
 * Employee Card Component
 * Displays an employee in the marketplace or my employees list
 */
import { cn } from '@/lib/utils';
import type { EmployeeWithStatus } from '@/types/employee';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useEmployeesStore } from '@/stores/employees';

interface EmployeeCardProps {
  employee: EmployeeWithStatus;
  onClick?: () => void;
  showAddButton?: boolean;
  className?: string;
}

const colorVariants = {
  green: 'bg-green-500/10 border-green-500/20 text-green-600 dark:text-green-400',
  blue: 'bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400',
  purple: 'bg-purple-500/10 border-purple-500/20 text-purple-600 dark:text-purple-400',
  yellow: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-600 dark:text-yellow-400',
  red: 'bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400',
  pink: 'bg-pink-500/10 border-pink-500/20 text-pink-600 dark:text-pink-400',
  orange: 'bg-orange-500/10 border-orange-500/20 text-orange-600 dark:text-orange-400',
  cyan: 'bg-cyan-500/10 border-cyan-500/20 text-cyan-600 dark:text-cyan-400',
};

export function EmployeeCard({
  employee,
  onClick,
  showAddButton = true,
  className,
}: EmployeeCardProps) {
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
        'group relative flex flex-col rounded-xl border bg-card p-4 transition-all duration-200',
        'hover:shadow-lg hover:scale-[1.02] cursor-pointer',
        'border-border/50 hover:border-border',
        colorVariants[employee.color as keyof typeof colorVariants] || colorVariants.blue,
        className
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{employee.emoji}</span>
          <div>
            <h3 className="font-semibold text-foreground">{employee.nameZh}</h3>
            <p className="text-sm text-muted-foreground">{employee.name}</p>
          </div>
        </div>
        {employee.isAdded && (
          <Badge variant="secondary" className="text-xs">
            已添加
          </Badge>
        )}
      </div>

      {/* Description */}
      <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
        {employee.description}
      </p>

      {/* Vibe */}
      <p className="text-xs text-muted-foreground/70 italic mb-4 line-clamp-1">
        {employee.vibe}
      </p>

      {/* Actions */}
      {showAddButton && (
        <div className="mt-auto">
          <Button
            variant={isAdded ? 'outline' : 'default'}
            size="sm"
            onClick={handleAddClick}
            className="w-full"
          >
            {isAdded ? '移除' : '添加'}
          </Button>
        </div>
      )}
    </div>
  );
}