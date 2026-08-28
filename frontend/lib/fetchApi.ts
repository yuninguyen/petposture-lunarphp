/**
 * Centralized API fetch helper for Sanctum's stateful SPA authentication.
 * Session credentials stay in HttpOnly cookies; unsafe requests bootstrap and
 * echo Laravel's non-secret XSRF cookie instead of reading a bearer token.
 */
import { getApiBaseUrl } from '@/lib/api';

export type FetchApiOptions = Omit<RequestInit, 'body'> & {
    body?: Record<string, unknown> | FormData | string | null;
};

let csrfBootstrap: Promise<void> | null = null;

function isUnsafeMethod(method?: string): boolean {
    return !['GET', 'HEAD', 'OPTIONS'].includes((method ?? 'GET').toUpperCase());
}

function readXsrfToken(): string | null {
    if (typeof document === 'undefined') return null;

    const token = document.cookie
        .split('; ')
        .find((cookie) => cookie.startsWith('XSRF-TOKEN='))
        ?.slice('XSRF-TOKEN='.length);

    return token ? decodeURIComponent(token) : null;
}

async function ensureCsrfCookie(): Promise<void> {
    if (typeof document === 'undefined') return;

    csrfBootstrap ??= fetch(`${getApiBaseUrl()}/sanctum/csrf-cookie`, {
        credentials: 'include',
        headers: { Accept: 'application/json' },
    }).then((response) => {
        if (!response.ok) {
            csrfBootstrap = null;
            throw new Error('Unable to initialize CSRF protection.');
        }
    });

    await csrfBootstrap;
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
    if (!headers.has('Accept')) {
        headers.set('Accept', 'application/json');
    }

    if (isUnsafeMethod(options.method)) {
        await ensureCsrfCookie();
        const xsrfToken = readXsrfToken();
        if (xsrfToken) {
            headers.set('X-XSRF-TOKEN', xsrfToken);
        }
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
