export type StorefrontPolicy = {
  kind: 'public-cacheable' | 'private';
  reason: string;
};

export type StorefrontRequestFacts = {
  host: string;
  method: string;
  pathname: string;
  search: string;
  cookieHeader: string;
  purpose: string | null;
  secPurpose: string | null;
  nextRouterPrefetch: string | null;
  rsc: string | null;
  nextRouterStateTree: string | null;
  nextRouterSegmentPrefetch: string | null;
};

export const PUBLIC_HTML_CACHE_CONTROL =
  'public, s-maxage=300, stale-while-revalidate=86400';
export const PRIVATE_HTML_CACHE_CONTROL =
  'private, no-cache, no-store, max-age=0, must-revalidate';

const PHASE_ONE_PUBLIC_PATHS = new Set(['/']);
const SENSITIVE_COOKIES = new Set(['petposture-session', 'XSRF-TOKEN']);

function hasSensitiveCookie(cookieHeader: string): boolean {
  return cookieHeader.split(';').some((cookie) => {
    const separatorIndex = cookie.indexOf('=');
    const name = (separatorIndex === -1 ? cookie : cookie.slice(0, separatorIndex)).trim();

    return SENSITIVE_COOKIES.has(name);
  });
}

function isPrefetchValue(value: string | null): boolean {
  return value !== null;
}

export function classifyStorefrontRequest(
  facts: StorefrontRequestFacts,
): StorefrontPolicy {
  if (facts.host !== 'petposture.com') {
    return { kind: 'private', reason: 'wrong-host' };
  }

  if (!['GET', 'HEAD'].includes(facts.method.toUpperCase())) {
    return { kind: 'private', reason: 'unsafe-method' };
  }

  if (facts.search !== '') {
    return { kind: 'private', reason: 'query-string' };
  }

  if (hasSensitiveCookie(facts.cookieHeader)) {
    return { kind: 'private', reason: 'sensitive-cookie' };
  }

  if (
    isPrefetchValue(facts.purpose) ||
    isPrefetchValue(facts.secPurpose) ||
    facts.nextRouterPrefetch !== null ||
    facts.rsc !== null ||
    facts.nextRouterStateTree !== null ||
    facts.nextRouterSegmentPrefetch !== null
  ) {
    return { kind: 'private', reason: 'prefetch' };
  }

  if (!PHASE_ONE_PUBLIC_PATHS.has(facts.pathname)) {
    return { kind: 'private', reason: 'not-allowlisted' };
  }

  return { kind: 'public-cacheable', reason: 'allowlisted' };
}
