// electron/api/routes/cloud-auth.ts

import type { IncomingMessage, ServerResponse } from 'http';
import { parseJsonBody, sendJson } from '../route-utils';
import { cloudAuthService } from '../../services/cloud-auth';
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

  // POST /api/cloud/auth/send-sms
  if (pathname === '/api/cloud/auth/send-sms' && req.method === 'POST') {
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
    const redirectUri = url.searchParams.get('redirectUri') || 'http://localhost:5173/cloud-callback';
    const result = await cloudAuthService.getWechatAuthParams(redirectUri);
    sendJson(res, result.success ? 200 : 400, result);
    return true;
  }

  // POST /api/cloud/auth/logout
  if (pathname === '/api/cloud/auth/logout' && req.method === 'POST') {
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
