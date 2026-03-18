/**
 * Employees Store
 * Zustand store for managing digital employees
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Employee, EmployeeWithStatus, Department } from '@/types/employee';
import { DEPARTMENT_MAP } from '@/types/employee';

interface EmployeesState {
  // All available employees from marketplace
  employees: EmployeeWithStatus[];

  // My employees (added by user)
  myEmployees: Employee[];

  // Selected department filter
  selectedDepartment: Department | 'all';

  // Selected employee for detail view
  selectedEmployee: Employee | null;

  // Actions
  setEmployees: (employees: EmployeeWithStatus[]) => void;
  addEmployee: (employee: Employee) => void;
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

      setEmployees: (employees) => set({ employees }),

      addEmployee: (employee) => {
        const { employees, myEmployees } = get();

        // Add to my employees
        const newMyEmployees = [...myEmployees, employee];

        // Update employees list to mark as added
        const updatedEmployees = employees.map((emp) =>
          emp.id === employee.id ? { ...emp, isAdded: true, addedAt: Date.now() } : emp
        );

        set({
          myEmployees: newMyEmployees,
          employees: updatedEmployees,
        });
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