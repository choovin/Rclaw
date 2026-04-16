// src/stores/auth.ts

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UserInfo } from '@/lib/cloud-api';

/** Debounce toast when parallel requests return 401 */
let lastMemberSessionToastAt = 0;

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
  /** 仅拉取登录态与用户信息（含 coin），不触发模型网关同步；用于路由切换、登录后刷新积分等 */
  syncUserInfoFromHost: () => Promise<void>;

  // Gate 函数
  requireAuth: () => Promise<boolean>;

  /** 会员会话在云端已失效：清本地展示态并打开登录（hostApiFetch 全局分支） */
  invalidateMemberSessionAndOpenLogin: () => void;
}

/** Main 在 refresh 失败清 token 后广播 `cloud:logged-out`，同步清除 persist 中的登录 UI 状态 */
export function subscribeCloudSessionIpc(): () => void {
  if (typeof window === 'undefined') return () => {};
  const ipc = window.electron?.ipcRenderer;
  if (!ipc?.on) return () => {};
  const unsub = ipc.on('cloud:logged-out', () => {
    useAuthStore.setState({ isLoggedIn: false, userInfo: null });
  });
  return typeof unsub === 'function' ? unsub : () => {};
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
          const { toast } = await import('sonner');
          const status = await cloudApi.getStatus();
          if (status.isLoggedIn && status.userInfo) {
            set({ isLoggedIn: true, userInfo: status.userInfo });
          } else if (status.isLoggedIn) {
            set({ isLoggedIn: true });
          } else {
            set({ isLoggedIn: false, userInfo: null });
          }
          if (status.isLoggedIn) {
            const syncResult = await cloudApi.syncPlatformProvider();
            if (!syncResult.success) {
              toast.error('模型网关配置同步失败，可稍后重试');
            } else {
              const { useProviderStore } = await import('@/stores/providers');
              await useProviderStore.getState().refreshProviderSnapshot();
            }
          }
        } catch {
          // 网络/Host 不可用时保留本地 persist，避免误登出
        }
      },

      syncUserInfoFromHost: async () => {
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
          // 网络/Host 不可用时保留本地 persist
        }
      },

      // Gate 函数 - 检查登录状态，未登录则弹出登录框
      requireAuth: async () => {
        if (get().isLoggedIn) return true;
        set({ loginModalOpen: true });
        return false;
      },

      invalidateMemberSessionAndOpenLogin: () => {
        set({ isLoggedIn: false, userInfo: null, loginModalOpen: true });
        const now = Date.now();
        if (now - lastMemberSessionToastAt < 2000) return;
        lastMemberSessionToastAt = now;
        void import('sonner').then(({ toast }) => {
          toast.error('登录已失效，请重新登录');
        });
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ isLoggedIn: state.isLoggedIn, userInfo: state.userInfo })
    }
  )
);
