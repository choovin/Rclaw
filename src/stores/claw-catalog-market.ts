/**
 * Claw Catalog marketplace: departments, paginated agents, debounced keyword.
 */
import { create } from 'zustand';
import {
  CLAW_CATALOG_PAGE_SIZE,
  fetchClawCatalogAgents,
  fetchClawCatalogDepartments,
} from '@/lib/claw-catalog-api';
import { mapCatalogAgentToEmployee } from '@/lib/claw-catalog-map';
import type { ClawCatalogDepartment } from '@/types/claw-catalog';
import type { EmployeeWithStatus } from '@/types/employee';

function normalizeCatalogTotal(raw: unknown, loadedCount: number): number {
  if (loadedCount === 0) {
    const n = raw === null || raw === undefined || raw === '' ? NaN : Number(raw as number | string);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  }
  const n = raw === null || raw === undefined || raw === '' ? NaN : Number(raw as number | string);
  if (Number.isFinite(n) && n >= loadedCount) {
    return n;
  }
  return Math.max(loadedCount + 1, 1);
}

export type ClawCatalogDepartmentSelection = 'all' | number;

interface ClawCatalogMarketState {
  departments: ClawCatalogDepartment[];
  departmentsLoading: boolean;
  departmentsError: string | null;

  items: EmployeeWithStatus[];
  total: number;
  nextPageToFetch: number;
  loading: boolean;
  loadingMore: boolean;
  listError: string | null;
  searchQuery: string;
  selectedDepartmentId: ClawCatalogDepartmentSelection;

  loadDepartments: () => Promise<void>;
  setSelectedDepartmentId: (id: ClawCatalogDepartmentSelection) => void;
  /** Sets `searchQuery` and runs the first page fetch (for toolbar search sync). */
  applyDebouncedSearch: (q: string) => void;
  resetAndFetch: () => Promise<void>;
  loadMore: () => Promise<void>;
}

export const useClawCatalogMarketStore = create<ClawCatalogMarketState>((set, get) => ({
  departments: [],
  departmentsLoading: false,
  departmentsError: null,

  items: [],
  total: 0,
  nextPageToFetch: 1,
  loading: false,
  loadingMore: false,
  listError: null,
  searchQuery: '',
  selectedDepartmentId: 'all',

  loadDepartments: async () => {
    set({ departmentsLoading: true, departmentsError: null });
    try {
      const res = await fetchClawCatalogDepartments();
      if (res.code === 0) {
        const list = Array.isArray(res.data) ? res.data : [];
        const sorted = [...list].sort((a, b) => {
          if (a.sort !== b.sort) return a.sort - b.sort;
          return a.id - b.id;
        });
        set({ departments: sorted, departmentsLoading: false, departmentsError: null });
      } else {
        set({
          departmentsLoading: false,
          departmentsError: res.msg?.trim() || '加载失败',
        });
      }
    } catch (e) {
      set({
        departmentsLoading: false,
        departmentsError: e instanceof Error ? e.message : '加载失败',
      });
    }
  },

  setSelectedDepartmentId: (id: ClawCatalogDepartmentSelection) => {
    set({ selectedDepartmentId: id });
    void get().resetAndFetch();
  },

  applyDebouncedSearch: (q: string) => {
    set({ searchQuery: q });
    void get().resetAndFetch();
  },

  resetAndFetch: async () => {
    const { searchQuery, selectedDepartmentId } = get();
    const q = searchQuery.trim();
    set({
      items: [],
      total: 0,
      nextPageToFetch: 1,
      loading: true,
      listError: null,
    });
    try {
      const res = await fetchClawCatalogAgents({
        pageNo: 1,
        pageSize: CLAW_CATALOG_PAGE_SIZE,
        keyword: q || undefined,
        departmentId: selectedDepartmentId === 'all' ? undefined : selectedDepartmentId,
      });
      if (res.code === 0) {
        const list = res.data.list ?? [];
        const mapped = list.map((row) => mapCatalogAgentToEmployee(row));
        set({
          items: mapped,
          total: normalizeCatalogTotal(res.data.total, mapped.length),
          nextPageToFetch: 2,
          loading: false,
          listError: null,
        });
      } else {
        set({
          loading: false,
          listError: res.msg?.trim() || '加载失败',
        });
      }
    } catch (e) {
      set({
        loading: false,
        listError: e instanceof Error ? e.message : '加载失败',
      });
    }
  },

  loadMore: async () => {
    const {
      loading,
      loadingMore,
      items,
      total,
      nextPageToFetch,
      searchQuery,
      selectedDepartmentId,
    } = get();
    if (loading || loadingMore || items.length >= total) {
      return;
    }
    const q = searchQuery.trim();
    set({ loadingMore: true });
    try {
      const res = await fetchClawCatalogAgents({
        pageNo: nextPageToFetch,
        pageSize: CLAW_CATALOG_PAGE_SIZE,
        keyword: q || undefined,
        departmentId: selectedDepartmentId === 'all' ? undefined : selectedDepartmentId,
      });
      if (res.code === 0) {
        const pageList = res.data.list ?? [];
        const prev = get().items;
        if (pageList.length === 0) {
          set({
            loadingMore: false,
            total: prev.length,
            nextPageToFetch: nextPageToFetch + 1,
            listError: null,
          });
          return;
        }
        const mapped = pageList.map((row) => mapCatalogAgentToEmployee(row));
        const merged = [...prev, ...mapped];
        set({
          items: merged,
          total: normalizeCatalogTotal(res.data.total, merged.length),
          nextPageToFetch: nextPageToFetch + 1,
          loadingMore: false,
          listError: null,
        });
      } else {
        set({
          loadingMore: false,
          listError: res.msg?.trim() || '加载失败',
        });
      }
    } catch (e) {
      set({
        loadingMore: false,
        listError: e instanceof Error ? e.message : '加载失败',
      });
    }
  },
}));
