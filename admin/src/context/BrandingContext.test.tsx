// @vitest-environment jsdom
import { StrictMode } from 'react';

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import * as brandingModule from '@/lib/branding';
import { BrandingProvider } from './BrandingContext';

const load = vi.spyOn(brandingModule, 'loadAdminBranding');

afterEach(() => {
  document.head.innerHTML = '';
  document.body.innerHTML = '';
  load.mockReset();
});

describe('BrandingProvider', () => {
  it('updates the deterministic favicon link without duplicates in StrictMode', async () => {
    document.head.innerHTML = '<link id="admin-favicon" rel="icon" href="/favicon.png">';
    document.body.innerHTML = '<div id="root"></div>';
    load.mockResolvedValue({ name: 'Custom', logoUrl: '/logo.png', faviconUrl: '/custom-icon.png' });
    const root = createRoot(document.getElementById('root')!);
    await act(async () => {
      root.render(<StrictMode><BrandingProvider><span>ready</span></BrandingProvider></StrictMode>);
      await Promise.resolve();
    });
    expect(document.querySelectorAll('#admin-favicon')).toHaveLength(1);
    expect((document.getElementById('admin-favicon') as HTMLLinkElement).getAttribute('href')).toBe('/custom-icon.png');
    await act(async () => root.unmount());
  });
});
