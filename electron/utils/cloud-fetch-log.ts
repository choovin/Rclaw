/**
 * 云后台请求日志：记录 URL、方法、脱敏后的请求体、HTTP 状态与脱敏后的响应体。
 * 密码、验证码、access/refresh token、Bearer 等不会明文落日志。
 */

import { proxyAwareFetch } from './proxy-fetch';
import { logger } from './logger';

const MAX_RESPONSE_LOG_CHARS = 8000;

function maskMobile(s: string): string {
  const d = s.replace(/\D/g, '');
  if (d.length >= 7) return `${d.slice(0, 3)}****${d.slice(-4)}`;
  return '****';
}

function sanitizeForLog(obj: unknown, depth = 0): unknown {
  if (depth > 10) return '[max-depth]';
  if (obj == null) return obj;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    return obj.map((x) => sanitizeForLog(x, depth + 1));
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const kl = k.toLowerCase();
    if (
      kl === 'password' ||
      kl === 'refreshtoken' ||
      kl === 'accesstoken' ||
      kl === 'access_token' ||
      kl === 'refresh_token' ||
      kl === 'platformaccesstoken' ||
      kl === 'apikey' ||
      kl === 'devicetoken'
    ) {
      out[k] = '[redacted]';
      continue;
    }
    if (kl === 'code' && typeof v === 'string') {
      out[k] = '[redacted]';
      continue;
    }
    if (kl === 'state' && typeof v === 'string' && v.length > 0) {
      out[k] = '[redacted]';
      continue;
    }
    if (kl === 'mobile' && typeof v === 'string') {
      out[k] = maskMobile(v);
      continue;
    }
    if (typeof v === 'object' && v !== null) {
      out[k] = sanitizeForLog(v, depth + 1);
    } else {
      out[k] = v;
    }
  }
  return out;
}

function parseBodyForLog(body: BodyInit | null | undefined): unknown {
  if (body == null) return undefined;
  if (typeof body === 'string') {
    try {
      return sanitizeForLog(JSON.parse(body));
    } catch {
      return body.length > 2000 ? `${body.slice(0, 2000)}…` : body;
    }
  }
  return '[non-string body]';
}

function headersForLog(init?: RequestInit): Record<string, string> {
  const h = init?.headers;
  if (!h) return {};
  let plain: Record<string, string>;
  if (h instanceof Headers) {
    plain = Object.fromEntries(h.entries());
  } else if (Array.isArray(h)) {
    plain = Object.fromEntries(h);
  } else {
    plain = { ...h };
  }
  const out = { ...plain };
  const auth = out.Authorization || out.authorization;
  if (auth) {
    out.Authorization = '[redacted]';
    delete out.authorization;
  }
  for (const key of Object.keys(out)) {
    if (key.toLowerCase() === 'x-device-token') {
      out[key] = '[redacted]';
    }
  }
  return out;
}

function responseBodyForLog(text: string, contentType: string | null): unknown {
  const ct = contentType || '';
  if (ct.includes('application/json')) {
    try {
      const j = JSON.parse(text) as unknown;
      return sanitizeForLog(j);
    } catch {
      return text.slice(0, MAX_RESPONSE_LOG_CHARS);
    }
  }
  if (text.length > MAX_RESPONSE_LOG_CHARS) {
    return `${text.slice(0, MAX_RESPONSE_LOG_CHARS)}…[truncated ${text.length} chars]`;
  }
  return text;
}

/**
 * 发起云后台请求并写 INFO 级日志（请求 / 响应摘要，敏感字段已脱敏）。
 */
export async function cloudFetchLogged(
  context: string,
  url: string,
  init?: RequestInit,
): Promise<Response> {
  const method = (init?.method || 'GET').toUpperCase();
  const started = Date.now();

  logger.info(`[CloudAPI] ${context} request`, {
    method,
    url,
    headers: headersForLog(init),
    body: parseBodyForLog(init?.body as string | undefined),
  });

  const response = await proxyAwareFetch(url, init);

  let rawText: string;
  try {
    rawText = await response.clone().text();
  } catch {
    rawText = '<failed to read body>';
  }

  const durationMs = Date.now() - started;
  logger.info(`[CloudAPI] ${context} response`, {
    status: response.status,
    ok: response.ok,
    statusText: response.statusText,
    contentType: response.headers.get('content-type'),
    durationMs,
    body: responseBodyForLog(rawText, response.headers.get('content-type')),
  });

  return response;
}
