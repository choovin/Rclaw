// electron/api/routes/cloud-auth.ts

import type { IncomingMessage, ServerResponse } from 'http';
import { parseJsonBody, sendJson } from '../route-utils';
import { cloudAuthService } from '../../services/cloud-auth';
import {
  removeCloudPlatformProvider,
  syncCloudPlatformProviderFromMemberApi,
} from '../../services/cloud-platform-provider';
import { getWechatOAuthRedirectUriFallback } from '../../utils/cloud-config';
import { logger } from '../../utils/logger';
import type { HostApiContext } from '../context';

export async function handleCloudAuthRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  ctx: HostApiContext
): Promise<boolean> {
  const pathname = url.pathname;

  // POST /api/cloud/auth/login (password)
  if (pathname === '/api/cloud/auth/login' && req.method === 'POST') {
    const body = await parseJsonBody<{ mobile: string; password: string }>(req);
    const result = await cloudAuthService.loginWithPassword(body.mobile, body.password);
    sendJson(res, result.success ? 200 : 401, result);
    return true;
  }

  // POST /api/cloud/auth/sms-login
  if (pathname === '/api/cloud/auth/sms-login' && req.method === 'POST') {
    const body = await parseJsonBody<{ mobile: string; code: string }>(req);
    const result = await cloudAuthService.loginWithSms(body.mobile, body.code);
    sendJson(res, result.success ? 200 : 401, result);
    return true;
  }

  // POST /api/cloud/auth/send-sms-code（与 RunNode 一致；旧构建若仅有 send-sms 亦兼容）
  if (
    (pathname === '/api/cloud/auth/send-sms-code' || pathname === '/api/cloud/auth/send-sms') &&
    req.method === 'POST'
  ) {
    const body = await parseJsonBody<{ mobile: string }>(req);
    const result = await cloudAuthService.sendSmsCode(body.mobile);
    sendJson(res, result.success ? 200 : 400, result);
    return true;
  }

  // POST /api/cloud/auth/wechat-login
  if (pathname === '/api/cloud/auth/wechat-login' && req.method === 'POST') {
    const body = await parseJsonBody<{ code: string; state: string }>(req);
    const result = await cloudAuthService.loginWithWechat(body.code, body.state);
    sendJson(res, result.success ? 200 : 401, result);
    return true;
  }

  // GET /api/cloud/auth/wechat-qr
  if (pathname === '/api/cloud/auth/wechat-qr' && req.method === 'GET') {
    const redirectUri = url.searchParams.get('redirectUri') || getWechatOAuthRedirectUriFallback();
    const result = await cloudAuthService.getWechatAuthParams(redirectUri);
    sendJson(res, result.success ? 200 : 400, result);
    return true;
  }

  // POST /api/cloud/platform-provider/sync
  if (pathname === '/api/cloud/platform-provider/sync' && req.method === 'POST') {
    const result = await syncCloudPlatformProviderFromMemberApi({
      gatewayManager: ctx.gatewayManager,
    });
    if (result.ok) {
      sendJson(res, 200, { success: true });
      return true;
    }
    if (result.error === 'not_logged_in') {
      sendJson(res, 401, { success: false, error: result.error });
      return true;
    }
    sendJson(res, 502, { success: false, error: result.error });
    return true;
  }

  // POST /api/cloud/auth/logout
  if (pathname === '/api/cloud/auth/logout' && req.method === 'POST') {
    try {
      await removeCloudPlatformProvider(ctx.gatewayManager);
    } catch (error) {
      logger.error('[CloudAuth] removeCloudPlatformProvider on logout:', error);
    }
    await cloudAuthService.logout();
    sendJson(res, 200, { success: true });
    return true;
  }

  // GET /api/cloud/auth/status
  if (pathname === '/api/cloud/auth/status' && req.method === 'GET') {
    const status = await cloudAuthService.getStatus();
    sendJson(res, 200, status);
    return true;
  }

  return false;
}
