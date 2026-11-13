import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchApi } from './fetchApi';

type Call = { url: string; options: RequestInit };

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchApi', () => {
  it('bootstraps CSRF for unsafe requests and never attaches localStorage bearer tokens', async () => {
    const calls: Call[] = [];
    const doc = { cookie: '' };
    vi.stubGlobal('window', { location: { hostname: 'localhost' } });
    vi.stubGlobal('document', doc);
    vi.stubGlobal('localStorage', { getItem: () => 'exfiltratable-legacy-token' });
    vi.stubGlobal('fetch', async (url: string | URL, options: RequestInit = {}) => {
      calls.push({ url: String(url), options });
      if (String(url).endsWith('/sanctum/csrf-cookie')) {
        doc.cookie = 'XSRF-TOKEN=csrf-value';
        return new Response(null, { status: 204 });
      }

      return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
    });

    await fetchApi('/api/logout', { method: 'POST' });

    expect(calls).toHaveLength(2);
    expect(calls[0].url).toMatch(/\/sanctum\/csrf-cookie$/);
    expect(calls[0].options.credentials).toBe('include');
    expect(calls[1].options.credentials).toBe('include');
    const headers = new Headers(calls[1].options.headers);
    expect(headers.get('Authorization')).toBeNull();
    expect(headers.get('X-XSRF-TOKEN')).toBe('csrf-value');
  });
});
