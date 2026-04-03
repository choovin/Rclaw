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
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmployeeRemoveDialog } from '@/components/common/EmployeeRemoveDialog';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
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
  const myEmployees = useEmployeesStore((s) => s.myEmployees);
  const linkedRow = myEmployees.find((e) => e.id === employee.id);
  const linkedAgentId = linkedRow?.linkedAgentId?.trim();
  const isAdded = isEmployeeAdded(employee.id);
  const [addProgress, setAddProgress] = useState<number | null>(null);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [missingLinkOpen, setMissingLinkOpen] = useState(false);

  const ADD_STEPS: StepConfig[] = [
    { label: '创建 员工', icon: '🤖' },
    { label: '写入工作区', icon: '📝' },
    { label: '校验文件', icon: '✓' },
    { label: '同步 Gateway', icon: '🔄' },
  ];

  const handleAddClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isAdded) {
      if (!linkedAgentId) {
        setMissingLinkOpen(true);
        return;
      }
      setRemoveOpen(true);
      return;
    }
    setAddProgress(0);
    try {
      const success = await addEmployee(employee, (stage) => {
        setAddProgress(provisionStageToIndex(stage));
      });
      if (success) {
        toast.success(t('addSuccess'));
      } else if (isEmployeeAdded(employee.id)) {
        toast.error(t('errors.addMustRemoveFirst'));
      } else {
        toast.error(t('addFailed'));
      }
    } finally {
      setAddProgress(null);
    }
  };

  return (
    <>
    <div
      onClick={onClick}
      className={cn(
        'employee-card flex h-full flex-col bg-card border border-border/40 rounded-2xl p-5 hover:shadow-md transition-all cursor-pointer',
        className
      )}
    >
      <div className="flex min-h-0 flex-1 flex-col">
        {/* Department Tag */}
        <div className="mb-3 flex items-center gap-1.5">
          <span className="text-sm">{employee.emoji}</span>
          <span className="text-xs text-muted-foreground">
            {t(`departments.${employee.department}`)}
          </span>
        </div>

        {/* Prototype Avatar */}
        <div
          className={cn(
            'mx-auto mb-3 h-16 w-16 rounded-full bg-gradient-to-br',
            getAvatarColor(employee.department)
          )}
          style={{ background: `linear-gradient(135deg, ${employee.color}20, ${employee.color}40)` }}
        >
          <div className="flex h-full w-full items-center justify-center text-2xl">
            {employee.emoji}
          </div>
        </div>

        {/* Chinese Name (Primary) */}
        <h3 className="mb-0.5 text-[17px] font-semibold text-foreground">
          {employee.nameZh}
        </h3>

        {/* English Name */}
        <p className="mb-3 text-[13px] text-muted-foreground">
          {employee.name}
        </p>


        {/* Description：flex 子项默认 min-height:auto 会按全文撑开，必须包一层并 overflow-hidden */}
        <div className="min-h-0 min-w-0 w-full overflow-hidden">
          <p className="line-clamp-2 break-words text-[13px] leading-snug text-muted-foreground [overflow-wrap:anywhere]">
            {employee.descriptionZh || employee.description}
          </p>
        </div>
      </div>

      {/* Add Progress or Button — 同行卡片底部对齐 */}
      {showAddButton && (
        <div className="mt-3 shrink-0">
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
              <Plus className="mr-1 h-4 w-4" />
              {isAdded ? t('remove') : t('addEmployee')}
            </Button>
          )}
        </div>
      )}
    </div>

    <ConfirmDialog
      open={missingLinkOpen}
      title={t('errors.missingLinkedAgentTitle')}
      message={t('errors.missingLinkedAgent')}
      confirmLabel={t('common:actions.confirm')}
      cancelLabel={t('common:actions.cancel')}
      variant="default"
      onConfirm={() => setMissingLinkOpen(false)}
      onCancel={() => setMissingLinkOpen(false)}
    />

    <EmployeeRemoveDialog
      key={`${employee.id}-${removeOpen}`}
      open={removeOpen}
      onCancel={() => setRemoveOpen(false)}
      onConfirm={async () => {
        try {
          await removeEmployee(employee.id);
          setRemoveOpen(false);
          toast.success(t('removeSuccess'));
        } catch (err) {
          toast.error(err instanceof Error ? err.message : String(err));
        }
      }}
    />
    </>
  );
}