import { fetchJson } from '@/lib/api';
import type { ProductType } from '@/features/product-types/api';

export type CustomFieldTarget = 'product' | 'variant';

export interface CustomField {
  id: number;
  name: Record<string, string>;
  display_name: string;
  handle: string;
  target: CustomFieldTarget;
  field_type: 'text';
  required: boolean;
  product_type_ids: number[];
  product_types: Array<Pick<ProductType, 'id' | 'name'>>;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface CreateCustomFieldPayload {
  name: { en: string; vi?: string };
  handle?: string;
  target: CustomFieldTarget;
  field_type: 'text';
  required: boolean;
  product_type_ids: number[];
}

export interface UpdateCustomFieldPayload {
  name: { en?: string; vi?: string };
  required: boolean;
  product_type_ids: number[];
}

type CustomFieldResponse = CustomField | { data: CustomField };
type CustomFieldsResponse = CustomField[] | { data: CustomField[] };

export function normalizeCustomFieldResponse(response: CustomFieldResponse): CustomField {
  return 'data' in response ? response.data : response;
}

export function normalizeCustomFieldsResponse(response: CustomFieldsResponse): CustomField[] {
  return Array.isArray(response) ? response : response.data;
}

export async function fetchCustomFields(): Promise<CustomField[]> {
  const response = await fetchJson<CustomFieldsResponse>('/admin/custom-fields');
  return normalizeCustomFieldsResponse(response);
}

export async function createCustomField(payload: CreateCustomFieldPayload): Promise<CustomField> {
  const response = await fetchJson<CustomFieldResponse>('/admin/custom-fields', {
    method: 'POST',
    body: { ...payload },
  });
  return normalizeCustomFieldResponse(response);
}

export async function updateCustomField(id: number, payload: UpdateCustomFieldPayload): Promise<CustomField> {
  const response = await fetchJson<CustomFieldResponse>(`/admin/custom-fields/${id}`, {
    method: 'PUT',
    body: { ...payload },
  });
  return normalizeCustomFieldResponse(response);
}

export async function deleteCustomField(id: number): Promise<void> {
  await fetchJson(`/admin/custom-fields/${id}`, { method: 'DELETE' });
}
