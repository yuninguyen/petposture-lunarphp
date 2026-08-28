export type FetchApiOptions = Omit<RequestInit, 'body'> & {
  body?: Record<string, unknown> | FormData | null;
};

let csrfBootstrap: Promise<void> | null = null;

function getApiBaseUrl(): string {
  return import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';
}

function isUnsafeMethod(method?: string): boolean {
  return !['GET', 'HEAD', 'OPTIONS'].includes((method ?? 'GET').toUpperCase());
}

function readXsrfToken(): string | null {
  const token = document.cookie
    .split('; ')
    .find((cookie) => cookie.startsWith('XSRF-TOKEN='))
    ?.slice('XSRF-TOKEN='.length);

  return token ? decodeURIComponent(token) : null;
}

async function ensureCsrfCookie(): Promise<void> {
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

export async function fetchApi(endpoint: string, options: FetchApiOptions = {}): Promise<Response> {
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
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw Object.assign(new Error(data?.message ?? 'Request failed'), { status: res.status, data });
  }
  return data as T;
}
