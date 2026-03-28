import { describe, it, expect } from 'vitest';
import { parseMemberNewApiConfig } from '@electron/services/cloud-platform-provider';

describe('parseMemberNewApiConfig', () => {
  it('accepts code+data wrapper with platformAccessToken', () => {
    const r = parseMemberNewApiConfig({
      code: 0,
      data: { baseUrl: 'https://api.example/v1', platformAccessToken: 'tok' },
    });
    expect(r).toEqual({ baseUrl: 'https://api.example/v1', apiKey: 'tok' });
  });

  it('accepts apiKey in data', () => {
    const r = parseMemberNewApiConfig({
      code: 200,
      data: { baseUrl: 'https://x/', apiKey: 'key123' },
    });
    expect(r).toEqual({ baseUrl: 'https://x/', apiKey: 'key123' });
  });

  it('prefers platformAccessToken over apiKey', () => {
    const r = parseMemberNewApiConfig({
      data: {
        baseUrl: 'https://a/',
        platformAccessToken: 'pt',
        apiKey: 'ak',
      },
    });
    expect(r).toEqual({ baseUrl: 'https://a/', apiKey: 'pt' });
  });

  it('returns null if token missing', () => {
    expect(parseMemberNewApiConfig({ code: 0, data: { baseUrl: 'x' } })).toBeNull();
  });

  it('returns null if baseUrl missing', () => {
    expect(parseMemberNewApiConfig({ code: 0, data: { platformAccessToken: 't' } })).toBeNull();
  });

  it('returns null on non-zero code', () => {
    expect(
      parseMemberNewApiConfig({
        code: 401,
        data: { baseUrl: 'https://a/', platformAccessToken: 't' },
      }),
    ).toBeNull();
  });
});
