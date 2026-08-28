import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchApi } from './api';

describe('session API client', () => {
  beforeEach(() => {
    document.cookie = 'XSRF-TOKEN=; Max-Age=0; path=/';
    localStorage.setItem('petposture_admin_token', 'legacy-bearer-token');
    vi.restoreAllMocks();
  });

  it('bootstraps CSRF and never sends a localStorage bearer token', async () => {
    const request = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith('/sanctum/csrf-cookie')) {
        document.cookie = 'XSRF-TOKEN=admin-csrf; path=/';
        return new Response(null, { status: 204 });
      }

      return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
    });

    await fetchApi('/logout', { method: 'POST' });

    expect(request).toHaveBeenCalledTimes(2);
    expect(String(request.mock.calls[0][0])).toMatch(/\/sanctum\/csrf-cookie$/);
    const options = request.mock.calls[1][1] as RequestInit;
    expect(options.credentials).toBe('include');
    const headers = new Headers(options.headers);
    expect(headers.get('Authorization')).toBeNull();
    expect(headers.get('X-XSRF-TOKEN')).toBe('admin-csrf');
  });
});
