import { fetchJson } from '@/lib/api';

export interface AdminBranding {
  name: string;
  logoUrl: string;
  faviconUrl: string;
}

export const DEFAULT_ADMIN_BRANDING: AdminBranding = {
  name: 'PetPosture',
  logoUrl: '/logo.png',
  faviconUrl: '/favicon.png',
};

type SettingsResponse = {
  data?: {
    shop_name?: unknown;
    admin_logo?: unknown;
    admin_favicon?: unknown;
  };
};

function present(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

let brandingRequest: Promise<AdminBranding> | null = null;

async function fetchAdminBranding(): Promise<AdminBranding> {
  try {
    const response = await fetchJson<SettingsResponse>('/settings');
    return {
      name: present(response.data?.shop_name) ? response.data.shop_name : DEFAULT_ADMIN_BRANDING.name,
      logoUrl: present(response.data?.admin_logo) ? response.data.admin_logo : DEFAULT_ADMIN_BRANDING.logoUrl,
      faviconUrl: present(response.data?.admin_favicon) ? response.data.admin_favicon : DEFAULT_ADMIN_BRANDING.faviconUrl,
    };
  } catch {
    return DEFAULT_ADMIN_BRANDING;
  }
}

export function loadAdminBranding(): Promise<AdminBranding> {
  brandingRequest ??= fetchAdminBranding();
  return brandingRequest;
}

export function resetAdminBrandingRequestForTests(): void {
  brandingRequest = null;
}
