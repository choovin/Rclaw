import { describe, it, expect } from 'vitest';
import {
  ensureOpenAiCompatibleBaseUrlV1,
  memberNewApiConfigMatchesStoredAccount,
  parseMemberNewApiConfig,
} from '@electron/services/cloud-platform-provider';

describe('ensureOpenAiCompatibleBaseUrlV1', () => {
  it('appends /v1 when missing', () => {
    expect(ensureOpenAiCompatibleBaseUrlV1('https://api.example.com')).toBe('https://api.example.com/v1');
    expect(ensureOpenAiCompatibleBaseUrlV1('https://api.example.com/')).toBe('https://api.example.com/v1');
  });

  it('does not duplicate /v1', () => {
    expect(ensureOpenAiCompatibleBaseUrlV1('https://api.example.com/v1')).toBe('https://api.example.com/v1');
    expect(ensureOpenAiCompatibleBaseUrlV1('https://api.example.com/v1/')).toBe('https://api.example.com/v1');
  });

  it('is case-insensitive for v1 suffix', () => {
    expect(ensureOpenAiCompatibleBaseUrlV1('https://x/V1')).toBe('https://x/V1');
  });
});

describe('parseMemberNewApiConfig', () => {
  it('accepts code+data wrapper with apiKey', () => {
    const r = parseMemberNewApiConfig({
      code: 0,
      data: { baseUrl: 'https://api.example/v1', apiKey: 'tok' },
    });
    expect(r).toEqual({ baseUrl: 'https://api.example/v1', apiKey: 'tok' });
  });

  it('falls back to platformAccessToken when apiKey absent', () => {
    const r = parseMemberNewApiConfig({
      code: 0,
      data: { baseUrl: 'https://api.example/v1', platformAccessToken: 'legacy' },
    });
    expect(r).toEqual({ baseUrl: 'https://api.example/v1', apiKey: 'legacy' });
  });

  it('normalizes trailing slash and adds /v1 when missing', () => {
    const r = parseMemberNewApiConfig({
      code: 200,
      data: { baseUrl: 'https://x/', apiKey: 'key123' },
    });
    expect(r).toEqual({ baseUrl: 'https://x/v1', apiKey: 'key123' });
  });

  it('prefers apiKey over platformAccessToken when both present', () => {
    const r = parseMemberNewApiConfig({
      data: {
        baseUrl: 'https://a/',
        platformAccessToken: 'pt',
        apiKey: 'ak',
      },
    });
    expect(r).toEqual({ baseUrl: 'https://a/v1', apiKey: 'ak' });
  });

  it('uses apiUrl when baseUrl empty', () => {
    const r = parseMemberNewApiConfig({
      code: 0,
      data: { apiUrl: 'https://gw.test', apiKey: 't' },
    });
    expect(r).toEqual({ baseUrl: 'https://gw.test/v1', apiKey: 't' });
  });

  it('prefers baseUrl over apiUrl', () => {
    const r = parseMemberNewApiConfig({
      data: {
        baseUrl: 'https://primary',
        apiUrl: 'https://ignored',
        apiKey: 't',
      },
    });
    expect(r).toEqual({ baseUrl: 'https://primary/v1', apiKey: 't' });
  });

  it('returns null if token missing', () => {
    expect(parseMemberNewApiConfig({ code: 0, data: { baseUrl: 'x' } })).toBeNull();
  });

  it('returns null if baseUrl missing', () => {
    expect(parseMemberNewApiConfig({ code: 0, data: { apiKey: 't' } })).toBeNull();
  });

  it('returns null on non-zero code', () => {
    expect(
      parseMemberNewApiConfig({
        code: 401,
        data: { baseUrl: 'https://a/', apiKey: 't' },
      }),
    ).toBeNull();
  });
});

describe('memberNewApiConfigMatchesStoredAccount', () => {
  const parsed = { baseUrl: 'https://gw.example/v1', apiKey: 'secret' };

  it('returns true when baseUrl (normalized) and apiKey match stored', () => {
    expect(
      memberNewApiConfigMatchesStoredAccount({
        existingBaseUrl: 'https://gw.example',
        storedApiKey: 'secret',
        parsed,
      }),
    ).toBe(true);
  });

  it('returns false when token differs', () => {
    expect(
      memberNewApiConfigMatchesStoredAccount({
        existingBaseUrl: 'https://gw.example/v1',
        storedApiKey: 'other',
        parsed,
      }),
    ).toBe(false);
  });

  it('returns false when baseUrl differs', () => {
    expect(
      memberNewApiConfigMatchesStoredAccount({
        existingBaseUrl: 'https://other/v1',
        storedApiKey: 'secret',
        parsed,
      }),
    ).toBe(false);
  });

  it('returns false when stored key missing', () => {
    expect(
      memberNewApiConfigMatchesStoredAccount({
        existingBaseUrl: 'https://gw.example/v1',
        storedApiKey: null,
        parsed,
      }),
    ).toBe(false);
  });
});
