import { describe, expect, it, vi } from 'vitest';
import { tryWindowsGatewayReload } from '@electron/gateway/windows-reload';

describe('tryWindowsGatewayReload', () => {
  it('returns ok via touch when touch succeeds and best-effort secrets.reload succeeds', async () => {
    const touch = vi.fn().mockResolvedValue(undefined);
    const rpc = vi.fn().mockResolvedValue(undefined);
    const result = await tryWindowsGatewayReload({
      rpc,
      configPath: 'C:\\tmp\\openclaw.json',
      touchConfigFile: touch,
    });
    expect(result).toEqual({ ok: true, via: 'touch' });
    expect(touch).toHaveBeenCalledWith('C:\\tmp\\openclaw.json');
    expect(rpc).toHaveBeenCalledWith('secrets.reload', undefined, 15_000);
  });

  it('returns ok via touch when touch succeeds even if secrets.reload fails', async () => {
    const touch = vi.fn().mockResolvedValue(undefined);
    const rpc = vi.fn().mockRejectedValue(new Error('rpc failed'));
    const result = await tryWindowsGatewayReload({
      rpc,
      configPath: 'C:\\tmp\\openclaw.json',
      touchConfigFile: touch,
    });
    expect(result).toEqual({ ok: true, via: 'touch' });
    expect(rpc).toHaveBeenCalled();
  });

  it('returns ok: false when touch throws', async () => {
    const touch = vi.fn().mockRejectedValue(new Error('ENOENT'));
    const rpc = vi.fn();
    const result = await tryWindowsGatewayReload({
      rpc,
      configPath: '/x/y.json',
      touchConfigFile: touch,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain('ENOENT');
    }
    expect(rpc).not.toHaveBeenCalled();
  });
});
