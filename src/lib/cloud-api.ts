// src/lib/cloud-api.ts

import { hostApiFetch } from './host-api';

export interface UserInfo {
  id: string | number;
  username: string;
  nickname?: string;
  mobile?: string;
  avatar?: string;
}

export interface LoginResult {
  success: boolean;
  userInfo?: UserInfo;
  error?: string;
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
