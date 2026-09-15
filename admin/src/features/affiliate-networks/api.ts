import { fetchJson } from '@/lib/api';

export interface AffiliateNetworkItem {
  id: number;
  name: string;
  slug: string;
  logo: string | null;
  active: boolean;
  provider: string | null;
  merchant_id: string | null;
  commission_rate_default: number | null;
  cookie_days: number | null;
  is_configured: boolean;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateAffiliateNetworkPayload {
  name: string;
  slug?: string;
  logo?: string | null;
  active?: boolean;
  provider?: string | null;
  merchant_id?: string | null;
  commission_rate_default?: number | null;
  cookie_days?: number | null;
  api_key?: string | null;
  api_secret?: string | null;
}

export interface UpdateAffiliateNetworkPayload {
  name?: string;
  slug?: string;
  logo?: string | null;
  active?: boolean;
  provider?: string | null;
  merchant_id?: string | null;
  commission_rate_default?: number | null;
  cookie_days?: number | null;
  api_key?: string | null;
  api_secret?: string | null;
}

export async function fetchAffiliateNetworks(): Promise<{ data: AffiliateNetworkItem[] }> {
  return fetchJson<{ data: AffiliateNetworkItem[] }>('/admin/affiliate/networks');
}

export async function createAffiliateNetwork(
  payload: CreateAffiliateNetworkPayload
): Promise<{ data: AffiliateNetworkItem }> {
  return fetchJson<{ data: AffiliateNetworkItem }>('/admin/affiliate/networks', {
    method: 'POST',
    body: { ...payload },
  });
}

export async function updateAffiliateNetwork(
  id: number,
  payload: UpdateAffiliateNetworkPayload
): Promise<{ data: AffiliateNetworkItem }> {
  return fetchJson<{ data: AffiliateNetworkItem }>(`/admin/affiliate/networks/${id}`, {
    method: 'PUT',
    body: { ...payload },
  });
}

export async function deleteAffiliateNetwork(id: number): Promise<{ message: string }> {
  return fetchJson<{ message: string }>(`/admin/affiliate/networks/${id}`, {
    method: 'DELETE',
  });
}

export async function syncAffiliateNetwork(id: number): Promise<{ message: string }> {
  return fetchJson<{ message: string }>(`/admin/affiliate/networks/${id}/sync`, {
    method: 'POST',
  });
}
