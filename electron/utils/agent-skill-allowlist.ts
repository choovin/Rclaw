import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { readOpenClawConfig, writeOpenClawConfig } from './channel-config';
import { withConfigLock } from './config-mutex';
import type { ClawHubService } from '../gateway/clawhub';
import * as logger from './logger';
import { getOpenClawSkillsDir } from './paths';

/**
 * Normalize provision skill slugs: trim, drop empties, dedupe (first wins).
 */
export function normalizeProvisionSkillSlugs(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of input) {
    if (typeof x !== 'string') continue;
    const t = x.trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

export function isSkillPresentOnDisk(slug: string): boolean {
  const dir = join(getOpenClawSkillsDir(), slug.trim());
  if (!dir || !slug.trim()) return false;
  try {
    return existsSync(dir);
  } catch {
    return false;
  }
}

export type EnsureSlugsViaClawHubOptions = {
  /** Override disk presence check (defaults to {@link isSkillPresentOnDisk}; used in unit tests). */
  isPresent?: (slug: string) => boolean;
};

/**
 * For each slug: use disk if present; otherwise ClawHub install. Failed installs are skipped.
 */
export async function ensureSlugsViaClawHub(
  slugs: string[],
  clawHub: Pick<ClawHubService, 'install'>,
  log: { employeeId: string; agentId: string },
  options?: EnsureSlugsViaClawHubOptions,
): Promise<string[]> {
  const present = options?.isPresent ?? isSkillPresentOnDisk;
  const out: string[] = [];
  for (const slug of slugs) {
    if (present(slug)) {
      out.push(slug);
      continue;
    }
    try {
      await clawHub.install({ slug });
    } catch (e) {
      logger.warn('[provision] ClawHub install failed for skill slug', {
        slug,
        employeeId: log.employeeId,
        agentId: log.agentId,
        error: String(e),
      });
    }
    if (present(slug)) {
      out.push(slug);
    }
  }
  return out;
}

/**
 * Set per-agent skill allowlist in ~/.openclaw/openclaw.json (`agents.list[].skills`).
 * - Non-empty `slugs`: final allowlist (replaces inherited defaults per OpenClaw rules).
 * - `null` or empty array: remove `skills` so the agent inherits defaults / unrestricted baseline.
 */
export async function applyAgentSkillAllowlist(agentId: string, slugs: string[] | null): Promise<void> {
  const trimmedId = agentId.trim();
  if (!trimmedId) throw new Error('agentId must be non-empty');

  await withConfigLock(async () => {
    const config = await readOpenClawConfig();
    const agents = config.agents;
    if (!agents || typeof agents !== 'object' || Array.isArray(agents)) {
      throw new Error('OpenClaw config missing agents section');
    }
    const list = (agents as { list?: unknown }).list;
    if (!Array.isArray(list)) {
      throw new Error('OpenClaw config agents.list is not an array');
    }
    const idx = list.findIndex(
      (e) =>
        typeof e === 'object' &&
        e !== null &&
        typeof (e as { id?: unknown }).id === 'string' &&
        (e as { id: string }).id === trimmedId,
    );
    if (idx === -1) {
      throw new Error(`Agent "${trimmedId}" not found in openclaw.json`);
    }
    const entry: Record<string, unknown> = { ...(list[idx] as Record<string, unknown>) };
    if (slugs != null && slugs.length > 0) {
      entry.skills = [...slugs];
    } else {
      delete entry.skills;
    }
    list[idx] = entry;
    await writeOpenClawConfig(config);
  });
}
