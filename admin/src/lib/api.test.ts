import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchApi } from './api';

describe('session API client', () => {
  beforeEach(() => {
    document.cookie = 'XSRF-TOKEN=; Max-Age=0; path=/';
    localStorage.setItem('petposture_admin_token', 'legacy-bearer-token');
    vi.restoreAllMocks();
  });

  it('emits one cache warning event for a successful response with the purge-pending header', async () => {
    const eventListener = vi.fn();
    window.addEventListener('petposture:cache-warning', eventListener);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'X-PetPosture-Cache-Warning': 'purge-pending',
      },
    }));

    await fetchApi('/pages');

    expect(eventListener).toHaveBeenCalledTimes(1);
    expect(eventListener.mock.calls[0][0].type).toBe('petposture:cache-warning');
    window.removeEventListener('petposture:cache-warning', eventListener);
  });

  it('does not emit a cache warning event for an ordinary response', async () => {
    const eventListener = vi.fn();
    window.addEventListener('petposture:cache-warning', eventListener);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }));

    await fetchApi('/pages');

    expect(eventListener).not.toHaveBeenCalled();
    window.removeEventListener('petposture:cache-warning', eventListener);
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
