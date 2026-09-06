// @vitest-environment jsdom
import { act, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import toast from 'react-hot-toast';

import { CacheWarningListener } from './App';

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('react-hot-toast', () => ({
  default: Object.assign(vi.fn(), { error: vi.fn() }),
  Toaster: () => null,
}));

afterEach(() => {
  document.body.innerHTML = '';
  vi.clearAllMocks();
});

describe('CacheWarningListener', () => {
  it('shows one non-blocking warning toast for one cache warning event', async () => {
    document.body.innerHTML = '<div id="root"></div>';
    const root = createRoot(document.getElementById('root')!);
    await act(async () => root.render(<StrictMode><CacheWarningListener /></StrictMode>));

    window.dispatchEvent(new CustomEvent('petposture:cache-warning'));

    expect(toast).toHaveBeenCalledTimes(1);
    expect(toast).toHaveBeenCalledWith(
      'Content was saved, but the storefront cache purge is still retrying. Public pages may remain stale for up to 5 minutes.',
      expect.objectContaining({ duration: expect.any(Number) }),
    );
    await act(async () => root.unmount());
  });
});
