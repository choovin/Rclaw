// src/stores/auth.ts

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UserInfo {
  id: string | number;
  username: string;
  nickname?: string;
  mobile?: string;
  avatar?: string;
}

interface AuthState {
  isLoggedIn: boolean;
  userInfo: UserInfo | null;
  loginModalOpen: boolean;

  // Actions
  setLoggedIn: (isLoggedIn: boolean, userInfo?: UserInfo) => void;
  openLoginModal: () => void;
  closeLoginModal: () => void;
  logout: () => Promise<void>;

  // Gate 函数
  requireAuth: () => Promise<boolean>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      isLoggedIn: false,
      userInfo: null,
      loginModalOpen: false,

      setLoggedIn: (isLoggedIn, userInfo) => set({
        isLoggedIn,
        userInfo: userInfo || null
      }),

      openLoginModal: () => set({ loginModalOpen: true }),
      closeLoginModal: () => set({ loginModalOpen: false }),

      logout: async () => {
        // 调用 API 登出，然后清除本地状态
        try {
          const { cloudApi } = await import('@/lib/cloud-api');
          await cloudApi.logout();
        } catch {
          // 忽略 API 错误，仍清除本地状态
        }
        set({ isLoggedIn: false, userInfo: null });
      },

      // Gate 函数 - 检查登录状态，未登录则弹出登录框
      requireAuth: async () => {
        if (get().isLoggedIn) return true;
        set({ loginModalOpen: true });
        return false;
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ isLoggedIn: state.isLoggedIn })
    }
  )
);
