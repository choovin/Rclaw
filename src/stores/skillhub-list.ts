/**
 * Skillhub marketplace list: pagination, search (debounced), loading/error.
 */
import { create } from 'zustand';
import { fetchSkillhubPage } from '@/lib/skillhub-api';
import type { SkillhubListItem } from '@/types/skillhub';

const SEARCH_DEBOUNCE_MS = 400;

let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;

interface SkillhubListState {
  items: SkillhubListItem[];
  total: number;
  /** Page number to request next; starts at 1, becomes 2 after a successful first page. */
  nextPageToFetch: number;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  searchQuery: string;

  setSearchQuery: (q: string) => void;
  resetAndFetch: () => Promise<void>;
  loadMore: () => Promise<void>;
}

export const useSkillhubListStore = create<SkillhubListState>((set, get) => ({
  items: [],
  total: 0,
  nextPageToFetch: 1,
  loading: false,
  loadingMore: false,
  error: null,
  searchQuery: '',

  setSearchQuery: (q: string) => {
    set({ searchQuery: q });
    if (searchDebounceTimer !== null) {
      clearTimeout(searchDebounceTimer);
    }
    searchDebounceTimer = setTimeout(() => {
      searchDebounceTimer = null;
      void get().resetAndFetch();
    }, SEARCH_DEBOUNCE_MS);
  },

  resetAndFetch: async () => {
    const q = get().searchQuery.trim();
    set({
      items: [],
      total: 0,
      nextPageToFetch: 1,
      loading: true,
      error: null,
    });
    try {
      const res = await fetchSkillhubPage(q, 1);
      if (res.code === 0) {
        set({
          items: res.data.list,
          total: res.data.total,
          nextPageToFetch: 2,
          loading: false,
          error: null,
        });
      } else {
        set({
          loading: false,
          error: res.msg?.trim() || '加载失败',
        });
      }
    } catch (e) {
      set({
        loading: false,
        error: e instanceof Error ? e.message : '加载失败',
      });
    }
  },

  loadMore: async () => {
    const { loading, loadingMore, items, total, nextPageToFetch, searchQuery } = get();
    if (loading || loadingMore || items.length >= total) {
      return;
    }
    const q = searchQuery.trim();
    set({ loadingMore: true });
    try {
      const res = await fetchSkillhubPage(q, nextPageToFetch);
      if (res.code === 0) {
        set({
          items: [...get().items, ...res.data.list],
          total: res.data.total,
          nextPageToFetch: nextPageToFetch + 1,
          loadingMore: false,
          error: null,
        });
      } else {
        set({
          loadingMore: false,
          error: res.msg?.trim() || '加载失败',
        });
      }
    } catch (e) {
      set({
        loadingMore: false,
        error: e instanceof Error ? e.message : '加载失败',
      });
    }
  },
}));
