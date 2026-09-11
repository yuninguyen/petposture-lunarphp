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

  it('keeps a dynamically rendered private route uncached and nonce-protected', async () => {
    const response = await proxy(new NextRequest('https://petposture.com/account'));
    const policy = response.headers.get('content-security-policy');

    expect(response.headers.get('cache-control')).toBe(PRIVATE_HTML_CACHE_CONTROL);
    expect(policy).toContain('nonce-');
  });

  it('bypasses `/` from the shared cache without requiring a nonce the static body cannot have (regression: found 2026-09-07 via real browser session with a session cookie)', async () => {
    // `/` is statically prerendered (ISR) and its body never contains a
    // nonce attribute on any script tag, no matter which request triggers
    // the render. Emitting nonce-required CSP for a bypassed `/` request
    // (cookie, query, prefetch, wrong host, unsafe method) blocks every
    // script on the page for that visitor, because the body can never
    // satisfy that nonce. Cache-Control must still be private/no-store so
    // the bypassed response is never cached.
    //
    // Note: constructing a NextRequest directly (as done here) does NOT
    // reproduce Next.js's real server behavior of stripping rsc/
    // next-router-state-tree/next-router-segment-prefetch/
    // next-router-prefetch before Proxy runs (confirmed 2026-09-07 against
    // a real `next start` server). These cases only prove the classifier
    // wiring is correct in isolation; Cloudflare's edge rule is the real
    // enforcement point for those four headers in production.
    for (const request of [
      new NextRequest('https://petposture.com/?_rsc=x'),
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
      expect(policy).toBe(buildPublicContentSecurityPolicy());
      expect(policy).not.toContain('nonce-');
    }
  });

  it('applies the same no-nonce bypass to every other statically prerendered page (regression: found 2026-09-07 live on /blog with a real session cookie -- 21 blocked scripts, non-interactive page)', async () => {
    // Removing headers()/nonce from the root layout freed every route that
    // doesn't itself call headers() to go statically prerendered, not just
    // `/`. Verified against a real `npm run build` (routes marked "○")
    // 2026-09-07. Each of these must behave exactly like `/` when bypassed.
    const staticNoNoncePaths = [
      '/auth/reset-password',
      '/blog',
      '/cart',
      '/contact',
      '/dogs',
      '/our-mission',
      '/returns',
      '/shop/breeds',
      '/shop/breeds/flat-faced',
      '/shop/breeds/long-backed',
      '/shop/solutions',
      '/sign-in',
      '/sign-up',
      '/solutions',
      '/track-order',
      '/wishlist',
    ];

    for (const path of staticNoNoncePaths) {
      const response = await proxy(new NextRequest(`https://petposture.com${path}`, {
        headers: { cookie: 'petposture-session=x' },
      }));
      const policy = response.headers.get('content-security-policy');

      expect(response.headers.get('cache-control')).toBe(PRIVATE_HTML_CACHE_CONTROL);
      expect(policy).toBe(buildPublicContentSecurityPolicy());
      expect(policy).not.toContain('nonce-');
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

  // Direct NextRequest inputs prove visible policy only, not Flight visibility after Next normalization.
  // `/` is in STATIC_NO_NONCE_PATHS (see proxy.ts), so any bypass here must
  // still get the no-nonce public CSP, not a private nonce -- consistent
  // with the 2026-09-07 regression test above. A forged client nonce must
  // never be echoed back either way.
  it.each([
    ['CoOkIe', ''],
    ['Cookie', 'audit-unrelated=x'],
    ['Cookie', 'malformed-cookie'],
    ['Cookie', 'petposture-session=x'],
    ['Cookie', 'XSRF-TOKEN=x'],
    ['RSC', ''],
    ['RSC', '0'],
    ['Next-Router-State-Tree', ''],
    ['Next-Router-State-Tree', '0'],
    ['Next-Router-Segment-Prefetch', ''],
    ['Next-Router-Segment-Prefetch', '0'],
    ['Purpose', ''],
    ['Purpose', '0'],
    ['Sec-Purpose', ''],
    ['Sec-Purpose', '0'],
    ['Next-Router-Prefetch', ''],
    ['Next-Router-Prefetch', '0'],
  ])('keeps visible %s value "%s" private without a nonce the static `/` body cannot have', async (header, value) => {
    const response = await proxy(new NextRequest('https://petposture.com/', {
      headers: { [header]: value, 'x-nonce': 'forged-client-nonce' },
    }));
    const nonce = response.headers.get('x-middleware-request-x-nonce');
    const csp = response.headers.get('content-security-policy');

    expect(response.headers.get('cache-control')).toBe(PRIVATE_HTML_CACHE_CONTROL);
    expect(nonce).toBeNull();
    expect(csp).toBe(buildPublicContentSecurityPolicy());
    expect(csp).not.toContain('nonce-');
    expect(response.headers.get('x-middleware-request-content-security-policy')).toBe(csp);
    expect(response.headers.has('set-cookie')).toBe(false);
  });

  it.each(['GET', 'HEAD'])('strips forged nonce from public %s upstream headers', async (method) => {
    const response = await proxy(new NextRequest('https://petposture.com/', {
      method,
      headers: { 'X-Nonce': 'forged-client-nonce' },
    }));
    const csp = response.headers.get('content-security-policy');

    expect(response.headers.get('cache-control')).toBe(PUBLIC_HTML_CACHE_CONTROL);
    expect(response.headers.get('x-middleware-request-x-nonce')).toBeNull();
    expect(response.headers.get('x-middleware-override-headers')?.split(',')).not.toContain('x-nonce');
    expect(csp).not.toContain('nonce-');
    expect(csp).toContain("'unsafe-inline'");
    expect(csp).not.toContain('strict-dynamic');
    expect(response.headers.get('x-middleware-request-content-security-policy')).toBe(csp);
    expect(response.headers.has('set-cookie')).toBe(false);
  });

  it('replaces forged nonce with a fresh matching private nonce per request', async () => {
    const nonces: string[] = [];
    for (let i = 0; i < 2; i++) {
      const response = await proxy(new NextRequest('https://petposture.com/account', {
        headers: { 'x-nonce': 'forged-client-nonce' },
      }));
      const nonce = response.headers.get('x-middleware-request-x-nonce');
      const csp = response.headers.get('content-security-policy');

      expect(response.headers.get('cache-control')).toBe(PRIVATE_HTML_CACHE_CONTROL);
      expect(nonce).toBeTruthy();
      expect(nonce).not.toBe('forged-client-nonce');
      expect(csp).toContain(`'nonce-${nonce}'`);
      expect(response.headers.get('x-middleware-request-content-security-policy')).toBe(csp);
      nonces.push(nonce!);
    }
    expect(nonces[0]).not.toBe(nonces[1]);
  });

  it.each([
    { roles: ['customer'], location: 'https://petposture.com/', status: 307 },
    { roles: ['admin'], location: null, status: 200 },
  ])('preserves admin role gate for $roles', async ({ roles, location, status }) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { roles } }), {
      headers: { 'content-type': 'application/json' },
    })));
    const response = await proxy(new NextRequest('https://petposture.com/admin', {
      headers: { 'x-nonce': 'forged-client-nonce' },
    }));

    expect(response.status).toBe(status);
    expect(response.headers.get('location')).toBe(location);
    expect(response.headers.get('cache-control')).toBe(PRIVATE_HTML_CACHE_CONTROL);
    expect(response.headers.get('content-security-policy')).toContain('nonce-');
    expect(response.headers.get('content-security-policy')).not.toContain('forged-client-nonce');
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
