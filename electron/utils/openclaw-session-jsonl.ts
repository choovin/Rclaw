import { join } from 'node:path';
import { getOpenClawConfigDir } from './paths';

/**
 * Resolve the absolute path to a session's transcript `.jsonl` from an OpenClaw session key
 * (e.g. `agent:main:main`) using `agents/<agentId>/sessions/sessions.json`.
 */
export async function resolveAgentSessionJsonlPath(sessionKey: string): Promise<string | null> {
  if (!sessionKey.startsWith('agent:')) return null;
  const parts = sessionKey.split(':');
  if (parts.length < 3) return null;

  const agentId = parts[1];
  if (!agentId) return null;

  const sessionsDir = join(getOpenClawConfigDir(), 'agents', agentId, 'sessions');
  const sessionsJsonPath = join(sessionsDir, 'sessions.json');
  const fsP = await import('node:fs/promises');
  let raw: string;
  try {
    raw = await fsP.readFile(sessionsJsonPath, 'utf8');
  } catch {
    return null;
  }

  let sessionsJson: Record<string, unknown>;
  try {
    sessionsJson = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }

  let uuidFileName: string | undefined;
  let resolvedSrcPath: string | undefined;

  if (Array.isArray(sessionsJson.sessions)) {
    const entry = (sessionsJson.sessions as Array<Record<string, unknown>>)
      .find((s) => s.key === sessionKey || s.sessionKey === sessionKey);
    if (entry) {
      uuidFileName = (entry.file ?? entry.fileName ?? entry.path) as string | undefined;
      if (!uuidFileName && typeof entry.id === 'string') {
        uuidFileName = `${entry.id}.jsonl`;
      }
    }
  }

  if (!uuidFileName && sessionsJson[sessionKey] != null) {
    const val = sessionsJson[sessionKey];
    if (typeof val === 'string') {
      uuidFileName = val;
    } else if (typeof val === 'object' && val !== null) {
      const entry = val as Record<string, unknown>;
      const absFile = (entry.sessionFile ?? entry.file ?? entry.fileName ?? entry.path) as string | undefined;
      if (absFile) {
        if (absFile.startsWith('/') || absFile.match(/^[A-Za-z]:\\/)) {
          resolvedSrcPath = absFile;
        } else {
          uuidFileName = absFile;
        }
      } else {
        const uuidVal = (entry.id ?? entry.sessionId) as string | undefined;
        if (uuidVal) uuidFileName = uuidVal.endsWith('.jsonl') ? uuidVal : `${uuidVal}.jsonl`;
      }
    }
  }

  if (!uuidFileName && !resolvedSrcPath) return null;

  if (!resolvedSrcPath) {
    if (!uuidFileName!.endsWith('.jsonl')) uuidFileName = `${uuidFileName}.jsonl`;
    resolvedSrcPath = join(sessionsDir, uuidFileName!);
  }

  try {
    await fsP.access(resolvedSrcPath);
  } catch {
    return null;
  }

  return resolvedSrcPath;
}
