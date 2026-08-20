import { getToken } from './auth';

export type FetchApiOptions = Omit<RequestInit, 'body'> & {
  body?: Record<string, unknown> | FormData | null;
};

function getApiBaseUrl(): string {
  return import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';
}

export async function fetchApi(endpoint: string, options: FetchApiOptions = {}): Promise<Response> {
  const { body, headers: customHeaders, ...rest } = options;
  const headers = new Headers(customHeaders as HeadersInit | undefined);

  if (!(body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const token = getToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const serializedBody =
    body instanceof FormData || body === null || body === undefined
      ? (body as BodyInit | null | undefined)
      : JSON.stringify(body);

  return fetch(`${getApiBaseUrl()}/api${endpoint}`, {
    ...rest,
    credentials: 'include',
    headers,
    ...(serializedBody !== undefined ? { body: serializedBody } : {}),
  });
}

export async function fetchJson<T = unknown>(endpoint: string, options: FetchApiOptions = {}): Promise<T> {
  const res = await fetchApi(endpoint, options);
  const data = await res.json();
  if (!res.ok) {
    throw Object.assign(new Error(data?.message ?? 'Request failed'), { status: res.status, data });
  }
  return data as T;
}
