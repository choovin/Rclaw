/**
 * Employees Store
 * Zustand store for managing digital employees
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { toast } from 'sonner';
import type { Employee } from '@/types/employee';
import { hostApiFetch } from '@/lib/host-api';
import { useAgentsStore } from '@/stores/agents';
import { fetchClawCatalogAgentDetail } from '@/lib/claw-catalog-api';
import { mapCatalogAgentToEmployee } from '@/lib/claw-catalog-map';

/** Thrown when myEmployees row has no linkedAgentId (legacy / corrupt); UI should show errors.missingLinkedAgent. */
export class MissingLinkedAgentError extends Error {
  constructor() {
    super('MISSING_LINKED_AGENT');
    this.name = 'MissingLinkedAgentError';
  }
}

interface EmployeesState {
  myEmployees: Employee[];

  selectedEmployee: Employee | null;

  isLoading: boolean;

  addEmployee: (employee: Employee, onProvisionStage?: (stage: string) => void) => Promise<boolean>;
  removeEmployee: (employeeId: string) => Promise<void>;
  setSelectedEmployee: (employee: Employee | null) => void;
  isEmployeeAdded: (employeeId: string) => boolean;
  /** Drop myEmployees rows whose linkedAgentId no longer exists in OpenClaw (e.g. user edited ~/.openclaw manually). */
  reconcileWithOpenClawAgentIds: (agentIds: string[]) => void;
}

/** Exported for unit tests — trims myEmployees to valid OpenClaw agent ids. */
export function reconcileMyEmployeesWithOpenClawAgentIds(
  myEmployees: Employee[],
  agentIds: string[],
  selectedEmployee: Employee | null,
): { myEmployees: Employee[]; selectedEmployee: Employee | null } {
  const valid = new Set(agentIds.map((id) => id.trim()).filter(Boolean));
  const filtered = myEmployees.filter((e) => {
    const lid = e.linkedAgentId?.trim();
    return Boolean(lid && valid.has(lid));
  });
  const selected =
    selectedEmployee && filtered.some((e) => e.id === selectedEmployee.id) ? selectedEmployee : null;
  return { myEmployees: filtered, selectedEmployee: selected };
}

export const useEmployeesStore = create<EmployeesState>()(
  persist(
    (set, get) => ({
      myEmployees: [],
      selectedEmployee: null,
      isLoading: false,

      addEmployee: async (employee, onProvisionStage) => {
        if (get().isEmployeeAdded(employee.id)) {
          return false;
        }

        const { myEmployees } = get();

        let unsubscribe: (() => void) | undefined;
        if (typeof window !== 'undefined' && window.electron?.ipcRenderer?.on) {
          const dispose = window.electron.ipcRenderer.on('employee-provision:stage', (...args: unknown[]) => {
            const payload = args[0] as { stage?: string } | undefined;
            const stage = payload?.stage;
            if (stage) onProvisionStage?.(stage);
          });
          if (typeof dispose === 'function') unsubscribe = dispose;
        }

        try {
          set({ isLoading: true });

          let payload = employee;

          if (!employee.skipCatalogDetailFetch) {
            try {
              const detailRes = await fetchClawCatalogAgentDetail(employee.id.trim());
              if (detailRes.code !== 0) {
                toast.error(detailRes.msg?.trim() || '无法获取员工详情');
                set({ isLoading: false });
                return false;
              }
              const mapped = mapCatalogAgentToEmployee(detailRes.data);
              payload = { ...employee, ...mapped };
            } catch (e) {
              toast.error(e instanceof Error ? e.message : '无法获取员工详情');
              set({ isLoading: false });
              return false;
            }
          }

          const vibeRaw = payload.vibeZh ?? payload.vibe;
          const vibePayload =
            typeof vibeRaw === 'string' && vibeRaw.trim().length > 0 ? vibeRaw.trim() : undefined;

          const res = (await hostApiFetch('/api/employees/provision', {
            method: 'POST',
            body: JSON.stringify({
              employeeId: payload.id,
              nameZh: payload.nameZh,
              nameEn: payload.name,
              soulContent: payload.soulContent ?? '',
              agentsContent: payload.agentsContent ?? '',
              identityContent: payload.identityContent ?? '',
              emoji: payload.emoji,
              ...(vibePayload !== undefined ? { vibe: vibePayload } : {}),
              ...(Array.isArray(payload.skills) && payload.skills.length > 0 ? { skills: payload.skills } : {}),
            }),
          })) as {
            success?: boolean;
            agentId?: string;
            error?: string;
          };

          if (!res.success || !res.agentId) {
            if (res.error) {
              console.error('[employees] provision failed:', res.error);
            } else {
              console.error('[employees] provision failed (no error message):', res);
            }
            set({ isLoading: false });
            return false;
          }

          useAgentsStore.getState().fetchAgents();

          const withLink: Employee = { ...payload, linkedAgentId: res.agentId };
          const newMyEmployees = [...myEmployees, withLink];

          set({
            myEmployees: newMyEmployees,
            isLoading: false,
          });

          return true;
        } catch (error) {
          console.error('Failed to add employee:', error);
          set({ isLoading: false });
          return false;
        } finally {
          unsubscribe?.();
        }
      },

      removeEmployee: async (employeeId) => {
        const { myEmployees, selectedEmployee } = get();
        const row = myEmployees.find((e) => e.id === employeeId);
        const linkedAgentId = row?.linkedAgentId?.trim();
        if (!linkedAgentId) {
          throw new MissingLinkedAgentError();
        }

        await useAgentsStore.getState().deleteAgent(linkedAgentId);

        const newMyEmployees = myEmployees.filter((emp) => emp.id !== employeeId);

        set({
          myEmployees: newMyEmployees,
          selectedEmployee: selectedEmployee?.id === employeeId ? null : selectedEmployee,
        });
      },

      setSelectedEmployee: (employee) => set({ selectedEmployee: employee }),

      isEmployeeAdded: (employeeId) => {
        const { myEmployees } = get();
        return myEmployees.some((emp) => emp.id === employeeId);
      },

      reconcileWithOpenClawAgentIds: (agentIds) => {
        set((state) =>
          reconcileMyEmployeesWithOpenClawAgentIds(
            state.myEmployees,
            agentIds,
            state.selectedEmployee,
          ),
        );
      },
    }),
    {
      name: 'rclaw-employees-storage',
      partialize: (state) => ({
        myEmployees: state.myEmployees,
      }),
      onRehydrateStorage: () => (rehydrateError) => {
        if (rehydrateError) return;
        queueMicrotask(() => {
          void useAgentsStore.getState().fetchAgents();
        });
      },
    }
  )
);
