import { fetchApi, fetchJson } from '@/lib/api';
import type { PinStatus } from './pinSchema';

export interface PinterestPin {
  id: number;
  post_id: number | null;
  post: { id: number; title: string; slug: string } | null;
  /** Id of the media library entry; null once that entry has been deleted. */
  media_id: string | null;
  image: string;
  image_url: string;
  image_width: number | null;
  image_height: number | null;
  title: string;
  description: string;
  destination_url: string;
  board: string | null;
  status: PinStatus;
  scheduled_date: string | null;
  posted_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface PinListMeta {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

export interface PinterestPinsResponse {
  data: PinterestPin[];
  meta: PinListMeta;
}

export interface PinFilters {
  status: '' | PinStatus;
  postId: '' | number;
  page: number;
}

export interface PinOptions {
  boards: string[];
  posts: { id: number; title: string; slug: string; url: string }[];
}

// A type alias, not an interface: fetchJson takes a plain record as the body, which an interface is not assignable to.
export type PinPayload = {
  media_id: number;
  post_id: number | null;
  title: string;
  description: string;
  destination_url: string;
  board: string | null;
  status: PinStatus;
  scheduled_date: string | null;
};

export const pinterestPinsKey = ['pinterest-pins'] as const;
export const pinterestPinOptionsKey = ['pinterest-pins', 'options'] as const;

export async function fetchPins(filters: PinFilters): Promise<PinterestPinsResponse> {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.postId !== '') params.set('post_id', String(filters.postId));
  params.set('page', String(filters.page));

  return fetchJson<PinterestPinsResponse>(`/admin/pinterest-pins?${params.toString()}`);
}

export async function fetchPinOptions(): Promise<PinOptions> {
  return (await fetchJson<{ data: PinOptions }>('/admin/pinterest-pins/options')).data;
}

export async function createPin(payload: PinPayload): Promise<PinterestPin> {
  return (await fetchJson<{ data: PinterestPin }>('/admin/pinterest-pins', { method: 'POST', body: payload })).data;
}

export async function updatePin(id: number, payload: Partial<PinPayload>): Promise<PinterestPin> {
  return (await fetchJson<{ data: PinterestPin }>(`/admin/pinterest-pins/${id}`, { method: 'PUT', body: payload })).data;
}

export async function deletePin(id: number): Promise<void> {
  await fetchJson(`/admin/pinterest-pins/${id}`, { method: 'DELETE' });
}

/** Sends only the status: the server stamps `posted_at` with the time of this call and changes nothing else. */
export async function markPinPosted(id: number): Promise<PinterestPin> {
  return updatePin(id, { status: 'posted' });
}

/** A file name from the pin title, with the extension of its image: "does-your-frenchie-eat-too-fast.png". */
export function pinFilename(pin: Pick<PinterestPin, 'title' | 'image'>): string {
  const slug = pin.title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const extension = /\.([a-z0-9]+)$/i.exec(pin.image)?.[1]?.toLowerCase();

  return `${slug || 'pinterest-pin'}${extension ? `.${extension}` : ''}`;
}

/**
 * Saves the pin image as a file. The download needs the admin session, so it is fetched with it and handed to the
 * browser as a blob; a plain link could not carry the session across to the API address.
 */
export async function downloadPinImage(pin: Pick<PinterestPin, 'id' | 'title' | 'image'>): Promise<void> {
  const response = await fetchApi(`/admin/pinterest-pins/${pin.id}/download`);

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.message ?? 'The image could not be downloaded.');
  }

  const serverName = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(response.headers.get('Content-Disposition') ?? '')?.[1];
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');

  link.href = url;
  link.download = serverName ? decodeURIComponent(serverName) : pinFilename(pin);
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
