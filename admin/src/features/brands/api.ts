import { fetchJson } from '@/lib/api';

export interface Brand {
  id: number;
  name: string;
  products_count: number;
}

export interface BrandPayload {
  name: string;
}

type BrandResponse = Brand | { data: Brand };
type BrandsResponse = Brand[] | { data: Brand[] };

export function normalizeBrandsResponse(response: BrandsResponse): Brand[] {
  return Array.isArray(response) ? response : response.data;
}

export function normalizeBrandResponse(response: BrandResponse): Brand {
  return 'data' in response ? response.data : response;
}

export async function fetchBrands(): Promise<Brand[]> {
  return normalizeBrandsResponse(await fetchJson<BrandsResponse>('/admin/brands'));
}

export async function createBrand(payload: BrandPayload): Promise<Brand> {
  return normalizeBrandResponse(await fetchJson<BrandResponse>('/admin/brands', {
    method: 'POST',
    body: { ...payload },
  }));
}

export async function updateBrand(id: number, payload: BrandPayload): Promise<Brand> {
  return normalizeBrandResponse(await fetchJson<BrandResponse>(`/admin/brands/${id}`, {
    method: 'PUT',
    body: { ...payload },
  }));
}

export async function deleteBrand(id: number): Promise<void> {
  await fetchJson(`/admin/brands/${id}`, { method: 'DELETE' });
}
