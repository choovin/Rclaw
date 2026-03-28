/**
 * 微信网站应用扫码登录：`redirect_uri` 须与开放平台登记一致。
 *
 * **与 RunNode 对齐**：RunNode 传 `window.location.origin`（与访问站点同源）；
 * ClawX 使用 **`VITE_CLOUD_API_BASE_URL` 的 origin**（与业务云、RunNode `.env` 中 API 根地址同源），
 * 这样 Electron `file://` 打包版也能使用已登记的 https 域名，无需单独配置回调 env。
 *
 * 若未配置 `VITE_CLOUD_API_BASE_URL` 或解析失败，在 `http(s)` 页面下回退为 `window.location.origin`（本地 Vite 开发）。
 */

function originFromViteCloudApiBase(): string | null {
  const raw = import.meta.env.VITE_CLOUD_API_BASE_URL?.trim();
  if (!raw) return null;
  try {
    const normalized = raw.replace(/\/+$/, '');
    const href = /^https?:\/\//i.test(normalized) ? normalized : `https://${normalized}`;
    const u = new URL(href);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.origin;
  } catch {
    return null;
  }
}

export function getWechatOAuthRedirectUri(): string | null {
  const fromCloud = originFromViteCloudApiBase();
  if (fromCloud) {
    return fromCloud;
  }

  if (typeof window === 'undefined') {
    return null;
  }

  const { protocol, origin } = window.location;
  if (protocol !== 'http:' && protocol !== 'https:') {
    return null;
  }

  return origin;
}
