// electron/services/cloud-auth.ts

import keytar from 'keytar';
import { proxyAwareFetch } from '../utils/proxy-fetch';
import { logger } from '../utils/logger';
import { getCloudApiBaseUrl } from '../utils/cloud-config';

const SERVICE_NAME = 'ClawX-CloudAuth';

interface TokenData {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

interface UserInfo {
  id: string | number;
  username: string;
  nickname?: string;
  mobile?: string;
  avatar?: string;
}

interface LoginResult {
  success: boolean;
  userInfo?: UserInfo;
  error?: string;
}

const ACCESS_TOKEN_EXPIRE_BUFFER_MS = 5 * 60 * 1000; // 提前5分钟刷新

export class CloudAuthService {
  // 获取有效 Token（自动刷新如果即将过期）
  async getValidToken(): Promise<TokenData | null> {
    const tokenData = await this.getStoredTokenData();
    if (!tokenData) return null;

    if (this.isTokenExpiringSoon(tokenData)) {
      const refreshed = await this.refreshAccessToken();
      if (!refreshed) return null;
      return this.getStoredTokenData();
    }

    return tokenData;
  }

  // 检查 Token 是否即将过期
  private isTokenExpiringSoon(tokenData: TokenData): boolean {
    return Date.now() >= tokenData.expiresAt - ACCESS_TOKEN_EXPIRE_BUFFER_MS;
  }

  // 登录（密码方式）
  async loginWithPassword(mobile: string, password: string): Promise<LoginResult> {
    try {
      const baseUrl = getCloudApiBaseUrl();
      const response = await proxyAwareFetch(`${baseUrl}/app-api/member/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile, password })
      });

      if (!response.ok) {
        const data = await response.json() as { error?: string };
        return { success: false, error: data.error || '请求失败' };
      }
      const data = await response.json() as {
        accessToken: string;
        refreshToken: string;
        expiresIn: number;
        userInfo: UserInfo;
      };

      await this.storeTokenData({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        expiresAt: Date.now() + (data.expiresIn * 1000)
      });

      return { success: true, userInfo: data.userInfo };
    } catch (error) {
      logger.error('Cloud login failed:', error);
      return { success: false, error: String(error) };
    }
  }

  // 登录（短信验证码方式）
  async loginWithSms(mobile: string, code: string): Promise<LoginResult> {
    try {
      const baseUrl = getCloudApiBaseUrl();
      const response = await proxyAwareFetch(`${baseUrl}/app-api/member/auth/sms-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile, code })
      });

      if (!response.ok) {
        const data = await response.json() as { error?: string };
        return { success: false, error: data.error || '请求失败' };
      }
      const data = await response.json() as {
        accessToken: string;
        refreshToken: string;
        expiresIn: number;
        userInfo: UserInfo;
      };

      await this.storeTokenData({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        expiresAt: Date.now() + (data.expiresIn * 1000)
      });

      return { success: true, userInfo: data.userInfo };
    } catch (error) {
      logger.error('Cloud SMS login failed:', error);
      return { success: false, error: String(error) };
    }
  }

  // 发送短信验证码
  async sendSmsCode(mobile: string, scene: number = 1): Promise<{ success: boolean; error?: string }> {
    try {
      const baseUrl = getCloudApiBaseUrl();
      const response = await proxyAwareFetch(`${baseUrl}/app-api/member/auth/send-sms-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile, scene })
      });

      if (!response.ok) {
        const data = await response.json() as { error?: string };
        return { success: false, error: data.error || '发送失败' };
      }

      return { success: true };
    } catch (error) {
      logger.error('Send SMS code failed:', error);
      return { success: false, error: String(error) };
    }
  }

  // 微信登录
  async loginWithWechat(code: string, state: string): Promise<LoginResult> {
    try {
      const baseUrl = getCloudApiBaseUrl();
      const response = await proxyAwareFetch(`${baseUrl}/app-api/member/auth/social-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 32, code, state })
      });

      if (!response.ok) {
        const data = await response.json() as { error?: string };
        return { success: false, error: data.error || '请求失败' };
      }
      const data = await response.json() as {
        accessToken: string;
        refreshToken: string;
        expiresIn: number;
        userInfo: UserInfo;
      };

      await this.storeTokenData({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        expiresAt: Date.now() + (data.expiresIn * 1000)
      });

      return { success: true, userInfo: data.userInfo };
    } catch (error) {
      logger.error('Cloud WeChat login failed:', error);
      return { success: false, error: String(error) };
    }
  }

  // 获取微信授权跳转参数
  async getWechatAuthParams(redirectUri: string): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const baseUrl = getCloudApiBaseUrl();
      const response = await proxyAwareFetch(`${baseUrl}/app-api/member/auth/social-auth-redirect?type=32&redirectUri=${encodeURIComponent(redirectUri)}`);

      if (!response.ok) {
        const data = await response.json().catch(() => ({})) as { error?: string };
        return { success: false, error: data.error || '请求失败' };
      }

      // 微信 API 可能返回 JSON { code: 0, data: "appid=xxx&..." } 或直接返回文本
      const responseText = await response.text();

      // 尝试解析为 JSON
      try {
        const jsonData = JSON.parse(responseText);
        // 如果是 { code: 0, data: "..." } 格式，取 data 字段
        if (jsonData.code === 0 && jsonData.data) {
          return { success: true, data: jsonData.data };
        }
        // 否则返回整个响应
        return { success: true, data: responseText };
      } catch {
        // 如果不是 JSON，直接返回文本（应该是 appid=xxx&redirect_uri=xxx&state=xxx&scope=xxx 格式）
        return { success: true, data: responseText };
      }
    } catch (error) {
      logger.error('Get WeChat auth params failed:', error);
      return { success: false, error: String(error) };
    }
  }

  // 刷新 Access Token
  async refreshAccessToken(): Promise<boolean> {
    const tokenData = await this.getStoredTokenData();
    if (!tokenData?.refreshToken) return false;

    try {
      const baseUrl = getCloudApiBaseUrl();
      const response = await proxyAwareFetch(`${baseUrl}/app-api/member/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: tokenData.refreshToken })
      });

      if (!response.ok) {
        return false;
      }
      const data = await response.json() as { accessToken?: string; expiresIn?: number };

      if (data.accessToken) {
        await this.storeTokenData({
          accessToken: data.accessToken,
          refreshToken: tokenData.refreshToken,
          expiresAt: Date.now() + ((data.expiresIn || 7200) * 1000)
        });
        return true;
      }
    } catch (error) {
      logger.error('Refresh token failed:', error);
    }

    await this.clearTokens();
    return false;
  }

  // 登出
  async logout(): Promise<void> {
    await this.clearTokens();
  }

  // 获取登录状态
  async getStatus(): Promise<{ isLoggedIn: boolean; userInfo?: UserInfo }> {
    const tokenData = await this.getStoredTokenData();
    if (!tokenData) return { isLoggedIn: false };

    // 检查是否过期
    if (Date.now() >= tokenData.expiresAt) {
      const refreshed = await this.refreshAccessToken();
      if (!refreshed) return { isLoggedIn: false };
    }

    return { isLoggedIn: true };
  }

  // 存储 Token 到 Keychain
  private async storeTokenData(data: TokenData): Promise<void> {
    try {
      await keytar.setPassword(SERVICE_NAME, 'accessToken', data.accessToken);
      await keytar.setPassword(SERVICE_NAME, 'refreshToken', data.refreshToken);
      await keytar.setPassword(SERVICE_NAME, 'expiresAt', String(data.expiresAt));
    } catch (error) {
      logger.error('Failed to store token:', error);
    }
  }

  // 从 Keychain 获取 Token（异步）
  private async getStoredTokenData(): Promise<TokenData | null> {
    try {
      const [accessToken, refreshToken, expiresAt] = await Promise.all([
        keytar.getPassword(SERVICE_NAME, 'accessToken'),
        keytar.getPassword(SERVICE_NAME, 'refreshToken'),
        keytar.getPassword(SERVICE_NAME, 'expiresAt')
      ]);

      if (!accessToken || !refreshToken) return null;

      return {
        accessToken,
        refreshToken,
        expiresAt: expiresAt ? Number(expiresAt) : 0
      };
    } catch (error) {
      logger.error('Failed to get stored token:', error);
      return null;
    }
  }

  // 清除 Token
  private async clearTokens(): Promise<void> {
    try {
      await keytar.deletePassword(SERVICE_NAME, 'accessToken');
      await keytar.deletePassword(SERVICE_NAME, 'refreshToken');
      await keytar.deletePassword(SERVICE_NAME, 'expiresAt');
    } catch (error) {
      logger.error('Failed to clear tokens:', error);
    }
  }
}

export const cloudAuthService = new CloudAuthService();
