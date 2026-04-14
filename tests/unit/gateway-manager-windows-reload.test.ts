import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockTryWindowsGatewayReload, mockLoadGatewayReloadPolicy } = vi.hoisted(() => ({
  mockTryWindowsGatewayReload: vi.fn(),
  mockLoadGatewayReloadPolicy: vi.fn(),
}));

vi.mock('electron', () => ({
  app: {
    getPath: () => '/tmp',
    isPackaged: false,
  },
  utilityProcess: {
    fork: vi.fn(),
  },
}));

vi.mock('@electron/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@electron/gateway/windows-reload', () => ({
  tryWindowsGatewayReload: mockTryWindowsGatewayReload,
}));

vi.mock('@electron/gateway/reload-policy', async () => {
  const actual = await vi.importActual<typeof import('@electron/gateway/reload-policy')>(
    '@electron/gateway/reload-policy',
  );
  return {
    ...actual,
    loadGatewayReloadPolicy: (...args: unknown[]) => mockLoadGatewayReloadPolicy(...args),
  };
});

describe('GatewayManager reload on Windows', () => {
  const originalPlatform = process.platform;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockTryWindowsGatewayReload.mockReset();
    mockLoadGatewayReloadPolicy.mockReset();
    mockLoadGatewayReloadPolicy.mockResolvedValue({ mode: 'hybrid', debounceMs: 1200 });
    Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
  });

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
  });

  it('does not call restart when tryWindowsGatewayReload succeeds', async () => {
    mockTryWindowsGatewayReload.mockResolvedValue({ ok: true, via: 'touch' });

    const { GatewayManager } = await import('@electron/gateway/manager');
    const manager = new GatewayManager();

    const internals = manager as unknown as {
      status: { state: string; port: number; connectedAt?: number };
      startLock: boolean;
      process: { pid: number } | null;
    };

    internals.status = {
      state: 'running',
      port: 18789,
      connectedAt: Date.now() - 10_000,
    };
    internals.startLock = false;
    internals.process = { pid: 4242 };

    const restartSpy = vi.spyOn(manager, 'restart').mockResolvedValue(undefined);

    await manager.reload();

    expect(mockTryWindowsGatewayReload).toHaveBeenCalledTimes(1);
    expect(restartSpy).not.toHaveBeenCalled();
  });

  it('calls restart when tryWindowsGatewayReload fails', async () => {
    mockTryWindowsGatewayReload.mockResolvedValue({ ok: false, reason: 'touch failed' });

    const { GatewayManager } = await import('@electron/gateway/manager');
    const manager = new GatewayManager();

    const internals = manager as unknown as {
      status: { state: string; port: number; connectedAt?: number };
      startLock: boolean;
      process: { pid: number } | null;
    };

    internals.status = {
      state: 'running',
      port: 18789,
      connectedAt: Date.now() - 10_000,
    };
    internals.startLock = false;
    internals.process = { pid: 4242 };

    const restartSpy = vi.spyOn(manager, 'restart').mockResolvedValue(undefined);

    await manager.reload();

    expect(mockTryWindowsGatewayReload).toHaveBeenCalledTimes(1);
    expect(restartSpy).toHaveBeenCalledTimes(1);
  });
});
