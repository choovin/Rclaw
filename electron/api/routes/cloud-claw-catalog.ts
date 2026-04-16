// electron/api/routes/cloud-claw-catalog.ts

import type { IncomingMessage, ServerResponse } from 'http';
import { sendJson, sendText } from '../route-utils';
import { getCloudApiBaseUrl } from '../../utils/cloud-config';
import { cloudFetchLogged } from '../../utils/cloud-fetch-log';
import type { HostApiContext } from '../context';

/**
 * Proxy RunNode Claw Catalog (digital employee marketplace) to `{base}/app-api/claw/catalog/*`.
 */
export async function handleCloudClawCatalogRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  _ctx: HostApiContext,
): Promise<boolean> {
  if (req.method !== 'GET') {
    return false;
  }

  const base = getCloudApiBaseUrl();

  let upstream: string | null = null;
  const logLabel = 'claw.catalog';

  if (url.pathname === '/api/cloud/claw/catalog/departments') {
    upstream = `${base}/app-api/claw/catalog/departments`;
  } else if (url.pathname === '/api/cloud/claw/catalog/agents') {
    upstream = `${base}/app-api/claw/catalog/agents${url.search}`;
  } else {
    const m = url.pathname.match(/^\/api\/cloud\/claw\/catalog\/agent\/(.+)$/);
    if (m?.[1]) {
      const bundleId = decodeURIComponent(m[1]);
      upstream = `${base}/app-api/claw/catalog/agent/${encodeURIComponent(bundleId)}`;
    }
  }

  if (!upstream) {
    return false;
  }

  const response = await cloudFetchLogged(logLabel, upstream, { method: 'GET' });
  const text = await response.text();
  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    try {
      sendJson(res, response.status, JSON.parse(text));
    } catch {
      sendText(res, response.status, text);
    }
  } else {
    sendText(res, response.status, text);
  }

  return true;
}
