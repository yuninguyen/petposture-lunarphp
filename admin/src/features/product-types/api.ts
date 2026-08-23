import { fetchJson } from '@/lib/api';

export interface ProductType {
  id: number;
  name: string;
  products_count: number;
}

type ProductTypesResponse = ProductType[] | { data: ProductType[] };

export async function fetchProductTypes(): Promise<ProductType[]> {
  const response = await fetchJson<ProductTypesResponse>('/admin/product-types');
  return Array.isArray(response) ? response : response.data;
}

export async function createProductType(payload: { name: string }): Promise<ProductType> {
  const response = await fetchJson<ProductType | { data: ProductType }>('/admin/product-types', {
    method: 'POST',
    body: payload,
  });
  return 'data' in response ? response.data : response;
}
