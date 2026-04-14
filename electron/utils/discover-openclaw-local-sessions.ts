import { join } from 'node:path';
import { getOpenClawConfigDir } from './paths';

export type DiscoveredLocalSession = {
  key: string;
  displayName?: string;
  label?: string;
};

/**
 * Scan ~/.openclaw/agents/<agentId>/sessions/sessions.json for all session keys.
 * Used when Gateway is not ready yet so the sidebar can still list multi-agent sessions.
 */
export async function discoverOpenClawSessionsFromDisk(): Promise<DiscoveredLocalSession[]> {
  const agentsRoot = join(getOpenClawConfigDir(), 'agents');
  const fs = await import('node:fs/promises');
  let dirents: Awaited<ReturnType<typeof fs.readdir>>;
  try {
    dirents = await fs.readdir(agentsRoot, { withFileTypes: true });
  } catch {
    return [];
  }

  const out: DiscoveredLocalSession[] = [];
  const seen = new Set<string>();

  for (const d of dirents) {
    if (!d.isDirectory()) continue;
    const agentId = d.name;
    const sessionsJsonPath = join(agentsRoot, agentId, 'sessions', 'sessions.json');
    let raw: string;
    try {
      raw = await fs.readFile(sessionsJsonPath, 'utf8');
    } catch {
      continue;
    }

    let doc: Record<string, unknown>;
    try {
      doc = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      continue;
    }

    const pushKey = (key: string, displayName?: string, label?: string) => {
      if (!key.startsWith('agent:') || seen.has(key)) return;
      seen.add(key);
      const entry: DiscoveredLocalSession = { key };
      if (displayName) entry.displayName = displayName;
      if (label) entry.label = label;
      out.push(entry);
    };

    if (Array.isArray(doc.sessions)) {
      for (const item of doc.sessions as Array<Record<string, unknown>>) {
        const key = String(item.key ?? item.sessionKey ?? '').trim();
        if (!key) continue;
        pushKey(
          key,
          item.displayName != null ? String(item.displayName) : undefined,
          item.label != null ? String(item.label) : undefined,
        );
      }
    }

    const skipRoots = new Set(['sessions', 'version', 'metadata', 'schema']);
    for (const [k, v] of Object.entries(doc)) {
      if (skipRoots.has(k)) continue;
      if (!k.startsWith('agent:')) continue;
      if (typeof v === 'string') {
        pushKey(k);
        continue;
      }
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        const entry = v as Record<string, unknown>;
        pushKey(
          k,
          entry.displayName != null ? String(entry.displayName) : undefined,
          entry.label != null ? String(entry.label) : undefined,
        );
      }
    }
  }

  return out;
}
