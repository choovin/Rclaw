/**
 * Employee Card Component
 * Displays an employee in the marketplace or my employees list
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import type { EmployeeWithStatus } from '@/types/employee';
import { Button } from '@/components/ui/button';
import { AddProgress, type StepConfig } from '@/components/ui/add-progress';
import { Plus } from 'lucide-react';
import { useEmployeesStore } from '@/stores/employees';
import { provisionStageToIndex } from '@/lib/employee-provision-stages';

const DEPARTMENT_COLORS: Record<string, string> = {
  engineering: 'from-blue-500 to-blue-600',
  design: 'from-pink-500 to-rose-500',
  marketing: 'from-orange-500 to-orange-600',
  sales: 'from-green-500 to-green-600',
  product: 'from-purple-500 to-purple-600',
  'project-management': 'from-yellow-500 to-yellow-600',
  academic: 'from-indigo-500 to-indigo-600',
  'game-development': 'from-red-500 to-red-600',
  strategy: 'from-gray-600 to-gray-700',
  support: 'from-cyan-500 to-cyan-600',
  testing: 'from-amber-500 to-amber-600',
  integrations: 'from-teal-500 to-teal-600',
  specialized: 'from-violet-500 to-violet-600',
  'spatial-computing': 'from-sky-500 to-sky-600',
  'paid-media': 'from-fuchsia-500 to-fuchsia-600',
};

function getAvatarColor(department: string): string {
  return DEPARTMENT_COLORS[department] || 'from-gray-400 to-gray-500';
}

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
  const [addProgress, setAddProgress] = useState<number | null>(null);

  const ADD_STEPS: StepConfig[] = [
    { label: '创建 Agent', icon: '🤖' },
    { label: '写入工作区', icon: '📝' },
    { label: '校验文件', icon: '✓' },
    { label: '同步 Gateway', icon: '🔄' },
  ];

  const handleAddClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isAdded) {
      removeEmployee(employee.id);
      setAddProgress(null);
      return;
    }
    setAddProgress(0);
    try {
      await addEmployee(employee, (stage) => {
        setAddProgress(provisionStageToIndex(stage));
      });
    } finally {
      setAddProgress(null);
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

      {/* Prototype Avatar */}
      <div
        className={cn(
          'w-16 h-16 rounded-full bg-gradient-to-br mb-3 mx-auto',
          getAvatarColor(employee.department)
        )}
        style={{ background: `linear-gradient(135deg, ${employee.color}20, ${employee.color}40)` }}
      >
        <div className="w-full h-full flex items-center justify-center text-2xl">
          {employee.emoji}
        </div>
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
      {(employee.vibeZh || employee.vibe) && (
        <p className="text-[13px] text-foreground/70 mb-3 line-clamp-2 italic">
          {employee.vibeZh || employee.vibe}
        </p>
      )}

      {/* Description - prefer Chinese description */}
      <p className="text-[13px] text-muted-foreground line-clamp-2 mb-4">
        {employee.descriptionZh || employee.description}
      </p>

      {/* Add Progress or Button */}
      {showAddButton && (
        <div className="mt-2">
          {addProgress !== null ? (
            <AddProgress
              currentStep={addProgress}
              steps={ADD_STEPS}
              isComplete={false}
            />
          ) : (
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
      )}
    </div>
  );
}