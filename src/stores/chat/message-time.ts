import type { RawMessage } from './types';

/** Normalize a numeric timestamp to milliseconds (seconds vs ms). */
function toMs(ts: number): number {
  return ts < 1e12 ? ts * 1000 : ts;
}

/**
 * Latest message time in a batch. Prefer this over `messages.at(-1)` when the
 * gateway may return a truncated window that is not strictly chronological.
 */
export function maxRawMessageTimestampMs(messages: RawMessage[]): number | undefined {
  let max = 0;
  for (const m of messages) {
    const ts = m.timestamp;
    if (ts == null) continue;
    let ms: number;
    if (typeof ts === 'number' && Number.isFinite(ts)) {
      ms = toMs(ts);
    } else if (typeof ts === 'string') {
      const p = Date.parse(ts);
      if (!Number.isFinite(p)) continue;
      ms = p;
    } else {
      continue;
    }
    if (ms > max) max = ms;
  }
  return max > 0 ? max : undefined;
}
