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
  addEmployee: (employee: Employee) => Promise<boolean>;
  removeEmployee: (employeeId: string) => void;
  setSelectedDepartment: (department: Department | 'all') => void;
  setSelectedEmployee: (employee: Employee | null) => void;
  isEmployeeAdded: (employeeId: string) => boolean;
  getEmployeesByDepartment: (department: Department) => EmployeeWithStatus[];
  getFilteredEmployees: () => EmployeeWithStatus[];
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

      addEmployee: async (employee) => {
        const { employees, myEmployees } = get();

        try {
          set({ isLoading: true });

          // 1. 调用 OpenClaw API 创建 Agent（如果失败不阻塞继续）
          try {
            await hostApiFetch('/api/agents', {
              method: 'POST',
              body: JSON.stringify({
                name: employee.nameZh,
                inheritWorkspace: false,
              }),
            });
          } catch (apiError) {
            console.warn('OpenClaw API call failed, continuing with workspace creation:', apiError);
          }

          // 2. 调用 API 创建员工 workspace 文件
          await hostApiFetch('/api/employees/workspace', {
            method: 'POST',
            body: JSON.stringify({
              employeeId: employee.id,
              nameZh: employee.nameZh,
              nameEn: employee.name,
              soulContent: (employee as EmployeeWithStatus).soulContent || '',
              agentsContent: (employee as EmployeeWithStatus).agentsContent || '',
              identityContent: (employee as EmployeeWithStatus).identityContent || '',
            }),
          });

          // 3. 刷新 Agents 列表（使"Agents"标签页能看到新添加的Agent）
          useAgentsStore.getState().fetchAgents();

          // 4. 更新本地状态
          const newMyEmployees = [...myEmployees, employee];
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
        }
      },

      removeEmployee: (employeeId) => {
        const { employees, myEmployees, selectedEmployee } = get();

        // Remove from my employees
        const newMyEmployees = myEmployees.filter((emp) => emp.id !== employeeId);

        // Update employees list to mark as not added
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
    }),
    {
      name: 'rclaw-employees-storage',
      partialize: (state) => ({
        myEmployees: state.myEmployees,
      }),
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