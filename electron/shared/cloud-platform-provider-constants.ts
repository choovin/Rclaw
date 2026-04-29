/** 业务云下发的唯一 custom 账号 id（稳定，全仓库引用此常量） */
export const CLOUD_PLATFORM_CUSTOM_ACCOUNT_ID = 'runnode-cloud-custom';

export const CLOUD_PLATFORM_CUSTOM_LABEL = 'RunNode';

export const CLOUD_PLATFORM_PRIMARY_MODEL = 'runnode/Qwen3.6-27B';

export const CLOUD_PLATFORM_FALLBACK_MODELS: readonly string[] = [
  'MiniMax-M2.7-highspeed',
  'MiniMax-M2.5-highspeed',
  'MiniMax-M2.7',
  'minimax-m2.5',
  'kimi-k2.5',
  'glm-5',
] as const;

/** 会员侧路径，完整 URL = getCloudApiBaseUrl() + 下列路径 */
export const CLOUD_PLATFORM_API_PATH = '/app-api/member/new-api/config';
