/**
 * Parse OpenClaw agent session `.jsonl` into message objects for the chat UI.
 *
 * Typical line: `{ type?: "message", timestamp?: string, message: { role, content, ... } }`.
 * Some OpenClaw builds omit `type` while still using `message` + `timestamp` (see TranscriptLineShape
 * in token-usage-core). Requiring `type === "message"` would drop every line and break local prefetch.
 */
export function parseOpenClawTranscriptJsonlToMessages(raw: string, limit: number): unknown[] {
  const lines = raw.split(/\r?\n/).filter(Boolean);
  const messages: unknown[] = [];

  for (const line of lines) {
    let entry: Record<string, unknown>;
    try {
      entry = JSON.parse(line) as Record<string, unknown>;
    } catch {
      continue;
    }

    const wrapped = entry.message;
    if (wrapped && typeof wrapped === 'object' && wrapped !== null && !Array.isArray(wrapped)) {
      const t = entry.type;
      if (t != null && t !== '' && t !== 'message') {
        continue;
      }
      messages.push(wrapped);
      continue;
    }

    if (typeof entry.role === 'string') {
      messages.push(entry);
    }
  }

  const cap = Math.min(500, Math.max(1, limit));
  return messages.length > cap ? messages.slice(-cap) : messages;
}
