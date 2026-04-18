import { mkdirSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { AgentsSnapshot } from './agent-config';
import { readWorkspaceSoulAgentsMd } from './digital-employee-workspace';
import { expandPath } from './paths';

export const RCLAW_DIGITAL_EMPLOYEE_SIDECAR_FILENAME = '.rclaw-digital-employee.json';
export const RCLAW_TODO_MARKER = '由 RClaw 数字员工系统生成';
export const HYDRATE_SYNTHETIC_ID_PREFIX = 'local-openclaw:';

const HYDRATE_FALLBACK_COLOR = '#6366f1';

export type HydratedEmployeePayload = {
  linkedAgentId: string;
  id: string;
  name: string;
  nameZh: string;
  description: string;
  descriptionZh?: string;
  color: string;
  emoji: string;
  vibe: string;
  vibeZh?: string;
  department: string;
  soulContent?: string;
  agentsContent?: string;
  identityContent?: string;
  skills?: string[];
  skipCatalogDetailFetch: boolean;
};

export type DigitalEmployeeSidecarV1 = {
  version: 1;
  catalogEmployeeId: string;
  skills?: string[];
};

function warnMalformedSidecar(reason: string): void {
  console.warn(`[digital-employee-hydration] Ignoring malformed sidecar (${reason}).`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function readDigitalEmployeeSidecar(absWorkspaceDir: string): Promise<DigitalEmployeeSidecarV1 | null> {
  const filePath = join(absWorkspaceDir, RCLAW_DIGITAL_EMPLOYEE_SIDECAR_FILENAME);
  let raw: string;
  try {
    raw = await readFile(filePath, 'utf8');
  } catch (e: unknown) {
    const code = (e as NodeJS.ErrnoException)?.code;
    if (code === 'ENOENT') return null;
    throw e;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    warnMalformedSidecar('invalid JSON');
    return null;
  }

  if (!isRecord(parsed)) {
    warnMalformedSidecar('not an object');
    return null;
  }

  if (parsed.version !== 1) {
    warnMalformedSidecar(`version is ${String(parsed.version)}, expected 1`);
    return null;
  }

  const catalogEmployeeId = parsed.catalogEmployeeId;
  if (typeof catalogEmployeeId !== 'string' || catalogEmployeeId.trim().length === 0) {
    warnMalformedSidecar('missing or empty catalogEmployeeId');
    return null;
  }

  const out: DigitalEmployeeSidecarV1 = {
    version: 1,
    catalogEmployeeId: catalogEmployeeId.trim(),
  };

  if (
    Array.isArray(parsed.skills) &&
    parsed.skills.length > 0 &&
    parsed.skills.every((s) => typeof s === 'string')
  ) {
    out.skills = parsed.skills as string[];
  }

  return out;
}

export function writeDigitalEmployeeSidecar(absWorkspaceDir: string, payload: DigitalEmployeeSidecarV1): void {
  mkdirSync(absWorkspaceDir, { recursive: true });
  const filePath = join(absWorkspaceDir, RCLAW_DIGITAL_EMPLOYEE_SIDECAR_FILENAME);
  writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

async function workspaceLooksLikeDigitalEmployeeWeak(absWorkspaceDir: string): Promise<boolean> {
  const readUtf8Optional = async (rel: string): Promise<string | null> => {
    try {
      return await readFile(join(absWorkspaceDir, rel), 'utf8');
    } catch (e: unknown) {
      const code = (e as NodeJS.ErrnoException)?.code;
      if (code === 'ENOENT') return null;
      throw e;
    }
  };

  const todo = await readUtf8Optional('TODO.md');
  if (todo === null || !todo.includes(RCLAW_TODO_MARKER)) return false;

  const soul = await readUtf8Optional('SOUL.md');
  if (soul === null || soul.trim().length === 0) return false;

  const agents = await readUtf8Optional('AGENTS.md');
  if (agents === null || agents.trim().length === 0) return false;

  return true;
}

const NAME_LINE = /^-\s*Name:\s*(.*)$/;
const CREATURE_LINE = /^-\s*Creature:\s*数字员工（职能角色：([^）]+)）\s*$/;
const VIBE_LINE = /^-\s*Vibe:\s*(.*)$/;
const EMOJI_LINE = /^-\s*Emoji:\s*(.*)$/;

export function parseIdentityMdForHydrate(
  content: string,
): { nameZh: string; name: string; emoji: string; vibe: string } | null {
  let nameZh: string | undefined;
  let name: string | undefined;
  let vibe: string | undefined;
  let emoji: string | undefined;

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trimEnd();
    const nameMatch = trimmed.match(NAME_LINE);
    if (nameMatch) {
      nameZh = nameMatch[1].trim();
      continue;
    }
    const creatureMatch = trimmed.match(CREATURE_LINE);
    if (creatureMatch) {
      name = creatureMatch[1].trim();
      continue;
    }
    const vibeMatch = trimmed.match(VIBE_LINE);
    if (vibeMatch) {
      vibe = vibeMatch[1].trim();
      continue;
    }
    const emojiMatch = trimmed.match(EMOJI_LINE);
    if (emojiMatch) {
      emoji = emojiMatch[1].trim();
      continue;
    }
  }

  if (nameZh === undefined || nameZh.length === 0) return null;
  if (name === undefined || name.length === 0) return null;
  if (vibe === undefined) return null;
  if (emoji === undefined) return null;

  return { nameZh, name, emoji, vibe };
}

export async function classifyDigitalEmployeeWorkspace(
  _agentId: string,
  absWorkspaceDir: string,
): Promise<'strong' | 'weak' | 'none'> {
  const sidecar = await readDigitalEmployeeSidecar(absWorkspaceDir);
  if (sidecar) return 'strong';
  if (await workspaceLooksLikeDigitalEmployeeWeak(absWorkspaceDir)) return 'weak';
  return 'none';
}

export function buildMinimalEmployeeRow(
  linkedAgentId: string,
  snapshotDisplayName: string,
): HydratedEmployeePayload {
  return {
    linkedAgentId,
    id: `${HYDRATE_SYNTHETIC_ID_PREFIX}${linkedAgentId}`,
    name: snapshotDisplayName,
    nameZh: snapshotDisplayName,
    description: '',
    color: HYDRATE_FALLBACK_COLOR,
    emoji: '—',
    vibe: '（可随对话补充）',
    department: 'custom',
    skipCatalogDetailFetch: true,
  };
}

async function readIdentityMdFull(absWorkspaceDir: string): Promise<string> {
  const identityPath = join(absWorkspaceDir, 'IDENTITY.md');
  try {
    return await readFile(identityPath, 'utf8');
  } catch (e: unknown) {
    const code = (e as NodeJS.ErrnoException)?.code;
    if (code === 'ENOENT') return '';
    throw e;
  }
}

export async function collectDigitalEmployeesForHydrate(
  snapshot: AgentsSnapshot,
): Promise<HydratedEmployeePayload[]> {
  const consumedAgentIds = new Set<string>();
  const rows: HydratedEmployeePayload[] = [];

  for (const entry of snapshot.agents) {
    if (consumedAgentIds.has(entry.id)) {
      console.warn(`[digital-employee-hydration] duplicate agent id in snapshot, skipping: ${entry.id}`);
      continue;
    }
    consumedAgentIds.add(entry.id);

    const absWorkspaceDir = expandPath(`~/.openclaw/workspace-${entry.id}`);
    const cls = await classifyDigitalEmployeeWorkspace(entry.id, absWorkspaceDir);
    if (cls === 'none') continue;

    const [{ soulContent, agentsContent }, identityContent, sidecar] = await Promise.all([
      readWorkspaceSoulAgentsMd(entry.id),
      readIdentityMdFull(absWorkspaceDir),
      cls === 'strong' ? readDigitalEmployeeSidecar(absWorkspaceDir) : Promise.resolve(null),
    ]);

    const parsed = parseIdentityMdForHydrate(identityContent);
    const minimal = buildMinimalEmployeeRow(entry.id, entry.name);

    const nameZh = parsed?.nameZh ?? minimal.nameZh;
    const name = parsed?.name ?? minimal.name;
    const emoji = parsed?.emoji ?? minimal.emoji;
    const vibe = parsed?.vibe ?? minimal.vibe;

    const isStrong = cls === 'strong' && sidecar !== null;
    const row: HydratedEmployeePayload = {
      linkedAgentId: entry.id,
      id: isStrong ? sidecar.catalogEmployeeId : `${HYDRATE_SYNTHETIC_ID_PREFIX}${entry.id}`,
      name,
      nameZh,
      description: '',
      color: HYDRATE_FALLBACK_COLOR,
      emoji,
      vibe,
      department: 'custom',
      soulContent: soulContent || undefined,
      agentsContent: agentsContent || undefined,
      identityContent: identityContent || undefined,
      skills: isStrong ? sidecar.skills : undefined,
      skipCatalogDetailFetch: !isStrong,
    };

    rows.push(row);
  }

  return rows;
}

export async function findAgentIdForCatalogEmployeeId(
  catalogEmployeeId: string,
  snapshot: AgentsSnapshot,
): Promise<string | null> {
  const needle = catalogEmployeeId.trim();
  if (!needle) return null;

  for (const entry of snapshot.agents) {
    const absWorkspaceDir = expandPath(`~/.openclaw/workspace-${entry.id}`);
    const sidecar = await readDigitalEmployeeSidecar(absWorkspaceDir);
    if (sidecar && sidecar.catalogEmployeeId === needle) {
      return entry.id;
    }
  }

  return null;
}
