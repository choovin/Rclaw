/**
 * 登录后从会员接口拉取 baseUrl + token，写入唯一 cloud custom 供应商并同步 OpenClaw。
 */

import type { GatewayManager } from '../gateway/manager';
import {
  CLOUD_PLATFORM_API_PATH,
  CLOUD_PLATFORM_CUSTOM_ACCOUNT_ID,
  CLOUD_PLATFORM_CUSTOM_LABEL,
  CLOUD_PLATFORM_FALLBACK_MODELS,
  CLOUD_PLATFORM_PRIMARY_MODEL,
} from '../shared/cloud-platform-provider-constants';
import type { ProviderAccount } from '../shared/providers/types';
import { cloudAuthService } from './cloud-auth';
import { getProviderService } from './providers/provider-service';
import {
  syncDefaultProviderToRuntime,
  syncDeletedProviderToRuntime,
  syncSavedProviderToRuntime,
  syncUpdatedProviderToRuntime,
} from './providers/provider-runtime-sync';
import {
  getProviderAccount,
  listProviderAccounts,
  providerAccountToConfig,
} from './providers/provider-store';
import { getCloudApiBaseUrl } from '../utils/cloud-config';
import { cloudFetchLogged } from '../utils/cloud-fetch-log';
import { logger } from '../utils/logger';

export type SyncPlatformProviderResult = { ok: true } | { ok: false; error: string };

/**
 * OpenAI 兼容网关 baseUrl 需以 `/v1` 结尾；接口若只返回 host 或省略版本段则补上。
 */
export function ensureOpenAiCompatibleBaseUrlV1(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  const noTrailingSlash = trimmed.replace(/\/+$/, '');
  if (/\/v1$/i.test(noTrailingSlash)) {
    return noTrailingSlash;
  }
  return `${noTrailingSlash}/v1`;
}

export function parseMemberNewApiConfig(json: unknown): { baseUrl: string; apiKey: string } | null {
  if (json == null || typeof json !== 'object') return null;
  const root = json as Record<string, unknown>;
  if (root.code !== undefined && root.code !== 0 && root.code !== 200) {
    return null;
  }

  let payload: unknown = root;
  if ('data' in root && root.data != null && typeof root.data === 'object' && !Array.isArray(root.data)) {
    payload = root.data;
  }

  const obj = payload as Record<string, unknown>;
  const fromBase = typeof obj.baseUrl === 'string' ? obj.baseUrl.trim() : '';
  const fromApiUrl = typeof obj.apiUrl === 'string' ? obj.apiUrl.trim() : '';
  const baseUrlRaw = fromBase || fromApiUrl;
  const baseUrl = baseUrlRaw ? ensureOpenAiCompatibleBaseUrlV1(baseUrlRaw) : '';
  /** 后端契约字段为 `apiKey`；`platformAccessToken` 仅作旧文档/兼容兜底 */
  const token =
    (typeof obj.apiKey === 'string' && obj.apiKey.trim())
    || (typeof obj.platformAccessToken === 'string' && obj.platformAccessToken.trim())
    || '';

  if (!baseUrl || !token) return null;
  return { baseUrl, apiKey: token };
}

export async function syncCloudPlatformProviderFromMemberApi(options: {
  gatewayManager: GatewayManager;
}): Promise<SyncPlatformProviderResult> {
  const { gatewayManager } = options;
  const tokenData = await cloudAuthService.getValidToken();
  if (!tokenData?.accessToken) {
    return { ok: false, error: 'not_logged_in' };
  }

  try {
    const apiRoot = getCloudApiBaseUrl();
    const response = await cloudFetchLogged(
      'member:new-api-config',
      `${apiRoot}${CLOUD_PLATFORM_API_PATH}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'tenant-id': '1',
          Authorization: `Bearer ${tokenData.accessToken}`,
        },
      },
    );

    const rawText = await response.text();
    let json: unknown;
    try {
      json = JSON.parse(rawText);
    } catch {
      return { ok: false, error: 'invalid_json' };
    }

    if (!response.ok) {
      return { ok: false, error: 'http_error' };
    }

    const parsed = parseMemberNewApiConfig(json);
    if (!parsed) {
      return { ok: false, error: 'invalid_config' };
    }

    const service = getProviderService();
    const all = await listProviderAccounts();

    for (const a of all) {
      if (a.vendorId === 'custom' && a.id !== CLOUD_PLATFORM_CUSTOM_ACCOUNT_ID) {
        const cfg = providerAccountToConfig(a);
        await service.deleteAccount(a.id);
        await syncDeletedProviderToRuntime(cfg, a.id, gatewayManager);
      }
    }

    const now = new Date().toISOString();
    const existingCloud = await getProviderAccount(CLOUD_PLATFORM_CUSTOM_ACCOUNT_ID);
    const account: ProviderAccount = {
      id: CLOUD_PLATFORM_CUSTOM_ACCOUNT_ID,
      vendorId: 'custom',
      label: CLOUD_PLATFORM_CUSTOM_LABEL,
      authMode: 'api_key',
      baseUrl: parsed.baseUrl,
      apiProtocol: 'openai-completions',
      model: CLOUD_PLATFORM_PRIMARY_MODEL,
      fallbackModels: [...CLOUD_PLATFORM_FALLBACK_MODELS],
      fallbackAccountIds: [],
      enabled: true,
      isDefault: false,
      createdAt: existingCloud?.createdAt ?? now,
      updatedAt: now,
    };

    if (existingCloud) {
      await service.updateAccount(
        CLOUD_PLATFORM_CUSTOM_ACCOUNT_ID,
        {
          label: account.label,
          baseUrl: account.baseUrl,
          apiProtocol: account.apiProtocol,
          model: account.model,
          fallbackModels: account.fallbackModels,
          fallbackAccountIds: account.fallbackAccountIds,
          enabled: account.enabled,
          updatedAt: account.updatedAt,
        },
        parsed.apiKey,
      );
    } else {
      await service.createAccount(account, parsed.apiKey);
    }

    const saved = await getProviderAccount(CLOUD_PLATFORM_CUSTOM_ACCOUNT_ID);
    if (!saved) {
      return { ok: false, error: 'persist_failed' };
    }
    const config = providerAccountToConfig(saved);

    if (existingCloud) {
      await syncUpdatedProviderToRuntime(config, parsed.apiKey, gatewayManager);
    } else {
      await syncSavedProviderToRuntime(config, parsed.apiKey, gatewayManager);
    }

    await service.setDefaultAccount(CLOUD_PLATFORM_CUSTOM_ACCOUNT_ID);
    await syncDefaultProviderToRuntime(CLOUD_PLATFORM_CUSTOM_ACCOUNT_ID, gatewayManager);

    return { ok: true };
  } catch (error) {
    logger.error('[CloudPlatformProvider] sync failed:', error);
    return { ok: false, error: 'exception' };
  }
}

export async function removeCloudPlatformProvider(gatewayManager: GatewayManager): Promise<void> {
  const existing = await getProviderAccount(CLOUD_PLATFORM_CUSTOM_ACCOUNT_ID);
  if (!existing) return;

  const config = providerAccountToConfig(existing);
  await getProviderService().deleteAccount(CLOUD_PLATFORM_CUSTOM_ACCOUNT_ID);
  await syncDeletedProviderToRuntime(config, CLOUD_PLATFORM_CUSTOM_ACCOUNT_ID, gatewayManager);

  const others = (await listProviderAccounts()).filter((a) => a.id !== CLOUD_PLATFORM_CUSTOM_ACCOUNT_ID);
  if (others.length === 0) return;

  others.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const nextId = others[0].id;
  await getProviderService().setDefaultAccount(nextId);
  await syncDefaultProviderToRuntime(nextId, gatewayManager);
}
