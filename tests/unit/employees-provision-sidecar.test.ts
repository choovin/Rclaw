import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IncomingMessage, ServerResponse } from 'http';
import { expandPath } from '@electron/utils/paths';

const mocks = vi.hoisted(() => ({
  listAgentsSnapshot: vi.fn(),
  findAgentIdForCatalogEmployeeId: vi.fn(),
  writeDigitalEmployeeSidecar: vi.fn(),
  provisionDigitalEmployeeAgent: vi.fn(),
  updateDigitalEmployeeAgentWorkspace: vi.fn(),
  parseJsonBody: vi.fn(),
  sendJson: vi.fn(),
  ensureSlugsViaClawHub: vi.fn(),
}));

vi.mock('@electron/utils/agent-skill-allowlist', () => ({
  applyAgentSkillAllowlist: vi.fn(),
  ensureSlugsViaClawHub: (...args: unknown[]) => mocks.ensureSlugsViaClawHub(...args),
  normalizeProvisionSkillSlugs: vi.fn((input: unknown) => {
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
  }),
}));

vi.mock('@electron/utils/agent-config', () => ({
  assignChannelToAgent: vi.fn(),
  createAgent: vi.fn(),
  clearChannelBinding: vi.fn(),
  deleteAgentConfig: vi.fn(),
  listAgentsSnapshot: (...args: unknown[]) => mocks.listAgentsSnapshot(...args),
  listConfiguredAgentIds: vi.fn(),
  provisionDigitalEmployeeAgent: (...args: unknown[]) => mocks.provisionDigitalEmployeeAgent(...args),
  removeAgentWorkspaceDirectory: vi.fn(),
  resolveAccountIdForAgent: vi.fn(),
  updateAgentModel: vi.fn(),
  updateAgentName: vi.fn(),
  updateDigitalEmployeeAgentWorkspace: (...args: unknown[]) => mocks.updateDigitalEmployeeAgentWorkspace(...args),
}));

vi.mock('@electron/utils/channel-config', () => ({
  deleteChannelAccountConfig: vi.fn(),
}));

vi.mock('@electron/services/providers/provider-runtime-sync', () => ({
  syncAgentModelOverrideToRuntime: vi.fn(),
  syncAllProviderAuthToRuntime: vi.fn(),
}));

vi.mock('@electron/utils/digital-employee-workspace', () => ({
  readWorkspaceSoulAgentsMd: vi.fn(),
}));

vi.mock('@electron/utils/digital-employee-hydration', () => ({
  collectDigitalEmployeesForHydrate: vi.fn(),
  findAgentIdForCatalogEmployeeId: (...args: unknown[]) => mocks.findAgentIdForCatalogEmployeeId(...args),
  writeDigitalEmployeeSidecar: (...args: unknown[]) => mocks.writeDigitalEmployeeSidecar(...args),
}));

vi.mock('@electron/api/route-utils', () => ({
  parseJsonBody: (...args: unknown[]) => mocks.parseJsonBody(...args),
  sendJson: (...args: unknown[]) => mocks.sendJson(...args),
}));

const minimalProvisionBody = {
  employeeId: 'emp-1',
  nameZh: '名',
  nameEn: 'Name',
  soulContent: 'soul',
  agentsContent: 'agents',
  identityContent: '',
};

function testCtx(): never {
  return {
    gatewayManager: {
      getStatus: () => ({ state: 'stopped' as const }),
      debouncedReload: vi.fn(),
    },
    clawHubService: { install: vi.fn() },
    eventBus: {} as never,
    mainWindow: null,
  } as never;
}

describe('POST /api/employees/provision duplicate guard + sidecar', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns 409 when catalog employee is already provisioned', async () => {
    const snap = { agents: [], channelAccountOwners: {} };
    mocks.parseJsonBody.mockResolvedValueOnce({ ...minimalProvisionBody, skills: ['a'] });
    mocks.listAgentsSnapshot.mockResolvedValueOnce(snap);
    mocks.findAgentIdForCatalogEmployeeId.mockResolvedValueOnce('existing-agent');

    const { handleAgentRoutes } = await import('@electron/api/routes/agents');

    const handled = await handleAgentRoutes(
      { method: 'POST' } as IncomingMessage,
      {} as ServerResponse,
      new URL('http://127.0.0.1:13210/api/employees/provision'),
      testCtx(),
    );

    expect(handled).toBe(true);
    expect(mocks.findAgentIdForCatalogEmployeeId).toHaveBeenCalledWith('emp-1', snap);
    expect(mocks.provisionDigitalEmployeeAgent).not.toHaveBeenCalled();
    expect(mocks.writeDigitalEmployeeSidecar).not.toHaveBeenCalled();
    expect(mocks.sendJson).toHaveBeenCalledWith(expect.anything(), 409, {
      success: false,
      error: 'catalog_employee_already_provisioned',
      existingAgentId: 'existing-agent',
    });
  });

  it('writes sidecar after provision with normalized skills', async () => {
    mocks.parseJsonBody.mockResolvedValueOnce({ ...minimalProvisionBody, skills: ['  skill-a  ', 'skill-a'] });
    mocks.listAgentsSnapshot.mockResolvedValueOnce({ agents: [], channelAccountOwners: {} });
    mocks.findAgentIdForCatalogEmployeeId.mockResolvedValueOnce(null);
    mocks.provisionDigitalEmployeeAgent.mockResolvedValueOnce({
      agentId: 'new-agent',
      workspacePath: 'C:\\mock\\workspace',
    });
    mocks.ensureSlugsViaClawHub.mockResolvedValueOnce(['skill-a']);

    const { handleAgentRoutes } = await import('@electron/api/routes/agents');

    await handleAgentRoutes(
      { method: 'POST' } as IncomingMessage,
      {} as ServerResponse,
      new URL('http://127.0.0.1:13210/api/employees/provision'),
      testCtx(),
    );

    expect(mocks.writeDigitalEmployeeSidecar).toHaveBeenCalledWith('C:\\mock\\workspace', {
      version: 1,
      catalogEmployeeId: 'emp-1',
      skills: ['skill-a'],
    });
  });

  it('writes sidecar without skills when none requested', async () => {
    mocks.parseJsonBody.mockResolvedValueOnce({ ...minimalProvisionBody });
    mocks.listAgentsSnapshot.mockResolvedValueOnce({ agents: [], channelAccountOwners: {} });
    mocks.findAgentIdForCatalogEmployeeId.mockResolvedValueOnce(null);
    mocks.provisionDigitalEmployeeAgent.mockResolvedValueOnce({
      agentId: 'new-agent',
      workspacePath: '/w',
    });

    const { handleAgentRoutes } = await import('@electron/api/routes/agents');

    await handleAgentRoutes(
      { method: 'POST' } as IncomingMessage,
      {} as ServerResponse,
      new URL('http://127.0.0.1:13210/api/employees/provision'),
      testCtx(),
    );

    expect(mocks.writeDigitalEmployeeSidecar).toHaveBeenCalledWith('/w', {
      version: 1,
      catalogEmployeeId: 'emp-1',
    });
  });
});

describe('POST /api/employees/update sidecar', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('writes sidecar to expanded workspace path with skills when present', async () => {
    const linked = 'agent-z';
    mocks.parseJsonBody.mockResolvedValueOnce({
      employeeId: ' cat-9 ',
      linkedAgentId: linked,
      nameZh: '名',
      nameEn: 'Name',
      soulContent: 'soul',
      agentsContent: 'agents',
      identityContent: '',
      skills: ['s1'],
    });
    mocks.updateDigitalEmployeeAgentWorkspace.mockResolvedValueOnce(undefined);
    mocks.ensureSlugsViaClawHub.mockResolvedValueOnce(['s1']);

    const { handleAgentRoutes } = await import('@electron/api/routes/agents');

    await handleAgentRoutes(
      { method: 'POST' } as IncomingMessage,
      {} as ServerResponse,
      new URL('http://127.0.0.1:13210/api/employees/update'),
      testCtx(),
    );

    expect(mocks.writeDigitalEmployeeSidecar).toHaveBeenCalledWith(
      expandPath(`~/.openclaw/workspace-${linked}`),
      { version: 1, catalogEmployeeId: 'cat-9', skills: ['s1'] },
    );
  });

  it('writes sidecar without skills when skills omitted from body', async () => {
    const linked = 'agent-y';
    mocks.parseJsonBody.mockResolvedValueOnce({
      employeeId: 'e2',
      linkedAgentId: linked,
      nameZh: '名',
      nameEn: 'Name',
      soulContent: 'soul',
      agentsContent: 'agents',
      identityContent: '',
    });
    mocks.updateDigitalEmployeeAgentWorkspace.mockResolvedValueOnce(undefined);

    const { handleAgentRoutes } = await import('@electron/api/routes/agents');

    await handleAgentRoutes(
      { method: 'POST' } as IncomingMessage,
      {} as ServerResponse,
      new URL('http://127.0.0.1:13210/api/employees/update'),
      testCtx(),
    );

    expect(mocks.writeDigitalEmployeeSidecar).toHaveBeenCalledWith(
      expandPath(`~/.openclaw/workspace-${linked}`),
      { version: 1, catalogEmployeeId: 'e2' },
    );
  });
});
