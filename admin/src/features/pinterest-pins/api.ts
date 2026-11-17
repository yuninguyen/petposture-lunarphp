import { fetchApi, fetchJson } from '@/lib/api';
import type { PinDisplayStatus, PinStatus } from './pinSchema';

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
  /** Id of the board on the connected Pinterest account, when one was chosen from the list. */
  pinterest_board_id: string | null;
  status: PinDisplayStatus;
  scheduled_date: string | null;
  posted_at: string | null;
  /** 'api' when the posting job posted it, 'manual' when a person did; null until posted. */
  posted_via: 'api' | 'manual' | null;
  pinterest_pin_id: string | null;
  publish_attempts: number;
  /** Why the last automatic attempt did not post the pin. */
  last_error: string | null;
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
  status: '' | PinDisplayStatus;
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
  pinterest_board_id: string | null;
  /** Left out when the pin is being held by the posting job and only its content is edited. */
  status?: PinStatus;
  scheduled_date: string | null;
};

export interface PinterestPublishSettings {
  auto_publish: boolean;
  max_per_day: number;
  min_gap_minutes: number;
  window_start: string;
  window_end: string;
  timezone: string;
}

export interface PinterestLogEntry {
  id: number;
  pinterest_pin_id: number | null;
  action: string;
  endpoint: string;
  http_status: number | null;
  error_code: string | null;
  message: string | null;
  created_at: string | null;
}

/** The Pinterest app's details. The secret is write-only: only whether one is set comes back. */
export interface PinterestCredentials {
  app_id: string | null;
  redirect_uri: string | null;
  sandbox: boolean;
  has_secret: boolean;
}

// A type alias, not an interface: fetchJson takes a plain record as the body, which an interface is not assignable to.
export type PinterestCredentialsInput = {
  app_id: string;
  /** Left blank to keep the saved secret. */
  app_secret: string;
  redirect_uri: string;
  sandbox: boolean;
};

export interface PinterestConnection {
  /** False until the app id, secret and redirect address are saved (in the admin or in the server's .env). */
  configured: boolean;
  credentials: PinterestCredentials;
  connected: boolean;
  /** 'disconnected' means it was connected and the login was lost. */
  status: 'connected' | 'disconnected' | 'not_connected';
  username: string | null;
  last_error: string | null;
  refresh_expires_at: string | null;
  settings: PinterestPublishSettings;
  recent_errors: PinterestLogEntry[];
}

export interface PinterestBoard {
  id: string;
  name: string;
}

export const pinterestConnectionKey = ['pinterest-connection'] as const;
export const pinterestBoardsKey = ['pinterest-connection', 'boards'] as const;

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

/** Puts a pin back to ready so the posting job tries it again (after a failure, or once a person checked it). */
export async function retryPin(id: number): Promise<PinterestPin> {
  return updatePin(id, { status: 'ready' });
}

export async function fetchPinterestConnection(): Promise<PinterestConnection> {
  return (await fetchJson<{ data: PinterestConnection }>('/admin/pinterest/connection')).data;
}

/** The Pinterest page the owner must visit to allow the connection. */
export async function startPinterestConnect(): Promise<string> {
  return (await fetchJson<{ data: { url: string } }>('/admin/pinterest/connect', { method: 'POST' })).data.url;
}

/** Hands the code Pinterest sent back to the server, which finishes the connection. */
export async function completePinterestCallback(code: string, state: string): Promise<{ username: string | null }> {
  return (await fetchJson<{ data: { username: string | null } }>('/admin/pinterest/callback', { method: 'POST', body: { code, state } })).data;
}

export async function disconnectPinterest(): Promise<void> {
  await fetchJson('/admin/pinterest/connection', { method: 'DELETE' });
}

export async function fetchPinterestBoards(): Promise<PinterestBoard[]> {
  return (await fetchJson<{ data: PinterestBoard[] }>('/admin/pinterest/boards')).data;
}

/** Makes a new board on the connected Pinterest account. Needs the boards:write permission, given when connecting. */
export async function createPinterestBoard(name: string): Promise<PinterestBoard> {
  return (await fetchJson<{ data: PinterestBoard }>('/admin/pinterest/boards', { method: 'POST', body: { name } })).data;
}

/**
 * Takes a pin posted through the API off Pinterest. The pin stays in the admin as a draft with no date, so it is not
 * posted again until it is scheduled again.
 */
export async function deletePinOnPinterest(id: number): Promise<void> {
  await fetchJson(`/admin/pinterest/pins/${id}`, { method: 'DELETE' });
}

/**
 * Posts a ready pin to Pinterest straight away, ignoring its date and the daily limit. Rejects with the reason when
 * Pinterest would not take it (the list then shows the pin's new state).
 */
export async function publishPinNow(id: number): Promise<void> {
  await fetchJson(`/admin/pinterest/pins/${id}/publish`, { method: 'POST' });
}

/** Deletes a board on Pinterest, and every pin on it there. */
export async function deletePinterestBoard(id: string): Promise<void> {
  await fetchJson(`/admin/pinterest/boards/${id}`, { method: 'DELETE' });
}

export async function updatePinterestCredentials(values: PinterestCredentialsInput): Promise<PinterestCredentials> {
  return (await fetchJson<{ data: PinterestCredentials }>('/admin/pinterest/credentials', { method: 'PUT', body: values })).data;
}

export async function updatePinterestSettings(settings: Partial<PinterestPublishSettings>): Promise<PinterestPublishSettings> {
  return (await fetchJson<{ data: PinterestPublishSettings }>('/admin/pinterest/settings', { method: 'PUT', body: settings })).data;
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
