// src/lib/cloud-api.ts

import { hostApiFetch } from './host-api';

export interface UserInfo {
  id: string | number;
  username: string;
  nickname?: string;
  mobile?: string;
  avatar?: string;
  /** 当前会员套餐名称（如 FREE / Plus），来自 vip/get 与 user */
  subscriptionPlan?: string;
  /** 积分（算力币等），来自用户接口 `coin` 字段（member/user/get） */
  coin?: number;
}

export interface LoginResult {
  success: boolean;
  userInfo?: UserInfo;
  error?: string;
}

/** 从 `VITE_CLOUD_API_BASE_URL` 解析站点 origin（不含 API 子路径），供前台页链接拼接。 */
function getCloudSiteOrigin(): string | null {
  const raw = import.meta.env.VITE_CLOUD_API_BASE_URL?.trim();
  if (!raw) return null;
  try {
    const normalized = raw.replace(/\/+$/, '');
    const href = /^https?:\/\//i.test(normalized) ? normalized : `https://${normalized}`;
    return new URL(href).origin;
  } catch {
    return null;
  }
}

/**
 * 会员权益页：站点 origin + `/vip-rights`（可选 `/vip-rights/:tier`）。
 * 使用 origin 而非把路径直接拼在 API 根后，避免 `.env` 中带 `/api` 等路径时得到错误地址。
 */
export function getCloudVipRightsUrl(tier?: string | number): string | null {
  const origin = getCloudSiteOrigin();
  if (!origin) return null;
  const suffix =
    tier != null && String(tier).length > 0 ? `/vip-rights/${tier}` : '/vip-rights';
  return `${origin}${suffix}`;
}

/** 用户设置页：`{origin}/user-setting`。 */
export function getCloudUserSettingUrl(): string | null {
  const origin = getCloudSiteOrigin();
  if (!origin) return null;
  return `${origin}/user-setting`;
}

export const cloudApi = {
  // 密码登录
  async login(mobile: string, password: string): Promise<LoginResult> {
    return hostApiFetch<LoginResult>('/api/cloud/auth/login', {
      method: 'POST',
      body: JSON.stringify({ mobile, password })
    });
  },

  // 短信登录
  async smsLogin(mobile: string, code: string): Promise<LoginResult> {
    return hostApiFetch<LoginResult>('/api/cloud/auth/sms-login', {
      method: 'POST',
      body: JSON.stringify({ mobile, code })
    });
  },

  // 发送短信验证码（Host 内部路径；RunNode 由 Main 转发至 `/app-api/member/auth/send-sms-code`）
  async sendSms(mobile: string): Promise<{ success: boolean; error?: string }> {
    return hostApiFetch('/api/cloud/auth/send-sms-code', {
      method: 'POST',
      body: JSON.stringify({ mobile })
    });
  },

  // 微信登录
  async wechatLogin(code: string, state: string): Promise<LoginResult> {
    return hostApiFetch<LoginResult>('/api/cloud/auth/wechat-login', {
      method: 'POST',
      body: JSON.stringify({ code, state })
    });
  },

  // 获取微信二维码参数
  async getWechatQr(redirectUri: string): Promise<{ success: boolean; data?: unknown; error?: string }> {
    return hostApiFetch(`/api/cloud/auth/wechat-qr?redirectUri=${encodeURIComponent(redirectUri)}`);
  },

  // 登出
  async logout(): Promise<{ success: boolean }> {
    return hostApiFetch('/api/cloud/auth/logout', { method: 'POST' });
  },

  // 获取登录状态
  async getStatus(): Promise<{ isLoggedIn: boolean; userInfo?: UserInfo }> {
    return hostApiFetch('/api/cloud/auth/status');
  },

  /** 已登录时拉取会员 new-api/config 并写入唯一 RunNode custom 供应商（Main） */
  async syncPlatformProvider(): Promise<{ success: boolean; error?: string }> {
    return hostApiFetch('/api/cloud/platform-provider/sync', { method: 'POST' });
  },
};
