import { fetchJson } from '@/lib/api';

export interface CollectionGroup {
  id: number;
  name: string;
  handle: string;
  collections_count: number;
}

export interface CollectionGroupPayload {
  name: string;
  handle: string;
}

type CollectionGroupResponse = CollectionGroup | { data: CollectionGroup };
type CollectionGroupsResponse = CollectionGroup[] | { data: CollectionGroup[] };

export function normalizeCollectionGroupsResponse(response: CollectionGroupsResponse): CollectionGroup[] {
  return Array.isArray(response) ? response : response.data;
}

export function normalizeCollectionGroupResponse(response: CollectionGroupResponse): CollectionGroup {
  return 'data' in response ? response.data : response;
}

export async function fetchCollectionGroups(): Promise<CollectionGroup[]> {
  return normalizeCollectionGroupsResponse(
    await fetchJson<CollectionGroupsResponse>('/admin/collection-groups'),
  );
}

export async function createCollectionGroup(payload: CollectionGroupPayload): Promise<CollectionGroup> {
  return normalizeCollectionGroupResponse(
    await fetchJson<CollectionGroupResponse>('/admin/collection-groups', {
      method: 'POST',
      body: { ...payload },
    }),
  );
}

export async function updateCollectionGroup(
  id: number,
  payload: CollectionGroupPayload,
): Promise<CollectionGroup> {
  return normalizeCollectionGroupResponse(
    await fetchJson<CollectionGroupResponse>(`/admin/collection-groups/${id}`, {
      method: 'PUT',
      body: { ...payload },
    }),
  );
}

export async function deleteCollectionGroup(id: number): Promise<void> {
  await fetchJson(`/admin/collection-groups/${id}`, { method: 'DELETE' });
}
