// electron/api/routes/cloud-skillhub.ts

import type { IncomingMessage, ServerResponse } from 'http';
import { sendJson, sendText } from '../route-utils';
import { getCloudApiBaseUrl } from '../../utils/cloud-config';
import { cloudFetchLogged } from '../../utils/cloud-fetch-log';
import type { HostApiContext } from '../context';

export async function handleCloudSkillhubRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  _ctx: HostApiContext,
): Promise<boolean> {
  if (req.method !== 'GET' || url.pathname !== '/api/cloud/skillhub/skills') {
    return false;
  }

  const base = getCloudApiBaseUrl();
  const upstream = `${base}/app-api/skillhub/skills${url.search}`;

  const response = await cloudFetchLogged('skillhub.skills', upstream, { method: 'GET' });
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
