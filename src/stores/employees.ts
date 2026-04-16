/**
 * Employees Store
 * Zustand store for managing digital employees
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Employee, EmployeeWithStatus, Department } from '@/types/employee';
import { DEPARTMENT_MAP } from '@/types/employee';
import { hostApiFetch } from '@/lib/host-api';
import { useAgentsStore } from '@/stores/agents';

/** Thrown when myEmployees row has no linkedAgentId (legacy / corrupt); UI should show errors.missingLinkedAgent. */
export class MissingLinkedAgentError extends Error {
  constructor() {
    super('MISSING_LINKED_AGENT');
    this.name = 'MissingLinkedAgentError';
  }
}

interface EmployeesState {
  // All available employees from marketplace
  employees: EmployeeWithStatus[];

  // My employees (added by user)
  myEmployees: Employee[];

  // Selected department filter
  selectedDepartment: Department | 'all';

  // Selected employee for detail view
  selectedEmployee: Employee | null;

  // Loading state
  isLoading: boolean;

  // Actions
  setEmployees: (employees: EmployeeWithStatus[]) => void;
  addEmployee: (employee: Employee, onProvisionStage?: (stage: string) => void) => Promise<boolean>;
  removeEmployee: (employeeId: string) => Promise<void>;
  setSelectedDepartment: (department: Department | 'all') => void;
  setSelectedEmployee: (employee: Employee | null) => void;
  isEmployeeAdded: (employeeId: string) => boolean;
  getEmployeesByDepartment: (department: Department) => EmployeeWithStatus[];
  getFilteredEmployees: () => EmployeeWithStatus[];
  /** Drop myEmployees rows whose linkedAgentId no longer exists in OpenClaw (e.g. user edited ~/.openclaw manually). */
  reconcileWithOpenClawAgentIds: (agentIds: string[]) => void;
}

/** Exported for unit tests — keeps marketplace `isAdded` in sync with `myEmployees`. */
export function reconcileEmployeeRowsWithAgentIds(
  myEmployees: Employee[],
  catalog: EmployeeWithStatus[],
  agentIds: string[],
  selectedEmployee: Employee | null,
): {
  myEmployees: Employee[];
  employees: EmployeeWithStatus[];
  selectedEmployee: Employee | null;
} {
  const valid = new Set(agentIds.map((id) => id.trim()).filter(Boolean));
  const filtered = myEmployees.filter((e) => {
    const lid = e.linkedAgentId?.trim();
    return Boolean(lid && valid.has(lid));
  });
  const keptCatalogIds = new Set(filtered.map((e) => e.id));
  const updatedEmployees = catalog.map((emp) => ({
    ...emp,
    isAdded: keptCatalogIds.has(emp.id),
    ...(keptCatalogIds.has(emp.id) ? {} : { addedAt: undefined }),
  }));
  const selected =
    selectedEmployee && filtered.some((e) => e.id === selectedEmployee.id) ? selectedEmployee : null;
  return { myEmployees: filtered, employees: updatedEmployees, selectedEmployee: selected };
}

export const useEmployeesStore = create<EmployeesState>()(
  persist(
    (set, get) => ({
      employees: [],
      myEmployees: [],
      selectedDepartment: 'all',
      selectedEmployee: null,
      isLoading: false,

      setEmployees: (employees) => set({ employees }),

      addEmployee: async (employee, onProvisionStage) => {
        if (get().isEmployeeAdded(employee.id)) {
          return false;
        }

        const { employees, myEmployees } = get();

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

          const vibeRaw = employee.vibeZh ?? employee.vibe;
          const vibePayload =
            typeof vibeRaw === 'string' && vibeRaw.trim().length > 0 ? vibeRaw.trim() : undefined;

          const res = (await hostApiFetch('/api/employees/provision', {
            method: 'POST',
            body: JSON.stringify({
              employeeId: employee.id,
              nameZh: employee.nameZh,
              nameEn: employee.name,
              soulContent: (employee as EmployeeWithStatus).soulContent || '',
              agentsContent: (employee as EmployeeWithStatus).agentsContent || '',
              identityContent: (employee as EmployeeWithStatus).identityContent || '',
              emoji: employee.emoji,
              ...(vibePayload !== undefined ? { vibe: vibePayload } : {}),
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

          const withLink: Employee = { ...employee, linkedAgentId: res.agentId };
          const newMyEmployees = [...myEmployees, withLink];
          const updatedEmployees = employees.map((emp) =>
            emp.id === employee.id ? { ...emp, isAdded: true, addedAt: Date.now() } : emp
          );

          set({
            myEmployees: newMyEmployees,
            employees: updatedEmployees,
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
        const { employees, myEmployees, selectedEmployee } = get();
        const row = myEmployees.find((e) => e.id === employeeId);
        const linkedAgentId = row?.linkedAgentId?.trim();
        if (!linkedAgentId) {
          throw new MissingLinkedAgentError();
        }

        await useAgentsStore.getState().deleteAgent(linkedAgentId);

        const newMyEmployees = myEmployees.filter((emp) => emp.id !== employeeId);
        const updatedEmployees = employees.map((emp) =>
          emp.id === employeeId ? { ...emp, isAdded: false, addedAt: undefined } : emp
        );

        set({
          myEmployees: newMyEmployees,
          employees: updatedEmployees,
          selectedEmployee: selectedEmployee?.id === employeeId ? null : selectedEmployee,
        });
      },

      setSelectedDepartment: (department) => set({ selectedDepartment: department }),

      setSelectedEmployee: (employee) => set({ selectedEmployee: employee }),

      isEmployeeAdded: (employeeId) => {
        const { myEmployees } = get();
        return myEmployees.some((emp) => emp.id === employeeId);
      },

      getEmployeesByDepartment: (department) => {
        const { employees } = get();
        return employees.filter((emp) => emp.department === department);
      },

      getFilteredEmployees: () => {
        const { employees, selectedDepartment } = get();
        if (selectedDepartment === 'all') {
          return employees;
        }
        return employees.filter((emp) => emp.department === selectedDepartment);
      },

      reconcileWithOpenClawAgentIds: (agentIds) => {
        set((state) =>
          reconcileEmployeeRowsWithAgentIds(
            state.myEmployees,
            state.employees,
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
      /**
       * Rehydrate from localStorage can run after the first `/api/agents` fetch and overwrite
       * `myEmployees` with stale rows. Re-fetch agents so `fetchAgents` → reconcile runs again.
       */
      onRehydrateStorage: () => (rehydrateError) => {
        if (rehydrateError) return;
        queueMicrotask(() => {
          void useAgentsStore.getState().fetchAgents();
        });
      },
    }
  )
);

// Helper function to get department info
export const getDepartmentInfo = (department: Department) => {
  return DEPARTMENT_MAP[department];
};

// Helper function to get all departments
export const getAllDepartments = () => {
  return Object.values(DEPARTMENT_MAP);
};