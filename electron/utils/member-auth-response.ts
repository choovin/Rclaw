/**
 * 解析 RunNode / 芋道风格会员认证 JSON（根级 code/msg，成功体常在 data 内）。
 * 与 `docs/api-docs/04_Member_API.md` 路径无关，仅处理响应形状。
 */

export interface MemberLoginUserInfo {
  id: string | number;
  username: string;
  nickname?: string;
  mobile?: string;
  avatar?: string;
}

export interface NormalizedLoginTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  userInfo: MemberLoginUserInfo;
}

function asRecord(v: unknown): Record<string, unknown> | null {
  if (v == null || typeof v !== 'object' || Array.isArray(v)) return null;
  return v as Record<string, unknown>;
}

function pickStr(r: Record<string, unknown>, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = r[k];
    if (typeof v === 'string' && v.length > 0) return v;
  }
  return undefined;
}

function pickNum(r: Record<string, unknown>, keys: string[]): number | undefined {
  for (const k of keys) {
    const v = r[k];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
  }
  return undefined;
}

function hasAccessTokenShape(o: Record<string, unknown>): boolean {
  return 'accessToken' in o || 'access_token' in o;
}

function normalizeUserInfo(raw: unknown): MemberLoginUserInfo | null {
  const r = asRecord(raw);
  if (!r) return null;
  const idRaw = r.id ?? r.userId;
  let id: string | number | undefined;
  if (typeof idRaw === 'string' || typeof idRaw === 'number') {
    id = idRaw;
  } else if (idRaw != null) {
    id = String(idRaw);
  }
  const nickname = typeof r.nickname === 'string' ? r.nickname : undefined;
  const mobile = typeof r.mobile === 'string' ? r.mobile : undefined;
  const avatar = typeof r.avatar === 'string' ? r.avatar : undefined;
  const usernameRaw = typeof r.username === 'string' ? r.username : '';
  const username =
    usernameRaw || nickname || mobile || (id != null ? String(id) : '') || '用户';
  if (id == null && !usernameRaw && !nickname && !mobile) return null;
  return {
    id: id ?? username,
    username,
    nickname,
    mobile,
    avatar,
  };
}

/** 从 accessToken 所在对象推导过期秒数：支持 expiresTime（绝对时间 ms）或 expiresIn（秒） */
function resolveExpiresInSeconds(p: Record<string, unknown>): number {
  const expiresTime = pickNum(p, ['expiresTime', 'expires_time']);
  if (expiresTime != null && expiresTime > Date.now()) {
    return Math.max(60, Math.floor((expiresTime - Date.now()) / 1000));
  }
  const expiresIn = pickNum(p, ['expiresIn', 'expires_in']);
  if (expiresIn != null && expiresIn > 0) return expiresIn;
  return 7200;
}

/**
 * 解析登录 / 社交登录接口 JSON，兼容：
 * - 根级带 accessToken、userInfo
 * - `{ code: 0, data: { accessToken, refreshToken, userInfo } }`
 * - `{ code: 0, data: { userId, accessToken, refreshToken, expiresTime } }`（无嵌套 userInfo 时从 data 推导）
 */
export function parseMemberAuthLoginBody(
  raw: unknown,
): { ok: true; value: NormalizedLoginTokens } | { ok: false; error: string } {
  const root = asRecord(raw);
  if (!root) {
    return { ok: false, error: '响应无效' };
  }

  const code = root.code;
  if (typeof code === 'number' && code !== 0) {
    return { ok: false, error: String(root.msg ?? root.message ?? '请求失败') };
  }

  let p = root;
  const data = root.data;
  if (data != null && typeof data === 'object' && !Array.isArray(data)) {
    const dr = data as Record<string, unknown>;
    if (hasAccessTokenShape(dr)) {
      p = dr;
    } else {
      const inner = dr.data;
      if (
        inner != null &&
        typeof inner === 'object' &&
        !Array.isArray(inner) &&
        hasAccessTokenShape(inner as Record<string, unknown>)
      ) {
        p = inner as Record<string, unknown>;
      }
    }
  }

  const accessToken = pickStr(p, ['accessToken', 'access_token']);
  const refreshToken = pickStr(p, ['refreshToken', 'refresh_token']) ?? '';
  const expiresIn = resolveExpiresInSeconds(p);
  const userInfo =
    normalizeUserInfo(p.userInfo ?? p.user ?? p.memberUser) ??
    normalizeUserInfo(p);

  if (!accessToken || !userInfo) {
    return {
      ok: false,
      error: String(
        typeof root.code === 'number' && root.code !== 0
          ? root.msg ?? root.message
          : '登录失败',
      ),
    };
  }

  return {
    ok: true,
    value: {
      accessToken,
      refreshToken,
      expiresIn,
      userInfo,
    },
  };
}

export function parseMemberAuthRefreshBody(
  raw: unknown,
): { ok: true; accessToken: string; expiresIn: number } | { ok: false } {
  const root = asRecord(raw);
  if (!root) return { ok: false };

  const code = root.code;
  if (typeof code === 'number' && code !== 0) return { ok: false };

  let p = root;
  const data = root.data;
  if (data != null && typeof data === 'object' && !Array.isArray(data)) {
    const dr = data as Record<string, unknown>;
    if (pickStr(dr, ['accessToken', 'access_token'])) {
      p = dr;
    }
  }

  const accessToken = pickStr(p, ['accessToken', 'access_token']);
  if (!accessToken) return { ok: false };
  const expiresIn = resolveExpiresInSeconds(p);
  return { ok: true, accessToken, expiresIn };
}
