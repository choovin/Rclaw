import { mkdir, mkdtemp, rm, writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentSummary, AgentsSnapshot } from '@electron/utils/agent-config';
import { buildIdentityMd } from '@electron/utils/digital-employee-workspace';
import {
  classifyDigitalEmployeeWorkspace,
  HYDRATE_SYNTHETIC_ID_PREFIX,
  parseIdentityMdForHydrate,
  RCLAW_TODO_MARKER,
  writeDigitalEmployeeSidecar,
} from '@electron/utils/digital-employee-hydration';

const { testHome } = vi.hoisted(() => {
  const suffix = Math.random().toString(36).slice(2);
  return {
    testHome: `/tmp/rclaw-de-hydr-${suffix}`,
  };
});

vi.mock('os', async () => {
  const actual = await vi.importActual<typeof import('os')>('os');
  const mocked = {
    ...actual,
    homedir: () => testHome,
  };
  return {
    ...mocked,
    default: mocked,
  };
});

function agentSummary(id: string, name: string): AgentSummary {
  return {
    id,
    name,
    isDefault: false,
    modelDisplay: '',
    modelRef: null,
    overrideModelRef: null,
    inheritedModel: true,
    workspace: '',
    agentDir: '',
    mainSessionKey: `agent:${id}:desk`,
    channelTypes: [],
  };
}

function snapshotWithAgents(agents: AgentSummary[]): AgentsSnapshot {
  return {
    agents,
    defaultAgentId: agents[0]?.id ?? 'main',
    defaultModelRef: null,
    configuredChannelTypes: [],
    channelOwners: {},
    channelAccountOwners: {},
  };
}

describe('classifyDigitalEmployeeWorkspace', () => {
  it('classifies strong when workspace has valid sidecar only (TODO may be empty or missing)', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'de-hydr-'));
    try {
      writeDigitalEmployeeSidecar(dir, { version: 1, catalogEmployeeId: 'cat-1' });

      const cls = await classifyDigitalEmployeeWorkspace('agent-x', dir);
      expect(cls).toBe('strong');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('classifies weak when TODO has marker and SOUL/AGENTS are non-empty, with no sidecar', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'de-hydr-'));
    try {
      await writeFile(
        join(dir, 'TODO.md'),
        `# Todo\n\n---\n*${RCLAW_TODO_MARKER}*\n`,
        'utf8',
      );
      await writeFile(join(dir, 'SOUL.md'), 'soul body', 'utf8');
      await writeFile(join(dir, 'AGENTS.md'), 'agents body', 'utf8');

      const cls = await classifyDigitalEmployeeWorkspace('agent-y', dir);
      expect(cls).toBe('weak');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('classifies none for folder without marker and without valid sidecar', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'de-hydr-'));
    try {
      await writeFile(join(dir, 'README.md'), '# main\n', 'utf8');

      const cls = await classifyDigitalEmployeeWorkspace('main', dir);
      expect(cls).toBe('none');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe('parseIdentityMdForHydrate', () => {
  it('parses IDENTITY content consistent with buildIdentityMd', () => {
    const md = buildIdentityMd({
      nameZh: '张三',
      roleTitle: '人类学家',
      soulContent: '',
      agentsContent: '',
      identityContent: 'extra block',
      emoji: '🌍',
      vibe: '沉稳',
    });

    expect(parseIdentityMdForHydrate(md)).toEqual({
      nameZh: '张三',
      name: '人类学家',
      emoji: '🌍',
      vibe: '沉稳',
    });
  });

  it('returns null when Name line is missing', () => {
    const content = `# IDENTITY.md - 我是谁

- Creature: 数字员工（职能角色：人类学家）
- Vibe: （可随对话补充）
- Emoji: —
`;
    expect(parseIdentityMdForHydrate(content)).toBeNull();
  });
});

describe('findAgentIdForCatalogEmployeeId', () => {
  beforeEach(async () => {
    await rm(testHome, { recursive: true, force: true });
  });

  it('returns the agent id whose workspace sidecar lists the catalog employee id', async () => {
    const openclaw = join(testHome, '.openclaw');
    const dirA = join(openclaw, 'workspace-agent-a');
    const dirB = join(openclaw, 'workspace-agent-b');
    await mkdir(dirA, { recursive: true });
    await mkdir(dirB, { recursive: true });
    writeDigitalEmployeeSidecar(dirA, { version: 1, catalogEmployeeId: 'catalog-xyz' });

    const { findAgentIdForCatalogEmployeeId } = await import('@electron/utils/digital-employee-hydration');
    const snap = snapshotWithAgents([agentSummary('agent-a', 'A'), agentSummary('agent-b', 'B')]);

    await expect(findAgentIdForCatalogEmployeeId('catalog-xyz', snap)).resolves.toBe('agent-a');
    await expect(findAgentIdForCatalogEmployeeId('other', snap)).resolves.toBeNull();

  });
});

describe('collectDigitalEmployeesForHydrate', () => {
  beforeEach(async () => {
    await rm(testHome, { recursive: true, force: true });
  });

  it('returns one weak row with synthetic id prefix and linkedAgentId', async () => {
    const openclaw = join(testHome, '.openclaw');
    const ws = join(openclaw, 'workspace-weak-1');
    await mkdir(ws, { recursive: true });
    await writeFile(
      join(ws, 'TODO.md'),
      `# Todo\n\n---\n*${RCLAW_TODO_MARKER}*\n`,
      'utf8',
    );
    await writeFile(join(ws, 'SOUL.md'), 'soul body', 'utf8');
    await writeFile(join(ws, 'AGENTS.md'), 'agents body', 'utf8');

    const { collectDigitalEmployeesForHydrate } = await import('@electron/utils/digital-employee-hydration');
    const snap = snapshotWithAgents([agentSummary('weak-1', 'Snapshot display')]);

    const rows = await collectDigitalEmployeesForHydrate(snap);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      linkedAgentId: 'weak-1',
      id: `${HYDRATE_SYNTHETIC_ID_PREFIX}weak-1`,
      name: 'Snapshot display',
      nameZh: 'Snapshot display',
      skipCatalogDetailFetch: true,
      department: 'custom',
      color: '#6366f1',
    });
    expect(rows[0].soulContent).toBe('soul body');
    expect(rows[0].agentsContent).toBe('agents body');
  });
});
