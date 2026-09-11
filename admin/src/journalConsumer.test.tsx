// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import toast from 'react-hot-toast';
import { CacheWarningListener } from './App';
import { fetchApi } from './lib/api';
vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { error: vi.fn() }), Toaster: () => null }));
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('journal consumer contract', () => {
  it.each(['unavailable', 'unknown', null])('allowlists recovery header %s without exposing raw response details', async (header) => {
    const listener = vi.fn();
    window.addEventListener('petposture:cache-warning', listener);
    const headers = new Headers({ 'X-PetPosture-Cache-Warning': 'purge-pending' });
    if (header) headers.set('X-PetPosture-Cache-Recovery', header);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('secret body', { headers }));
    await fetchApi('/pages');
    expect(listener.mock.calls[0][0].detail).toEqual({ recovery: header === 'unavailable' ? 'unavailable' : 'pending' });
    window.removeEventListener('petposture:cache-warning', listener);
    vi.restoreAllMocks();
  });

  it.each([undefined, { recovery: 'pending' }, { recovery: 'unknown' }, { recovery: 'unavailable' }])('renders truthful warning for %j', async (detail) => {
    vi.mocked(toast).mockClear();
    const host = document.createElement('div'); document.body.append(host);
    const root = createRoot(host);
    await act(async () => root.render(<CacheWarningListener />));
    window.dispatchEvent(new CustomEvent('petposture:cache-warning', { detail }));
    expect(toast).toHaveBeenCalledWith(detail?.recovery === 'unavailable'
      ? 'Content saved; cache refresh recovery could not be recorded. Automatic retry is not guaranteed; operator action is required.'
      : 'Content was saved, but the storefront cache update is unconfirmed. Public pages may remain stale.', expect.any(Object));
    await act(async () => root.unmount()); host.remove();
  });
});
