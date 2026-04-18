import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IncomingMessage, ServerResponse } from 'http';

const mocks = vi.hoisted(() => ({
  listAgentsSnapshot: vi.fn(),
  collectDigitalEmployeesForHydrate: vi.fn(),
  sendJson: vi.fn(),
}));

vi.mock('@electron/utils/agent-skill-allowlist', () => ({
  applyAgentSkillAllowlist: vi.fn(),
  ensureSlugsViaClawHub: vi.fn(),
  normalizeProvisionSkillSlugs: vi.fn(),
}));

vi.mock('@electron/utils/agent-config', () => ({
  assignChannelToAgent: vi.fn(),
  createAgent: vi.fn(),
  clearChannelBinding: vi.fn(),
  deleteAgentConfig: vi.fn(),
  listAgentsSnapshot: (...args: unknown[]) => mocks.listAgentsSnapshot(...args),
  listConfiguredAgentIds: vi.fn(),
  provisionDigitalEmployeeAgent: vi.fn(),
  removeAgentWorkspaceDirectory: vi.fn(),
  resolveAccountIdForAgent: vi.fn(),
  updateAgentModel: vi.fn(),
  updateAgentName: vi.fn(),
  updateDigitalEmployeeAgentWorkspace: vi.fn(),
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
  collectDigitalEmployeesForHydrate: (...args: unknown[]) => mocks.collectDigitalEmployeesForHydrate(...args),
  findAgentIdForCatalogEmployeeId: vi.fn(),
  writeDigitalEmployeeSidecar: vi.fn(),
}));

vi.mock('@electron/api/route-utils', () => ({
  parseJsonBody: vi.fn(),
  sendJson: (...args: unknown[]) => mocks.sendJson(...args),
}));

describe('GET /api/employees/hydrate', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns 200 with employees from collectDigitalEmployeesForHydrate', async () => {
    const snapshot = { agents: [], channelAccountOwners: {} };
    mocks.listAgentsSnapshot.mockResolvedValueOnce(snapshot);
    const employees = [{ linkedAgentId: 'a1', id: 'local-openclaw:a1', skipCatalogDetailFetch: true } as never];
    mocks.collectDigitalEmployeesForHydrate.mockResolvedValueOnce(employees);

    const { handleAgentRoutes } = await import('@electron/api/routes/agents');

    const handled = await handleAgentRoutes(
      { method: 'GET' } as IncomingMessage,
      {} as ServerResponse,
      new URL('http://127.0.0.1:13210/api/employees/hydrate'),
      {} as never,
    );

    expect(handled).toBe(true);
    expect(mocks.listAgentsSnapshot).toHaveBeenCalledTimes(1);
    expect(mocks.collectDigitalEmployeesForHydrate).toHaveBeenCalledWith(snapshot);
    expect(mocks.sendJson).toHaveBeenCalledWith(expect.anything(), 200, {
      success: true,
      employees,
    });
  });

  it('returns 500 when listAgentsSnapshot throws', async () => {
    mocks.listAgentsSnapshot.mockRejectedValueOnce(new Error('snap fail'));

    const { handleAgentRoutes } = await import('@electron/api/routes/agents');

    const handled = await handleAgentRoutes(
      { method: 'GET' } as IncomingMessage,
      {} as ServerResponse,
      new URL('http://127.0.0.1:13210/api/employees/hydrate'),
      {} as never,
    );

    expect(handled).toBe(true);
    expect(mocks.collectDigitalEmployeesForHydrate).not.toHaveBeenCalled();
    expect(mocks.sendJson).toHaveBeenCalledWith(expect.anything(), 500, {
      success: false,
      error: 'Error: snap fail',
    });
  });
});
