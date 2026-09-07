import { describe, expect, it } from 'vitest';
import {
  PRIVATE_HTML_CACHE_CONTROL,
  PUBLIC_HTML_CACHE_CONTROL,
  classifyStorefrontRequest,
} from './storefront-request-policy';

const home = {
  host: 'petposture.com',
  method: 'GET',
  pathname: '/',
  search: '',
  cookieHeader: '',
  purpose: null,
  secPurpose: null,
  nextRouterPrefetch: null,
  rsc: null,
  nextRouterStateTree: null,
  nextRouterSegmentPrefetch: null,
};

describe('classifyStorefrontRequest', () => {
  it('allows only the anonymous canonical homepage in phase 1', () => {
    expect(classifyStorefrontRequest(home)).toEqual({
      kind: 'public-cacheable',
      reason: 'allowlisted',
    });
    expect(classifyStorefrontRequest({ ...home, pathname: '/our-mission' })).toEqual({
      kind: 'private',
      reason: 'not-allowlisted',
    });
  });

  it.each(['?q=dog', '?expires=1&signature=x', '?_rsc=x', '?utm_source=x'])(
    'bypasses query %s',
    (search) => {
      expect(classifyStorefrontRequest({ ...home, search })).toEqual({
        kind: 'private',
        reason: 'query-string',
      });
    },
  );

  it.each(['petposture-session=x', 'XSRF-TOKEN=x'])(
    'bypasses sensitive cookie %s',
    (cookieHeader) => {
      expect(classifyStorefrontRequest({ ...home, cookieHeader })).toEqual({
        kind: 'private',
        reason: 'sensitive-cookie',
      });
    },
  );

  it.each([
    { header: 'Purpose', fact: 'purpose', value: 'navigate' },
    { header: 'Purpose', fact: 'purpose', value: 'prefetch;prerender' },
    { header: 'Purpose', fact: 'purpose', value: '' },
    { header: 'Sec-Purpose', fact: 'secPurpose', value: 'navigate' },
    { header: 'Sec-Purpose', fact: 'secPurpose', value: 'prefetch;prerender' },
    { header: 'Sec-Purpose', fact: 'secPurpose', value: '' },
    { header: 'Next-Router-Prefetch', fact: 'nextRouterPrefetch', value: 'navigate' },
    {
      header: 'Next-Router-Prefetch',
      fact: 'nextRouterPrefetch',
      value: 'prefetch;prerender',
    },
    { header: 'Next-Router-Prefetch', fact: 'nextRouterPrefetch', value: '' },
    { header: 'RSC', fact: 'rsc', value: '1' },
    { header: 'RSC', fact: 'rsc', value: '' },
    { header: 'Next-Router-State-Tree', fact: 'nextRouterStateTree', value: '%5B%22%22%5D' },
    { header: 'Next-Router-State-Tree', fact: 'nextRouterStateTree', value: '' },
    { header: 'Next-Router-Segment-Prefetch', fact: 'nextRouterSegmentPrefetch', value: '/_tree' },
    { header: 'Next-Router-Segment-Prefetch', fact: 'nextRouterSegmentPrefetch', value: '' },
  ] as const)('bypasses visible $header value "$value"', ({ fact, value }) => {
    expect(classifyStorefrontRequest({ ...home, [fact]: value })).toEqual({
      kind: 'private',
      reason: 'prefetch',
    });
  });

  it.each(['api.petposture.com', 'admin.petposture.com', 'www.petposture.com', 'PETPOSTURE.COM'])(
    'rejects host mismatch %s',
    (host) => {
      expect(classifyStorefrontRequest({ ...home, host })).toEqual({
        kind: 'private',
        reason: 'wrong-host',
      });
    },
  );

  it.each(['GET', 'get', 'HEAD', 'head'])('allows safe method %s', (method) => {
    expect(classifyStorefrontRequest({ ...home, method }).kind).toBe('public-cacheable');
  });

  it.each(['POST', 'post', 'PUT', 'DELETE'])('rejects unsafe method %s', (method) => {
    expect(classifyStorefrontRequest({ ...home, method })).toEqual({
      kind: 'private',
      reason: 'unsafe-method',
    });
  });

  it.each([
    '/account',
    '/account/orders',
    '/admin',
    '/auth/login',
    '/cart',
    '/checkout/payment',
    '/returns',
    '/sign-in',
    '/sign-up',
    '/wishlist',
    '/api/products',
    '/sanctum/csrf-cookie',
    '/_next/image',
  ])('rejects private prefix %s', (pathname) => {
    expect(classifyStorefrontRequest({ ...home, pathname })).toEqual({
      kind: 'private',
      reason: 'not-allowlisted',
    });
  });

  it.each([
    'theme=dark; petposture-session=x; locale=en',
    'theme=dark; XSRF-TOKEN=x',
    'petposture-session=x=y',
  ])('detects exact cookie tokens in %s', (cookieHeader) => {
    expect(classifyStorefrontRequest({ ...home, cookieHeader }).reason).toBe('sensitive-cookie');
  });

  it.each([
    'not-petposture-session=x',
    'petposture-session-extra=x',
    'XSRF-TOKENIZED=x',
    'xsrf-token=x',
  ])('does not match partial or case-mismatched cookie token %s', (cookieHeader) => {
    expect(classifyStorefrontRequest({ ...home, cookieHeader }).kind).toBe('public-cacheable');
  });

  it('bypasses RSC/Flight requests even when Next.js has not stripped the header (regression: origin defense-in-depth gap found 2026-09-07)', () => {
    // A raw request (curl, an external probe, or Cloudflare simply
    // forwarding whatever the client sent) is not run through Next.js's own
    // client-side fetch, so `rsc`/`next-router-state-tree`/
    // `next-router-segment-prefetch` are NOT guaranteed to be stripped
    // before reaching Proxy. The origin classifier must not rely solely on
    // the Cloudflare edge rule to exclude these; verified live against a
    // freshly deployed origin that `RSC: 1` incorrectly returned
    // `public, s-maxage=300` before this fix.
    expect(classifyStorefrontRequest({ ...home, rsc: '1' })).toEqual({
      kind: 'private',
      reason: 'prefetch',
    });
    expect(classifyStorefrontRequest({ ...home, nextRouterStateTree: '%5B%22%22%5D' })).toEqual({
      kind: 'private',
      reason: 'prefetch',
    });
    expect(classifyStorefrontRequest({ ...home, nextRouterSegmentPrefetch: '/_tree' })).toEqual({
      kind: 'private',
      reason: 'prefetch',
    });
  });

  it('exports the exact public and private HTML cache policies', () => {
    expect(PUBLIC_HTML_CACHE_CONTROL).toBe(
      'public, s-maxage=300, stale-while-revalidate=86400',
    );
    expect(PRIVATE_HTML_CACHE_CONTROL).toBe(
      'private, no-cache, no-store, max-age=0, must-revalidate',
    );
  });
});
