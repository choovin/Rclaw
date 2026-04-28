import { createHash } from 'crypto';

export function isRunNodeSuccessCode(code: unknown): boolean {
  return code === 0 || code === 200;
}

export function computeDeviceFingerprint(machineId: string, salt: string): string {
  return createHash('sha256').update(`${machineId}\0${salt}`, 'utf8').digest('hex');
}

export type RegisterParseResult = { ok: true; id: number } | { ok: false };

export function parseClawUserDeviceRegisterJson(raw: unknown): RegisterParseResult {
  if (raw === null || typeof raw !== 'object') return { ok: false };
  const o = raw as Record<string, unknown>;
  if (!isRunNodeSuccessCode(o.code)) return { ok: false };
  const data = o.data;
  if (data === null || typeof data !== 'object') return { ok: false };
  const d = data as Record<string, unknown>;
  const id = d.id;
  if (typeof id !== 'number') return { ok: false };
  return { ok: true, id };
}

export type HeartbeatFailureInput = {
  consecutiveFailures: number;
  httpStatus: number;
  businessCode: unknown;
};

export type HeartbeatFailureOutput = {
  action: 'reset' | 'increment' | 'clear_and_reregister';
  consecutiveFailures: number;
};

const HEARTBEAT_FAIL_THRESHOLD = 3;

export function nextHeartbeatFailureState(input: HeartbeatFailureInput): HeartbeatFailureOutput {
  if (input.httpStatus === 401 || input.httpStatus === 403) {
    return { action: 'clear_and_reregister', consecutiveFailures: 0 };
  }
  if (input.httpStatus < 200 || input.httpStatus >= 300) {
    const next = input.consecutiveFailures + 1;
    if (next >= HEARTBEAT_FAIL_THRESHOLD) {
      return { action: 'clear_and_reregister', consecutiveFailures: 0 };
    }
    return { action: 'increment', consecutiveFailures: next };
  }
  if (!isRunNodeSuccessCode(input.businessCode)) {
    return { action: 'clear_and_reregister', consecutiveFailures: 0 };
  }
  return { action: 'reset', consecutiveFailures: 0 };
}
