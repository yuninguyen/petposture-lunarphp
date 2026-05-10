/**
 * Centralized API fetch helper.
 *
 * Handles:
 * - Base URL resolution
 * - Authorization header (token from localStorage for dev/cross-origin)
 * - credentials: 'include' (sends httpOnly cookies when same-domain in production)
 * - Consistent JSON body serialization
 */
import { getApiBaseUrl } from '@/lib/api';

export type FetchApiOptions = Omit<RequestInit, 'body'> & {
    body?: Record<string, unknown> | FormData | string | null;
};

function getStoredToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('petposture_token');
}

export async function fetchApi(
    endpoint: string,
    options: FetchApiOptions = {}
): Promise<Response> {
    const { body, headers: customHeaders, ...rest } = options;

    const headers = new Headers(customHeaders as HeadersInit | undefined);

    if (!(body instanceof FormData) && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
    }

    const token = getStoredToken();
    if (token && !headers.has('Authorization')) {
        headers.set('Authorization', `Bearer ${token}`);
    }

    const serializedBody =
        body instanceof FormData || typeof body === 'string' || body === null || body === undefined
            ? (body as BodyInit | null | undefined)
            : JSON.stringify(body);

    return fetch(`${getApiBaseUrl()}${endpoint}`, {
        ...rest,
        credentials: 'include',
        headers,
        ...(serializedBody !== undefined ? { body: serializedBody } : {}),
    });
}

/** Shorthand — returns parsed JSON or throws on non-2xx. */
export async function fetchJson<T = unknown>(
    endpoint: string,
    options: FetchApiOptions = {}
): Promise<T> {
    const res = await fetchApi(endpoint, options);
    const data = await res.json();
    if (!res.ok) {
        throw Object.assign(new Error(data?.message ?? 'Request failed'), { status: res.status, data });
    }
    return data as T;
}
