import { describe, expect, it } from 'vitest';
import {
  isRunNodeSuccessCode,
  parseClawUserDeviceRegisterJson,
  nextHeartbeatFailureState,
  computeDeviceFingerprint,
} from '@electron/utils/cloud-user-device-helpers';

describe('cloud-user-device-helpers', () => {
  it('isRunNodeSuccessCode accepts 0 and 200 only', () => {
    expect(isRunNodeSuccessCode(0)).toBe(true);
    expect(isRunNodeSuccessCode(200)).toBe(true);
    expect(isRunNodeSuccessCode(401)).toBe(false);
    expect(isRunNodeSuccessCode('0')).toBe(false);
  });

  it('parseClawUserDeviceRegisterJson extracts id and deviceToken', () => {
    const r = parseClawUserDeviceRegisterJson({
      code: 0,
      data: { id: 7, deviceToken: 'abc', newlyCreated: true },
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.id).toBe(7);
      expect(r.deviceToken).toBe('abc');
    }
  });

  it('nextHeartbeatFailureState: 2xx + 业务成功 resets', () => {
    const s = nextHeartbeatFailureState({ consecutiveFailures: 2, httpStatus: 200, businessCode: 0 });
    expect(s.action).toBe('reset');
    expect(s.consecutiveFailures).toBe(0);
  });

  it('nextHeartbeatFailureState: HTTP 错误递增，满 3 次则清空重登', () => {
    let s = nextHeartbeatFailureState({ consecutiveFailures: 0, httpStatus: 503, businessCode: null });
    expect(s.action).toBe('increment');
    expect(s.consecutiveFailures).toBe(1);
    s = nextHeartbeatFailureState({ consecutiveFailures: 1, httpStatus: 503, businessCode: null });
    expect(s.action).toBe('increment');
    expect(s.consecutiveFailures).toBe(2);
    s = nextHeartbeatFailureState({ consecutiveFailures: 2, httpStatus: 503, businessCode: null });
    expect(s.action).toBe('clear_and_reregister');
  });

  it('nextHeartbeatFailureState: 401 立即清空重登', () => {
    const s = nextHeartbeatFailureState({ consecutiveFailures: 0, httpStatus: 401, businessCode: null });
    expect(s.action).toBe('clear_and_reregister');
  });

  it('nextHeartbeatFailureState: 2xx 但业务 code 失败则清空重登', () => {
    const s = nextHeartbeatFailureState({ consecutiveFailures: 0, httpStatus: 200, businessCode: 401 });
    expect(s.action).toBe('clear_and_reregister');
  });

  it('computeDeviceFingerprint is stable hex', () => {
    const a = computeDeviceFingerprint('mid-1', 'rclaw-claw-user-device-v1');
    const b = computeDeviceFingerprint('mid-1', 'rclaw-claw-user-device-v1');
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });
});
