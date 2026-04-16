// electron/utils/cloud-config.ts

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

let dotEnvMerged = false;

/**
 * Main 进程从仓库根目录按 Vite 相近顺序合并部分 `VITE_*`（后者覆盖前者）。
 * 另见构建期注入：`vite.config.ts` → `__RCLAW_BUILD_*__`（打包后 cwd 常无 .env）。
 */
function mergeCloudKeysFromDotEnvFiles(): void {
  if (dotEnvMerged) return;
  dotEnvMerged = true;
  const root = process.cwd();
  const isProd = process.env.NODE_ENV === 'production';
  const files = [
    join(root, '.env'),
    join(root, '.env.local'),
    ...(isProd
      ? [join(root, '.env.production'), join(root, '.env.production.local')]
      : [join(root, '.env.development'), join(root, '.env.development.local')]),
  ];
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
        if (
          key !== 'VITE_CLOUD_API_BASE_URL' &&
          key !== 'VITE_CLOUD_WECHAT_APP_ID' &&
          key !== 'VITE_SKILL_HUB_BASE_URL'
        ) {
          continue;
        }
        if (key === 'VITE_CLOUD_API_BASE_URL' && process.env.VITE_CLOUD_API_BASE_URL) continue;
        if (key === 'VITE_CLOUD_WECHAT_APP_ID' && process.env.VITE_CLOUD_WECHAT_APP_ID) continue;
        if (key === 'VITE_SKILL_HUB_BASE_URL' && process.env.VITE_SKILL_HUB_BASE_URL) continue;
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
 * 优先级：`process.env`（含合并后的 .env*）→ 构建期注入 → 预发默认。
 * 与 `docs/api-docs` 中的路径拼接为完整 URL，例如 `${base}/app-api/member/auth/login`。
 */
export function getCloudApiBaseUrl(): string {
  mergeCloudKeysFromDotEnvFiles();
  const raw =
    process.env.VITE_CLOUD_API_BASE_URL ||
    __RCLAW_BUILD_CLOUD_API_BASE__ ||
    'https://staging-www.runnode.cn';
  return raw.replace(/\/+$/, '');
}

export function getWechatAppId(): string {
  mergeCloudKeysFromDotEnvFiles();
  return process.env.VITE_CLOUD_WECHAT_APP_ID || __RCLAW_BUILD_CLOUD_WECHAT_APP_ID__ || '';
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

/**
 * Skill Hub 站点根地址（与渲染层 `VITE_SKILL_HUB_BASE_URL` 一致）。
 * 供 ClawHub CLI `install --registry` 使用。
 */
export function getSkillHubBaseUrl(): string {
  mergeCloudKeysFromDotEnvFiles();
  const raw =
    process.env.VITE_SKILL_HUB_BASE_URL ||
    __RCLAW_BUILD_SKILL_HUB_BASE_URL__ ||
    'https://staging-www.runnode.cn';
  return raw.replace(/\/+$/, '');
}
