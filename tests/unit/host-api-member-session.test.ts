import { describe, expect, it } from 'vitest';
import { shouldInvalidateMemberSessionOnAuthError } from '@/lib/host-api-member-session';

describe('shouldInvalidateMemberSessionOnAuthError', () => {
  it('allows /api/cloud/* except login attempts and logout', () => {
    expect(shouldInvalidateMemberSessionOnAuthError('/api/cloud/claw/catalog/agents', 'GET')).toBe(true);
    expect(shouldInvalidateMemberSessionOnAuthError('/api/cloud/auth/status', 'GET')).toBe(true);
    expect(shouldInvalidateMemberSessionOnAuthError('/api/cloud/auth/status?x=1', 'GET')).toBe(true);
    expect(shouldInvalidateMemberSessionOnAuthError('/api/cloud/auth/login', 'POST')).toBe(false);
    expect(shouldInvalidateMemberSessionOnAuthError('/api/cloud/auth/sms-login', 'POST')).toBe(false);
    expect(shouldInvalidateMemberSessionOnAuthError('/api/cloud/auth/wechat-login', 'POST')).toBe(false);
    expect(shouldInvalidateMemberSessionOnAuthError('/api/cloud/auth/logout', 'POST')).toBe(false);
  });

  it('includes employees provision/update and clawhub', () => {
    expect(shouldInvalidateMemberSessionOnAuthError('/api/employees/provision', 'POST')).toBe(true);
    expect(shouldInvalidateMemberSessionOnAuthError('/api/employees/update', 'POST')).toBe(true);
    expect(shouldInvalidateMemberSessionOnAuthError('/api/clawhub/install', 'POST')).toBe(true);
  });

  it('excludes unrelated host routes', () => {
    expect(shouldInvalidateMemberSessionOnAuthError('/api/agents', 'GET')).toBe(false);
    expect(shouldInvalidateMemberSessionOnAuthError('/api/settings', 'GET')).toBe(false);
  });
});
