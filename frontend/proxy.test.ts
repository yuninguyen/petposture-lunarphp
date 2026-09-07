import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import {
  buildPrivateContentSecurityPolicy,
  buildPublicContentSecurityPolicy,
} from './lib/content-security-policy';
import {
  PRIVATE_HTML_CACHE_CONTROL,
  PUBLIC_HTML_CACHE_CONTROL,
} from './lib/storefront-request-policy';
import { config, proxy } from './proxy';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('proxy storefront policy', () => {
  it('makes only the anonymous canonical homepage shared-cacheable', async () => {
    const response = await proxy(new NextRequest('https://petposture.com/'));
    const policy = response.headers.get('content-security-policy');

    expect(response.headers.get('cache-control')).toBe(PUBLIC_HTML_CACHE_CONTROL);
    expect(policy).toBe(buildPublicContentSecurityPolicy());
    expect(policy).not.toContain('nonce-');
  });

  it('uses the request Host header when Next URL retains the local browser origin', async () => {
    const response = await proxy(new NextRequest('http://127.0.0.1:3101/', {
      headers: { host: 'petposture.com:3101' },
    }));

    expect(response.headers.get('cache-control')).toBe(PUBLIC_HTML_CACHE_CONTROL);
    expect(response.headers.get('content-security-policy')).toBe(buildPublicContentSecurityPolicy());
  });

  it('keeps query, private, cookie, and visible prefetch requests private', async () => {
    for (const request of [
      new NextRequest('https://petposture.com/?_rsc=x'),
      new NextRequest('https://petposture.com/account'),
      new NextRequest('https://petposture.com/', {
        headers: { cookie: 'petposture-session=x' },
      }),
      new NextRequest('https://petposture.com/', {
        headers: { purpose: 'prefetch' },
      }),
      new NextRequest('https://petposture.com/', {
        headers: { rsc: '1' },
      }),
      new NextRequest('https://petposture.com/', {
        headers: { 'next-router-state-tree': '%5B%22%22%5D' },
      }),
      new NextRequest('https://petposture.com/', {
        headers: { 'next-router-segment-prefetch': '/_tree' },
      }),
    ]) {
      const response = await proxy(request);
      const policy = response.headers.get('content-security-policy');

      expect(response.headers.get('cache-control')).toBe(PRIVATE_HTML_CACHE_CONTROL);
      expect(policy).toContain('nonce-');
    }
  });

  it('never combines public shared caching with a nonce CSP', async () => {
    const requests = [
      new NextRequest('https://petposture.com/'),
      new NextRequest('https://petposture.com/account'),
      new NextRequest('https://petposture.com/', {
        headers: { 'sec-purpose': 'prefetch' },
      }),
      new NextRequest('https://www.petposture.com/'),
    ];

    for (const request of requests) {
      const response = await proxy(request);
      if (response.headers.get('cache-control') === PUBLIC_HTML_CACHE_CONTROL) {
        expect(response.headers.get('content-security-policy')).not.toContain('nonce-');
      }
    }
  });

  it('passes route-correct CSP and nonce headers upstream', async () => {
    const publicResponse = await proxy(new NextRequest('https://petposture.com/'));
    expect(publicResponse.headers.get('x-middleware-request-content-security-policy')).toBe(
      buildPublicContentSecurityPolicy(),
    );
    expect(publicResponse.headers.get('x-middleware-request-x-nonce')).toBeNull();

    const privateResponse = await proxy(new NextRequest('https://petposture.com/account'));
    const nonce = privateResponse.headers.get('x-middleware-request-x-nonce');
    expect(nonce).toBeTruthy();
    expect(privateResponse.headers.get('x-middleware-request-content-security-policy')).toBe(
      buildPrivateContentSecurityPolicy(nonce!),
    );
  });

  it('includes visible prefetch requests in the matcher', () => {
    expect(config.matcher).toEqual([
      '/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)',
    ]);
  });

  it('uses the internal API URL while preserving admin authorization redirects', async () => {
    vi.stubEnv('INTERNAL_API_URL', 'http://127.0.0.1:8001/');
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://api.petposture.com');
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: null }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const response = await proxy(
      new NextRequest('https://petposture.com/admin', {
        headers: { cookie: 'petposture-session=x' },
      }),
    );

    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:8001/api/me',
      expect.objectContaining({ cache: 'no-store' }),
    );
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('https://petposture.com/sign-in');
    expect(response.headers.get('cache-control')).toBe(PRIVATE_HTML_CACHE_CONTROL);
    expect(response.headers.get('content-security-policy')).toContain('nonce-');
  });
});
