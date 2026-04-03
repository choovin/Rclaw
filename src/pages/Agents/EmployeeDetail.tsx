/**
 * Employee Detail Component
 * Displays detailed information about an employee in a sidebar
 */
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Employee } from '@/types/employee';
import type { AgentSummary } from '@/types/agent';
import type { GatewayStatus } from '@/types/gateway';
import { useEmployeesStore } from '@/stores/employees';
import { provisionStageToIndex } from '@/lib/employee-provision-stages';
import { Button } from '@/components/ui/button';
import { AddProgress, type StepConfig } from '@/components/ui/add-progress';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmployeeRemoveDialog } from '@/components/common/EmployeeRemoveDialog';
import { AlertCircle, Loader2, Plus, Settings2, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { AgentSettingsModal, type ChannelGroupItem } from './AgentSettingsModal';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';

const DEPARTMENT_COLORS: Record<string, string> = {
  engineering: '#3b82f6',
  design: '#ec4899',
  marketing: '#f97316',
  sales: '#22c55e',
  product: '#8b5cf6',
  'project-management': '#06b6d4',
  academic: '#eab308',
  'game-development': '#ef4444',
  support: '#8b5cf6',
  testing: '#06b6d4',
  integrations: '#6b7280',
  specialized: '#f97316',
  'spatial-computing': '#3b82f6',
  'paid-media': '#f97316',
  strategy: '#6b7280',
};

function getAvatarColor(department: string): string {
  return DEPARTMENT_COLORS[department] || '#6b7280';
}

interface EmployeeDetailProps {
  employee: Employee;
  onClose: () => void;
  agents: AgentSummary[];
  channelGroups: ChannelGroupItem[];
  gatewayStatus: GatewayStatus;
  agentsError: string | null;
  onRefreshAgents?: () => void;
}

export function EmployeeDetail({
  employee,
  onClose,
  agents,
  channelGroups,
  gatewayStatus,
  agentsError,
  onRefreshAgents,
}: EmployeeDetailProps) {
  const { t } = useTranslation('employees');
  const { t: tAgents } = useTranslation('agents');
  const { addEmployee, removeEmployee, isEmployeeAdded } = useEmployeesStore();
  const myEmployees = useEmployeesStore((s) => s.myEmployees);
  const linkedRow = myEmployees.find((e) => e.id === employee.id);
  const linkedAgentId = linkedRow?.linkedAgentId?.trim();
  const isAdded = isEmployeeAdded(employee.id);
  const [addProgress, setAddProgress] = useState<number | null>(null);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [missingLinkOpen, setMissingLinkOpen] = useState(false);
  const [runtimeSettingsOpen, setRuntimeSettingsOpen] = useState(false);

  const linkedAgentSummary = useMemo((): AgentSummary | null => {
    if (!linkedAgentId) return null;
    return agents.find((a) => a.id === linkedAgentId) ?? null;
  }, [agents, linkedAgentId]);

  const ADD_STEPS: StepConfig[] = [
    { label: '创建 员工', icon: '🤖' },
    { label: '写入工作区文件', icon: '📝' },
    { label: '校验文件', icon: '✓' },
    { label: '同步并重载 Gateway', icon: '🔄' },
  ];

  const handleAddRemove = async () => {
    if (addProgress !== null) return;

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
    <Sheet
      open
      modal={false}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent
        side="right"
        data-testid="employee-detail-sheet"
        onPointerDownOutside={(event: any) => {
          const target = event?.target as HTMLElement | null | undefined;
          if (target?.closest('[data-agent-settings-modal]')) {
            event.preventDefault();
          }
        }}
        onInteractOutside={(event: any) => {
          const target = event?.target as HTMLElement | null | undefined;
          if (target?.closest('[data-agent-settings-modal]')) {
            event.preventDefault();
          }
        }}
        className="flex h-full min-h-0 w-[min(20rem,calc(100vw-1rem))] max-w-[20rem] flex-col gap-0 border-l p-0 sm:w-80"
      >
        <SheetTitle className="sr-only">
          {employee.nameZh} ({employee.name})
        </SheetTitle>
        <div className="flex min-h-0 flex-1 flex-col bg-card">
      {/* Header */}
      <div className="p-5 border-b flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center text-3xl"
            style={{
              backgroundColor: getAvatarColor(employee.department) + '25',
              border: `2px solid ${getAvatarColor(employee.department)}40`
            }}
          >
            {employee.emoji}
          </div>
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
        {isAdded && linkedAgentId && gatewayStatus.state !== 'running' && (
          <div className="p-3 rounded-xl border border-yellow-500/50 bg-yellow-500/10 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-yellow-600 dark:text-yellow-400 mt-0.5" />
            <span className="text-yellow-700 dark:text-yellow-400 text-xs font-medium leading-relaxed">
              {tAgents('gatewayWarning')}
            </span>
          </div>
        )}

        {agentsError && (
          <div className="p-3 rounded-xl border border-destructive/50 bg-destructive/10 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-destructive mt-0.5" />
            <span className="text-destructive text-xs font-medium leading-relaxed">{agentsError}</span>
          </div>
        )}

        {isAdded && linkedAgentId && !linkedAgentSummary && (
          <div className="p-3 rounded-xl border border-destructive/50 bg-destructive/10">
            <p className="text-xs font-medium text-destructive">{t('errors.agentNotInSnapshotTitle')}</p>
            <p className="text-xs text-destructive/90 mt-1">{t('errors.agentNotInSnapshot')}</p>
          </div>
        )}

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
            <p className="text-[14px] text-foreground/80 italic">{employee.vibeZh || employee.vibe}</p>
          </div>
        )}

        {/* Description - prefer Chinese description */}
        <div>
          <h4 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
            {t('description')}
          </h4>
          <p className="text-[14px] text-foreground leading-relaxed">{employee.descriptionZh || employee.description}</p>
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
      <div className="p-5 border-t space-y-2">
        {isAdded && linkedAgentSummary && (
          <Button
            variant="secondary"
            className="w-full rounded-full"
            onClick={() => setRuntimeSettingsOpen(true)}
          >
            <Settings2 className="h-4 w-4 mr-2" />
            {t('openRuntimeSettings')}
          </Button>
        )}

        <Button
          variant={isAdded ? 'outline' : 'default'}
          className="w-full rounded-full"
          onClick={handleAddRemove}
          disabled={addProgress !== null}
        >
          {addProgress !== null ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : isAdded ? (
            <Trash2 className="h-4 w-4 mr-2" />
          ) : (
            <Plus className="h-4 w-4 mr-2" />
          )}
          {addProgress !== null ? t('adding') : isAdded ? t('remove') : t('addToMyEmployees')}
        </Button>

        {addProgress !== null && (
          <div className="mt-2">
            <AddProgress currentStep={addProgress} steps={ADD_STEPS} isComplete={false} />
          </div>
        )}
      </div>
        </div>
      </SheetContent>
    </Sheet>

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

    {runtimeSettingsOpen && linkedAgentSummary && (
      <AgentSettingsModal
        agent={linkedAgentSummary}
        channelGroups={channelGroups}
        onClose={() => {
          setRuntimeSettingsOpen(false);
          onRefreshAgents?.();
        }}
      />
    )}
    </>
  );
}