import { fetchJson } from '@/lib/api';

export interface MediaLibraryItem {
  id: number;
  source: 'curator' | 'spatie';
  url: string;
  thumbnail_url: string;
  name: string;
  folder: string | null;
  collection_name: string | null;
  model_type: string | null;
  size: number;
  created_at: string;
}

export interface MediaLibraryMeta {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

export interface MediaLibraryResponse {
  data: MediaLibraryItem[];
  meta: MediaLibraryMeta;
}

export async function fetchMediaLibrary(params: {
  source?: string;
  page?: number;
  per_page?: number;
}): Promise<MediaLibraryResponse> {
  const query = new URLSearchParams();
  if (params.source) query.set('source', params.source);
  if (params.page) query.set('page', String(params.page));
  if (params.per_page) query.set('per_page', String(params.per_page));

  const qs = query.toString();
  return fetchJson<MediaLibraryResponse>(`/admin/system/media${qs ? `?${qs}` : ''}`);
}

export async function deleteMediaLibraryItem(source: string, id: number): Promise<void> {
  await fetchJson(`/admin/system/media/${source}/${id}`, { method: 'DELETE' });
}
