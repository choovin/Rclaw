import { describe, expect, it } from 'vitest';
import {
  parseMemberAuthLoginBody,
  parseMemberAuthRefreshBody,
} from '@electron/utils/member-auth-response';

describe('parseMemberAuthLoginBody', () => {
  it('accepts flat success shape', () => {
    const r = parseMemberAuthLoginBody({
      code: 0,
      accessToken: 'a',
      refreshToken: 'r',
      expiresIn: 3600,
      userInfo: { id: 1, username: 'u', nickname: 'n' },
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.accessToken).toBe('a');
      expect(r.value.userInfo.username).toBe('u');
    }
  });

  it('accepts data-wrapped shape', () => {
    const r = parseMemberAuthLoginBody({
      code: 0,
      data: {
        accessToken: 'a',
        refresh_token: 'r',
        expires_in: 7200,
        user: { id: 2, username: 'x' },
      },
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.accessToken).toBe('a');
      expect(r.value.refreshToken).toBe('r');
      expect(r.value.userInfo.username).toBe('x');
    }
  });

  it('rejects non-zero code', () => {
    const r = parseMemberAuthLoginBody({ code: 400, msg: 'bad' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('bad');
  });

  it('accepts RunNode data with userId and expiresTime (no nested userInfo)', () => {
    const future = Date.now() + 7200_000;
    const r = parseMemberAuthLoginBody({
      code: 0,
      msg: 'SUCCESS',
      data: {
        userId: 15111171279,
        accessToken: 'tok',
        refreshToken: 'ref',
        expiresTime: future,
      },
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.userInfo.id).toBe(15111171279);
      expect(r.value.expiresIn).toBeGreaterThan(7100);
      expect(r.value.expiresIn).toBeLessThanOrEqual(7200);
    }
  });
});

describe('parseMemberAuthRefreshBody', () => {
  it('unwraps data', () => {
    const r = parseMemberAuthRefreshBody({
      code: 0,
      data: { accessToken: 'new', expiresIn: 100 },
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.accessToken).toBe('new');
      expect(r.expiresIn).toBe(100);
    }
  });

  it('uses expiresTime ms when present', () => {
    const future = Date.now() + 300_000;
    const r = parseMemberAuthRefreshBody({
      code: 0,
      data: { accessToken: 'new', expiresTime: future },
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.expiresIn).toBeGreaterThan(290);
      expect(r.expiresIn).toBeLessThanOrEqual(300);
    }
  });
});
