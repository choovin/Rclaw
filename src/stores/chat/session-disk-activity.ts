import { hostApiFetch } from '@/lib/host-api';
import { isCronSessionKey } from './cron-session-utils';
import { maxRawMessageTimestampMs } from './message-time';
import type { RawMessage } from './types';

/**
 * Best-effort last message time from on-disk transcript tails (Host API returns the last N lines).
 */
export async function fetchDiskLastActivityBySessionKeys(keys: string[]): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  const targets = keys.filter((k) => k.startsWith('agent:') && !isCronSessionKey(k));
  await Promise.all(
    targets.map(async (sessionKey) => {
      try {
        const params = new URLSearchParams({ sessionKey, limit: '500' });
        const res = await hostApiFetch<{ success?: boolean; messages?: RawMessage[] }>(
          `/api/sessions/transcript-by-key?${params.toString()}`,
        );
        if (res.success === false || !Array.isArray(res.messages) || res.messages.length === 0) return;
        const maxMs = maxRawMessageTimestampMs(res.messages);
        if (maxMs != null) out[sessionKey] = maxMs;
      } catch {
        /* no local transcript */
      }
    }),
  );
  return out;
}
