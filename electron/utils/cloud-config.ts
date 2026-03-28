// electron/utils/cloud-config.ts

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

let dotEnvMerged = false;

/** Main 进程默认不加载 Vite 注入的 .env，从仓库根 `.env` / `.env.local` 合并 `VITE_CLOUD_*`。 */
function mergeCloudKeysFromDotEnvFiles(): void {
  if (dotEnvMerged) return;
  dotEnvMerged = true;
  const files = [join(process.cwd(), '.env'), join(process.cwd(), '.env.local')];
  for (const file of files) {
    if (!existsSync(file)) continue;
    try {
      const text = readFileSync(file, 'utf8');
      for (const line of text.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eq = trimmed.indexOf('=');
        if (eq <= 0) continue;
        const key = trimmed.slice(0, eq).trim();
        if (key !== 'VITE_CLOUD_API_BASE_URL' && key !== 'VITE_CLOUD_WECHAT_APP_ID') continue;
        if (key === 'VITE_CLOUD_API_BASE_URL' && process.env.VITE_CLOUD_API_BASE_URL) continue;
        if (key === 'VITE_CLOUD_WECHAT_APP_ID' && process.env.VITE_CLOUD_WECHAT_APP_ID) continue;
        let val = trimmed.slice(eq + 1).trim();
        if (
          (val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))
        ) {
          val = val.slice(1, -1);
        }
        process.env[key] = val;
      }
    } catch {
      // ignore
    }
  }
}

/**
 * 业务云 HTTP 根地址（不含路径）。
 * 在仓库根目录 `.env` / `.env.production` 等中配置 `VITE_CLOUD_API_BASE_URL`；
 * 与 `docs/api-docs` 中的路径拼接为完整 URL，例如 `${base}/app-api/member/auth/login`。
 */
export function getCloudApiBaseUrl(): string {
  mergeCloudKeysFromDotEnvFiles();
  const raw = process.env.VITE_CLOUD_API_BASE_URL || 'https://staging-www.runnode.cn';
  return raw.replace(/\/+$/, '');
}

export function getWechatAppId(): string {
  mergeCloudKeysFromDotEnvFiles();
  return process.env.VITE_CLOUD_WECHAT_APP_ID || '';
}

/** Main 侧 fallback：与渲染进程一致，取 `VITE_CLOUD_API_BASE_URL` 的 origin（同 RunNode 站点与 API 同源） */
export function getWechatOAuthRedirectUriFallback(): string {
  try {
    const base = getCloudApiBaseUrl();
    const normalized = base.replace(/\/+$/, '');
    const href = /^https?:\/\//i.test(normalized) ? normalized : `https://${normalized}`;
    return new URL(href).origin;
  } catch {
    return 'http://localhost:5173';
  }
}
