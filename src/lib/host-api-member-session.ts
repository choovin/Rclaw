/**
 * Paths for which an AUTH_INVALID response from hostApiFetch should clear
 * member UI state and prompt re-login. See spec member-auth-gate-and-chat-draft.
 */

export function shouldInvalidateMemberSessionOnAuthError(path: string, method: string): boolean {
  const p = (path.split('?')[0] ?? '').trim();
  const m = (method || 'GET').toUpperCase();

  if (
    m === 'POST'
    && (p === '/api/cloud/auth/login'
      || p === '/api/cloud/auth/sms-login'
      || p === '/api/cloud/auth/wechat-login'
      || p === '/api/cloud/auth/logout')
  ) {
    return false;
  }

  if (p.startsWith('/api/cloud/')) return true;
  if (p === '/api/employees/provision' || p === '/api/employees/update') return true;
  if (p.startsWith('/api/clawhub/')) return true;

  return false;
}
