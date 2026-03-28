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
  /** 从 Host 拉取登录态与用户信息（优先 member/user/get，见 CloudAuthService） */
  syncAuthFromHost: () => Promise<void>;

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

      syncAuthFromHost: async () => {
        try {
          const { cloudApi } = await import('@/lib/cloud-api');
          const status = await cloudApi.getStatus();
          if (status.isLoggedIn && status.userInfo) {
            set({ isLoggedIn: true, userInfo: status.userInfo });
          } else if (status.isLoggedIn) {
            set({ isLoggedIn: true });
          } else {
            set({ isLoggedIn: false, userInfo: null });
          }
        } catch {
          // 网络/Host 不可用时保留本地 persist，避免误登出
        }
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
      partialize: (state) => ({ isLoggedIn: state.isLoggedIn, userInfo: state.userInfo })
    }
  )
);
