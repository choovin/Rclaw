// electron/utils/cloud-config.ts

export function getCloudApiBaseUrl(): string {
  // Main 进程运行在 Node.js，使用 process.env
  // 构建时通过 VITE_ 前缀注入
  return process.env.VITE_CLOUD_API_BASE_URL || 'https://dev.your-cloud.com/api';
}

export function getWechatAppId(): string {
  return process.env.VITE_CLOUD_WECHAT_APP_ID || '';
}