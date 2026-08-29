import { fetchJson } from '@/lib/api';

export interface LocalizedName {
  en: string;
  vi: string;
}

export interface CollectionNode {
  id: number;
  collection_group_id: number;
  parent_id: number | null;
  name: LocalizedName;
  slug: string;
  children_count: number;
  children: CollectionNode[];
}

export interface CollectionGroupTree {
  id: number;
  name: string;
  handle: string;
  collections: CollectionNode[];
}

export interface MoveCollectionPayload {
  collection_group_id: number;
  parent_id: number | null;
}

export interface ReorderCollectionPayload {
  sibling_id: number;
  position: 'before' | 'after';
}

export interface CollectionProduct {
  id: number;
  name: string;
  slug: string | null;
  position: number;
}

export interface CollectionProductsPayload {
  product_ids: number[];
}

type CollectionTreesResponse = CollectionGroupTree[] | { data: CollectionGroupTree[] };
type CollectionResponse = CollectionNode | { data: CollectionNode };

export function normalizeCollectionTreesResponse(response: CollectionTreesResponse): CollectionGroupTree[] {
  return Array.isArray(response) ? response : response.data;
}

export function normalizeCollectionResponse(response: CollectionResponse): CollectionNode {
  return 'data' in response ? response.data : response;
}

export async function fetchCollectionTrees(): Promise<CollectionGroupTree[]> {
  return normalizeCollectionTreesResponse(
    await fetchJson<CollectionTreesResponse>('/admin/collections'),
  );
}

export async function createCollection(payload: FormData): Promise<CollectionNode> {
  return normalizeCollectionResponse(
    await fetchJson<CollectionResponse>('/admin/collections', { method: 'POST', body: payload }),
  );
}

export async function updateCollection(id: number, payload: FormData): Promise<CollectionNode> {
  if (!payload.has('_method')) payload.append('_method', 'PUT');
  return normalizeCollectionResponse(
    await fetchJson<CollectionResponse>(`/admin/collections/${id}`, { method: 'POST', body: payload }),
  );
}

export async function deleteCollection(id: number): Promise<void> {
  await fetchJson(`/admin/collections/${id}`, { method: 'DELETE' });
}

export async function moveCollection(id: number, payload: MoveCollectionPayload): Promise<CollectionNode> {
  return normalizeCollectionResponse(
    await fetchJson<CollectionResponse>(`/admin/collections/${id}/move`, {
      method: 'POST',
      body: { ...payload },
    }),
  );
}

export async function reorderCollection(id: number, payload: ReorderCollectionPayload): Promise<CollectionNode> {
  return normalizeCollectionResponse(
    await fetchJson<CollectionResponse>(`/admin/collections/${id}/reorder`, {
      method: 'POST',
      body: { ...payload },
    }),
  );
}

export async function fetchCollectionProducts(id: number): Promise<CollectionProduct[]> {
  const response = await fetchJson<CollectionProduct[] | { data: CollectionProduct[] }>(`/admin/collections/${id}/products`);
  return Array.isArray(response) ? response : response.data;
}

export async function syncCollectionProducts(id: number, payload: CollectionProductsPayload): Promise<CollectionProduct[]> {
  const response = await fetchJson<CollectionProduct[] | { data: CollectionProduct[] }>(`/admin/collections/${id}/products`, {
    method: 'PUT',
    body: { ...payload },
  });
  return Array.isArray(response) ? response : response.data;
}
