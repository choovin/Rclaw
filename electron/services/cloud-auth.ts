// electron/services/cloud-auth.ts

import { logger } from '../utils/logger';
import { broadcastCloudLoggedOut } from '../utils/cloud-session-broadcast';
import { getCloudAuthTokenStore } from './cloud-auth-token-store';
import { cloudFetchLogged } from '../utils/cloud-fetch-log';
import { getCloudApiBaseUrl } from '../utils/cloud-config';
import {
  parseMemberAuthLoginBody,
  parseMemberAuthRefreshBody,
} from '../utils/member-auth-response';

/** 会员认证路径与 `docs/api-docs/04_Member_API.md` 一致；完整 URL = `getCloudApiBaseUrl()` + 下列路径。 */
const MEMBER_AUTH_BASE = '/app-api/member/auth';
/** 会员用户路径：`GET .../user/get` 获取用户信息 */
const MEMBER_USER_BASE = '/app-api/member/user';
const MEMBER_VIP_GET = '/app-api/member/vip/get';

/** 与 runnode-user-front-end `request` 拦截器一致：带 query 的 GET 需带 `cloud_type`，否则云端可能不返回微信授权 URL */
const MEMBER_CLOUD_TYPE = 'SAILFISH';

function memberAuthApiSuccess(code: unknown): boolean {
  return code === 0 || code === 200;
}

function flattenRequestHeaders(h: RequestInit['headers'] | undefined): Record<string, string> {
  if (h == null) return {};
  if (h instanceof Headers) return Object.fromEntries(h.entries());
  if (Array.isArray(h)) return Object.fromEntries(h);
  return { ...(h as Record<string, string>) };
}

/** 后端 `social-auth-redirect` 的 `data` 多为完整授权 URL 字符串，少数为对象 */
function normalizeSocialAuthRedirectPayload(data: unknown): string | undefined {
  if (data == null) return undefined;
  if (typeof data === 'string') {
    const t = data.trim();
    return t || undefined;
  }
  if (typeof data === 'object' && !Array.isArray(data)) {
    const o = data as Record<string, unknown>;
    for (const k of ['url', 'authorizeUrl', 'redirectUrl', 'authUrl'] as const) {
      const v = o[k];
      if (typeof v === 'string' && v.trim()) return v.trim();
    }
  }
  return undefined;
}

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
  /** 当前会员套餐名称（如 FREE / Plus），来自 vip/get 或 user 字段 */
  subscriptionPlan?: string;
  /** 积分（算力币等），来自用户接口 `coin` 字段 */
  coin?: number;
}

interface LoginResult {
  success: boolean;
  userInfo?: UserInfo;
  error?: string;
}

const ACCESS_TOKEN_EXPIRE_BUFFER_MS = 5 * 60 * 1000; // 提前5分钟刷新

export class CloudAuthService {
  /** 并发 refresh 合并为单次，避免轮换 refreshToken 时重复请求 */
  private refreshInFlight: Promise<boolean> | null = null;

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

  /**
   * 登录成功并已持久化 token 后，优先 GET /app-api/member/user/get 获取用户信息；
   * 失败时再尝试 GET /app-api/member/auth/get-login-user；仍失败则用登录接口解析的 fallback。
   */
  private async resolveUserProfileAfterLogin(fallback: UserInfo): Promise<UserInfo> {
    const profile = await this.resolveUserInfoForToken();
    if (profile) {
      return profile;
    }
    logger.warn('[CloudAuth] user/get + get-login-user failed after login, using login response userInfo');
    return fallback;
  }

  /** 优先 member/user/get，失败则 auth/get-login-user */
  private async resolveUserInfoForToken(): Promise<UserInfo | null> {
    const fromUserApi = await this.fetchMemberUser();
    if (fromUserApi) return fromUserApi;
    return this.fetchLoginUser();
  }

  /**
   * 已登录会员域请求（非登录、非 refresh-token）：自动带 Bearer；
   * 若 HTTP 401，调用 refresh-token 一次并用新 accessToken 重试（仅重试一次）。
   */
  async fetchMemberAuthorized(logContext: string, url: string, init?: RequestInit): Promise<Response> {
    const tokenData = await this.getValidToken();
    if (!tokenData) {
      return new Response(null, { status: 401, statusText: 'Unauthorized' });
    }
    const baseHeaders = flattenRequestHeaders(init?.headers);
    const merged: RequestInit = {
      ...init,
      headers: {
        ...baseHeaders,
        Authorization: `Bearer ${tokenData.accessToken}`,
      },
    };

    let response = await cloudFetchLogged(logContext, url, merged);
    // #region agent log
    fetch('http://127.0.0.1:7810/ingest/d4cd7479-64e4-4e73-8b33-70df561970b3',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'584271'},body:JSON.stringify({sessionId:'584271',runId:'pre-fix',hypothesisId:'H2',location:'electron/services/cloud-auth.ts:fetchMemberAuthorized:1st-response',message:'authorized request first response',data:{logContext,status:response.status},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    if (response.status !== 401) {
      return response;
    }

    const refreshed = await this.refreshAccessToken();
    // #region agent log
    fetch('http://127.0.0.1:7810/ingest/d4cd7479-64e4-4e73-8b33-70df561970b3',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'584271'},body:JSON.stringify({sessionId:'584271',runId:'pre-fix',hypothesisId:'H2',location:'electron/services/cloud-auth.ts:fetchMemberAuthorized:after-refresh',message:'authorized request refresh result',data:{logContext,refreshed},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    if (!refreshed) {
      return response;
    }

    const td = await this.getStoredTokenData();
    if (!td) {
      return response;
    }

    const mergedRetry: RequestInit = {
      ...init,
      headers: {
        ...baseHeaders,
        Authorization: `Bearer ${td.accessToken}`,
      },
    };

    return cloudFetchLogged(`${logContext}:after-401-refresh`, url, mergedRetry);
  }

  // 登录（密码方式）
  async loginWithPassword(mobile: string, password: string): Promise<LoginResult> {
    try {
      const baseUrl = getCloudApiBaseUrl();
      const response = await cloudFetchLogged('auth:login-password', `${baseUrl}${MEMBER_AUTH_BASE}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'tenant-id': '1' },
        body: JSON.stringify({ mobile, password })
      });

      const rawJson: unknown = await response.json().catch(() => ({}));
      const parsed = parseMemberAuthLoginBody(rawJson);
      if (!parsed.ok) {
        logger.warn('[CloudAuth] login password', { httpStatus: response.status, error: parsed.error });
        return { success: false, error: parsed.error };
      }
      const { accessToken, refreshToken, expiresIn } = parsed.value;

      await this.storeTokenData({
        accessToken,
        refreshToken,
        expiresAt: Date.now() + expiresIn * 1000
      });

      const userInfo = await this.resolveUserProfileAfterLogin(parsed.value.userInfo);
      return { success: true, userInfo };
    } catch (error) {
      logger.error('Cloud login failed:', error);
      return { success: false, error: String(error) };
    }
  }

  // 登录（短信验证码方式）
  async loginWithSms(mobile: string, code: string): Promise<LoginResult> {
    try {
      const baseUrl = getCloudApiBaseUrl();
      const response = await cloudFetchLogged('auth:sms-login', `${baseUrl}${MEMBER_AUTH_BASE}/sms-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'tenant-id': '1' },
        body: JSON.stringify({ mobile, code })
      });

      const rawJson: unknown = await response.json().catch(() => ({}));
      const parsed = parseMemberAuthLoginBody(rawJson);
      if (!parsed.ok) {
        logger.warn('[CloudAuth] sms-login', { httpStatus: response.status, error: parsed.error });
        return { success: false, error: parsed.error };
      }
      const { accessToken, refreshToken, expiresIn } = parsed.value;

      await this.storeTokenData({
        accessToken,
        refreshToken,
        expiresAt: Date.now() + expiresIn * 1000
      });

      const userInfo = await this.resolveUserProfileAfterLogin(parsed.value.userInfo);
      return { success: true, userInfo };
    } catch (error) {
      logger.error('Cloud SMS login failed:', error);
      return { success: false, error: String(error) };
    }
  }

  // 发送短信验证码
  async sendSmsCode(mobile: string, scene: number = 1): Promise<{ success: boolean; error?: string }> {
    try {
      const baseUrl = getCloudApiBaseUrl();
      const response = await cloudFetchLogged('auth:send-sms-code', `${baseUrl}${MEMBER_AUTH_BASE}/send-sms-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'tenant-id': '1' },
        body: JSON.stringify({ mobile, scene })
      });

      const data = await response.json() as { code?: number; msg?: string; error?: string };

      // 检查后端返回的 code 字段
      if (data.code !== 0) {
        return { success: false, error: data.msg || data.error || '发送失败' };
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
      const response = await cloudFetchLogged('auth:social-login', `${baseUrl}${MEMBER_AUTH_BASE}/social-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'tenant-id': '1' },
        body: JSON.stringify({ type: 32, code, state })
      });

      const rawJson: unknown = await response.json().catch(() => ({}));
      const parsed = parseMemberAuthLoginBody(rawJson);
      if (!parsed.ok) {
        logger.warn('[CloudAuth] social-login', { httpStatus: response.status, error: parsed.error });
        return { success: false, error: parsed.error };
      }
      const { accessToken, refreshToken, expiresIn } = parsed.value;

      await this.storeTokenData({
        accessToken,
        refreshToken,
        expiresAt: Date.now() + expiresIn * 1000
      });

      const userInfo = await this.resolveUserProfileAfterLogin(parsed.value.userInfo);
      return { success: true, userInfo };
    } catch (error) {
      logger.error('Cloud WeChat login failed:', error);
      return { success: false, error: String(error) };
    }
  }

  // 获取微信授权跳转参数
  async getWechatAuthParams(redirectUri: string): Promise<{ success: boolean; data?: string; error?: string }> {
    try {
      const baseUrl = getCloudApiBaseUrl();
      const q = new URLSearchParams({
        cloud_type: MEMBER_CLOUD_TYPE,
        type: '32',
        redirectUri,
      });
      const response = await cloudFetchLogged(
        'auth:social-auth-redirect',
        `${baseUrl}${MEMBER_AUTH_BASE}/social-auth-redirect?${q.toString()}`,
        {
          method: 'GET',
          headers: {
            'tenant-id': '1'
          }
        },
      );

      const responseText = await response.text();

      if (!response.ok) {
        let msg = '请求失败';
        try {
          const errBody = JSON.parse(responseText) as { msg?: string; message?: string; error?: string };
          msg = errBody.msg || errBody.message || errBody.error || msg;
        } catch {
          if (responseText.trim()) msg = responseText.trim().slice(0, 200);
        }
        return { success: false, error: msg };
      }

      const fail = (msg: string) => ({ success: false as const, error: msg });

      try {
        const jsonData = JSON.parse(responseText) as {
          code?: unknown;
          data?: unknown;
          msg?: string;
          message?: string;
        };

        if (typeof jsonData.code !== 'undefined' && !memberAuthApiSuccess(jsonData.code)) {
          return fail(jsonData.msg || jsonData.message || '获取微信登录参数失败');
        }

        const fromData = normalizeSocialAuthRedirectPayload(jsonData.data);
        if (fromData) {
          return { success: true, data: fromData };
        }

        return fail(jsonData.msg || jsonData.message || '获取微信登录参数失败');
      } catch {
        const trimmed = responseText.trim();
        if (trimmed) {
          return { success: true, data: trimmed };
        }
        return fail('获取微信登录参数失败');
      }
    } catch (error) {
      logger.error('Get WeChat auth params failed:', error);
      return { success: false, error: String(error) };
    }
  }

  // 刷新 Access Token（多路并发时合并为单次请求）
  async refreshAccessToken(): Promise<boolean> {
    if (this.refreshInFlight !== null) {
      return this.refreshInFlight;
    }
    const p = this.refreshAccessTokenOnce();
    this.refreshInFlight = p.finally(() => {
      this.refreshInFlight = null;
    });
    return this.refreshInFlight;
  }

  private async refreshAccessTokenOnce(): Promise<boolean> {
    const tokenData = await this.getStoredTokenData();
    if (!tokenData?.refreshToken) return false;

    try {
      const baseUrl = getCloudApiBaseUrl();
      const q = new URLSearchParams({ refreshToken: tokenData.refreshToken });
      const response = await cloudFetchLogged(
        'auth:refresh-token',
        `${baseUrl}${MEMBER_AUTH_BASE}/refresh-token?${q.toString()}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'tenant-id': '1' },
        },
      );

      const rawJson: unknown = await response.json().catch(() => ({}));
      const parsed = parseMemberAuthRefreshBody(rawJson);
      const root =
        rawJson !== null && typeof rawJson === 'object' && !Array.isArray(rawJson)
          ? (rawJson as Record<string, unknown>)
          : null;
      const bizCode = typeof root?.code === 'number' ? root.code : undefined;
      // #region agent log
      fetch('http://127.0.0.1:7810/ingest/d4cd7479-64e4-4e73-8b33-70df561970b3',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'584271'},body:JSON.stringify({sessionId:'584271',runId:'pre-fix',hypothesisId:'H4',location:'electron/services/cloud-auth.ts:refreshAccessTokenOnce:parsed',message:'refresh-token parsed result',data:{httpStatus:response.status,bizCode,ok:parsed.ok},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      if (!parsed.ok) {
        await this.clearTokens();
        broadcastCloudLoggedOut();
        logger.warn('[CloudAuth] refresh', { httpStatus: response.status, code: bizCode });
        return false;
      }

      await this.storeTokenData({
        accessToken: parsed.accessToken,
        refreshToken: parsed.refreshToken ?? tokenData.refreshToken,
        expiresAt: Date.now() + parsed.expiresIn * 1000
      });
      return true;
    } catch (error) {
      logger.error('Refresh token failed:', error);
    }

    await this.clearTokens();
    broadcastCloudLoggedOut();
    return false;
  }

  // 登出
  async logout(): Promise<void> {
    await this.clearTokens();
  }

  /** GET /app-api/member/user/get — 获取用户信息（主路径，见 docs/api-docs/04_Member_API.md） */
  private async fetchMemberUser(): Promise<UserInfo | null> {
    try {
      const baseUrl = getCloudApiBaseUrl();
      const response = await this.fetchMemberAuthorized('member:user-get', `${baseUrl}${MEMBER_USER_BASE}/get`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'tenant-id': '1',
        },
      });

      const text = await response.text();
      let json: unknown;
      try {
        json = JSON.parse(text);
      } catch {
        return null;
      }

      if (!response.ok) {
        return null;
      }

      const obj = json as { code?: number; data?: unknown };
      // #region agent log
      fetch('http://127.0.0.1:7810/ingest/d4cd7479-64e4-4e73-8b33-70df561970b3',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'584271'},body:JSON.stringify({sessionId:'584271',runId:'pre-fix',hypothesisId:'H1',location:'electron/services/cloud-auth.ts:fetchMemberUser:biz-code',message:'member user api business code observed',data:{httpStatus:response.status,bizCode:obj.code},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      if (obj.code !== undefined && obj.code !== 0) {
        return null;
      }

      const payload = obj.data !== undefined ? obj.data : json;
      return this.normalizeMemberUserPayload(payload);
    } catch (error) {
      logger.error('fetchMemberUser failed:', error);
      return null;
    }
  }

  /** GET /app-api/member/auth/get-login-user — 备用（user/get 不可用时） */
  private async fetchLoginUser(): Promise<UserInfo | null> {
    try {
      const baseUrl = getCloudApiBaseUrl();
      const response = await this.fetchMemberAuthorized(
        'auth:get-login-user',
        `${baseUrl}${MEMBER_AUTH_BASE}/get-login-user`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'tenant-id': '1',
          },
        },
      );

      const text = await response.text();
      let json: unknown;
      try {
        json = JSON.parse(text);
      } catch {
        return null;
      }

      if (!response.ok) {
        return null;
      }

      const obj = json as { code?: number; data?: unknown };
      // #region agent log
      fetch('http://127.0.0.1:7810/ingest/d4cd7479-64e4-4e73-8b33-70df561970b3',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'584271'},body:JSON.stringify({sessionId:'584271',runId:'pre-fix',hypothesisId:'H1',location:'electron/services/cloud-auth.ts:fetchLoginUser:biz-code',message:'login-user api business code observed',data:{httpStatus:response.status,bizCode:obj.code},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      if (obj.code !== undefined && obj.code !== 0) {
        return null;
      }

      const payload = obj.data !== undefined ? obj.data : json;
      return this.normalizeMemberUserPayload(payload);
    } catch (error) {
      logger.error('fetchLoginUser (fallback) failed:', error);
      return null;
    }
  }

  private numFromUnknown(v: unknown): number | undefined {
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string' && v.trim() && !Number.isNaN(Number(v))) return Number(v);
    return undefined;
  }

  private pickVipPlanLabelFromPayload(raw: unknown): string | undefined {
    if (raw == null) return undefined;
    if (typeof raw === 'string' && raw.trim()) return raw.trim();
    if (typeof raw !== 'object') return undefined;
    const o = raw as Record<string, unknown>;
    for (const k of ['vipName', 'packageName', 'planName', 'name', 'levelName', 'title', 'vipLevelName']) {
      const v = o[k];
      if (typeof v === 'string' && v.trim()) return v.trim();
    }
    if (typeof o.vipLevel === 'number') return `VIP${o.vipLevel}`;
    return undefined;
  }

  private async cloudMemberGet(path: string, logLabel: string): Promise<unknown | null> {
    try {
      const baseUrl = getCloudApiBaseUrl();
      const response = await this.fetchMemberAuthorized(logLabel, `${baseUrl}${path}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'tenant-id': '1',
        },
      });

      const text = await response.text();
      let json: unknown;
      try {
        json = JSON.parse(text);
      } catch {
        return null;
      }

      if (!response.ok) {
        return null;
      }

      const obj = json as { code?: number; data?: unknown };
      if (obj.code !== undefined && !memberAuthApiSuccess(obj.code)) {
        return null;
      }

      return obj.data !== undefined ? obj.data : json;
    } catch (error) {
      logger.error(`${logLabel} failed:`, error);
      return null;
    }
  }

  private async fetchMemberVipPlanLabel(): Promise<string | undefined> {
    const data = await this.cloudMemberGet(MEMBER_VIP_GET, 'member:vip-get');
    return this.pickVipPlanLabelFromPayload(data);
  }

  private normalizeMemberUserPayload(raw: unknown): UserInfo | null {
    if (raw == null || typeof raw !== 'object') return null;
    const o = raw as Record<string, unknown>;
    let r = o;
    if (
      o.data != null &&
      typeof o.data === 'object' &&
      !Array.isArray(o.data) &&
      (('id' in (o.data as object)) ||
        ('nickname' in (o.data as object)) ||
        ('avatar' in (o.data as object)) ||
        ('mobile' in (o.data as object)))
    ) {
      r = o.data as Record<string, unknown>;
    }

    const idRaw = r.id ?? r.userId;
    let id: string | number | undefined;
    if (typeof idRaw === 'string' || typeof idRaw === 'number') {
      id = idRaw;
    } else if (idRaw != null) {
      id = String(idRaw);
    }

    const nickname = typeof r.nickname === 'string' ? r.nickname : undefined;
    const mobile = typeof r.mobile === 'string' ? r.mobile : undefined;
    const avatar = typeof r.avatar === 'string' ? r.avatar : undefined;
    const usernameRaw = typeof r.username === 'string' ? r.username : '';
    const username =
      usernameRaw || nickname || mobile || (id != null ? String(id) : '') || '用户';

    if (id == null && !usernameRaw && !nickname && !mobile) {
      return null;
    }

    const subscriptionPlanRaw =
      typeof r.subscriptionPlan === 'string'
        ? r.subscriptionPlan.trim()
        : typeof r.vipName === 'string'
          ? r.vipName.trim()
          : typeof r.memberLevelName === 'string'
            ? r.memberLevelName.trim()
            : undefined;
    const subscriptionPlan = subscriptionPlanRaw || undefined;

    const coin = this.numFromUnknown(r.coin);

    return {
      id: id ?? username,
      username,
      nickname,
      mobile,
      avatar,
      ...(subscriptionPlan ? { subscriptionPlan } : {}),
      ...(coin != null ? { coin } : {})
    };
  }

  // 获取登录状态（含从云端拉取的当前用户信息，供头像等展示）
  async getStatus(): Promise<{ isLoggedIn: boolean; userInfo?: UserInfo }> {
    const tokenData = await this.getValidToken();
    if (!tokenData) return { isLoggedIn: false };

    let userInfo = await this.resolveUserInfoForToken();
    if (!userInfo) {
      const refreshed = await this.refreshAccessToken();
      if (refreshed) {
        const td = await this.getStoredTokenData();
        if (td) {
          userInfo = await this.resolveUserInfoForToken();
        }
      }
    }

    if (!userInfo) {
      if (!(await this.getStoredTokenData())) {
        return { isLoggedIn: false };
      }
      return { isLoggedIn: true };
    }

    const vipPlan = await this.fetchMemberVipPlanLabel();

    const merged: UserInfo = {
      ...userInfo,
      subscriptionPlan: vipPlan ?? userInfo.subscriptionPlan
    };

    return { isLoggedIn: true, userInfo: merged };
  }

  // 存储 Token（加密 electron-store）
  private async storeTokenData(data: TokenData): Promise<void> {
    try {
      const store = await getCloudAuthTokenStore();
      store.set('tokens', {
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        expiresAt: data.expiresAt,
      });
    } catch (error) {
      logger.error('Failed to store token:', error);
    }
  }

  // 读取已存 Token
  private async getStoredTokenData(): Promise<TokenData | null> {
    try {
      const store = await getCloudAuthTokenStore();
      const t = store.get('tokens');
      if (!t?.accessToken || !t?.refreshToken) return null;
      return {
        accessToken: t.accessToken,
        refreshToken: t.refreshToken,
        expiresAt: typeof t.expiresAt === 'number' ? t.expiresAt : Number(t.expiresAt) || 0,
      };
    } catch (error) {
      logger.error('Failed to get stored token:', error);
      return null;
    }
  }

  // 清除 Token
  private async clearTokens(): Promise<void> {
    try {
      const store = await getCloudAuthTokenStore();
      store.set('tokens', null);
    } catch (error) {
      logger.error('Failed to clear tokens:', error);
    }
  }
}

export const cloudAuthService = new CloudAuthService();
