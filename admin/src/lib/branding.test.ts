import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_ADMIN_BRANDING, loadAdminBranding, resetAdminBrandingRequestForTests } from './branding';
import * as api from './api';

const fetchJson = vi.spyOn(api, 'fetchJson');

afterEach(() => {
  fetchJson.mockReset();
  resetAdminBrandingRequestForTests();
});

describe('loadAdminBranding', () => {
  it('uses admin branding fields from settings', async () => {
    fetchJson.mockResolvedValue({ data: { shop_name: 'Custom', admin_logo: '/admin-logo.png', admin_favicon: '/admin-favicon.png' } });
    await expect(loadAdminBranding()).resolves.toEqual({ name: 'Custom', logoUrl: '/admin-logo.png', faviconUrl: '/admin-favicon.png' });
    expect(fetchJson).toHaveBeenCalledWith('/settings');
  });

  it('keeps static fallbacks for missing fields', async () => {
    fetchJson.mockResolvedValue({ data: { admin_logo: '  ' } });
    await expect(loadAdminBranding()).resolves.toEqual(DEFAULT_ADMIN_BRANDING);
  });

  it('treats malformed branding values as missing', async () => {
    fetchJson.mockResolvedValue({ data: { shop_name: 7, admin_logo: {}, admin_favicon: false } });
    await expect(loadAdminBranding()).resolves.toEqual(DEFAULT_ADMIN_BRANDING);
  });

  it('deduplicates concurrent loads', async () => {
    fetchJson.mockResolvedValue({ data: {} });
    await Promise.all([loadAdminBranding(), loadAdminBranding()]);
    expect(fetchJson).toHaveBeenCalledTimes(1);
  });

  it('keeps fallbacks when the API fails', async () => {
    fetchJson.mockRejectedValue(new Error('offline'));
    await expect(loadAdminBranding()).resolves.toEqual(DEFAULT_ADMIN_BRANDING);
  });
});
