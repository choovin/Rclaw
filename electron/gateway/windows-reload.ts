import { appendFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

const SECRETS_RELOAD_TIMEOUT_MS = 15_000;

export type WindowsReloadResult =
  | { ok: true; via: 'touch' }
  | { ok: false; reason: string };

export type WindowsReloadDeps = {
  rpc: (method: string, params?: unknown, timeoutMs?: number) => Promise<unknown>;
  /** Defaults to ~/.openclaw/openclaw.json (same file as gateway.reload policy reads). */
  configPath?: string;
  /**
   * Bump config mtime (Nexu-style). Defaults to `appendFile(path, '', 'utf8')`.
   * Exposed for unit tests (ESM cannot spy on `node:fs/promises`).
   */
  touchConfigFile?: (path: string) => Promise<void>;
};

function defaultOpenClawConfigPath(): string {
  return join(homedir(), '.openclaw', 'openclaw.json');
}

/**
 * Windows has no SIGUSR1. Touch the OpenClaw config file (mtime bump) so the
 * Gateway's config watcher can hot-reload, matching the Nexu controller pattern.
 * Best-effort `secrets.reload` runs after a successful touch (see spike doc).
 */
export async function tryWindowsGatewayReload(deps: WindowsReloadDeps): Promise<WindowsReloadResult> {
  const configPath = deps.configPath ?? defaultOpenClawConfigPath();
  const touch = deps.touchConfigFile ?? ((p: string) => appendFile(p, '', 'utf8'));

  try {
    await touch(configPath);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return { ok: false, reason };
  }

  try {
    await deps.rpc('secrets.reload', undefined, SECRETS_RELOAD_TIMEOUT_MS);
  } catch {
    // Optional: SecretRef snapshot refresh; touch alone is the primary success path.
  }

  return { ok: true, via: 'touch' };
}
