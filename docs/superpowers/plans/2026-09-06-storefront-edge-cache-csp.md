# Storefront Edge Cache and Split CSP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the anonymous homepage safely cacheable at Cloudflare with deterministic CSP, while preserving nonce CSP and `no-store` for every private, query, preview, RSC, prefetch, cookie-bearing, or deferred request.

**Architecture:** A pure frontend request classifier is the single source of truth for CSP and `Cache-Control`. Phase 1 allowlists only `/`; every other HTML request remains private. Laravel gains observable/retryable Cloudflare purge behavior, the admin surfaces purge warnings, and repeatable scripts enforce cache/security invariants before and after the hostname-scoped Cloudflare rule is changed.

**Tech Stack:** Next.js 16.2.3 Proxy/App Router, TypeScript, Vitest, Playwright, Laravel 11, PHPUnit, Redis, React admin, Cloudflare Rulesets API, Docker Compose.

**Spec:** `docs/superpowers/specs/2026-09-06-storefront-edge-cache-csp-design.md`

## Global Constraints

- Read the installed Next.js 16 documentation under `frontend/node_modules/next/dist/docs/` before changing Proxy, matcher, layout, or caching conventions.
- Run `npx gitnexus impact <symbol> --direction upstream --repo petposture` before editing every existing function, class, or method; report HIGH/CRITICAL results before proceeding.
- Keep phase-1 public HTML allowlist exactly `['/']`.
- Public cache eligibility requires host `petposture.com`, method GET/HEAD, empty query string, no sensitive cookie, and no visible prefetch/navigation signal.
- Sensitive cookies initially include exact production names `petposture-session` and `XSRF-TOKEN`; re-export live cookie/config evidence before Cloudflare rollout.
- Public CSP contains `'unsafe-inline'`, contains no nonce, and excludes `'strict-dynamic'`.
- Private CSP retains a fresh nonce and `'strict-dynamic'`.
- A request-specific nonce and shared-cacheable `Cache-Control` must never coexist.
- Public cacheable HTML must not emit `Set-Cookie`.
- Origin/Next.js Proxy owns HTML `Cache-Control`; Cloudflare respects origin and must not override `private`/`no-store`.
- Any query string, including `expires`, `signature`, `_rsc`, search, pagination, or UTM parameters, bypasses phase-1 HTML caching.
- RSC/prefetch must never return `CF-Cache-Status: HIT`. Because Next.js 16 strips some Flight headers before `request.headers` reaches Proxy, Cloudflare verification is authoritative for those hidden-header cases.
- Frontend deploy purge failure fails deployment verification. CMS write purge failure preserves saved data, queues retry, logs detail, and shows a non-blocking admin warning.
- Re-export the live Cloudflare ruleset immediately before every modification. Historical `cloudflare-cache-rules-backup.json` is not a rollback baseline.
- Audit by name the existing broad **“Cache HTML pages”** rule and **“Cache safe public catalog/content API GET endpoints (5 min edge TTL)”** rule; do not assume they remain hostname-scoped.
- Do not change Redis `maxmemory`, `maxmemory-policy`, session driver, or session storage.
- Do not enable/purchase Argo or Tiered Cache. Record that Tiered Cache is currently off/unavailable.
- Rollout passes only with at least 50% median public `HIT` TTFB improvement from the same region and no private-data/CSP regression.
- Commit after each task only if the workspace is a Git repository. If it is not, preserve task-sized diffs and record that commits were unavailable.

---

## File Map

### Frontend storefront

- Create `frontend/lib/storefront-request-policy.ts` — pure route/request classifier and exact cache constants.
- Create `frontend/lib/storefront-request-policy.test.ts` — exhaustive unit tests for route, query, cookie, and visible navigation signals.
- Modify `frontend/lib/content-security-policy.ts` — separate deterministic public CSP from nonce-based private CSP.
- Create `frontend/lib/content-security-policy.test.ts` — CSP and nonce/cache invariant tests.
- Modify `frontend/proxy.ts` — apply the classifier, CSP, request nonce propagation, cache headers, and expanded matcher behavior.
- Create `frontend/proxy.test.ts` — request/response integration tests using Next request objects.
- Modify `frontend/app/layout.tsx` — remove root `headers()`/nonce dependency and global inline JSON-LD.
- Modify `frontend/app/page.tsx` — render deterministic homepage Organization/WebSite JSON-LD without a nonce.
- Create `frontend/app/page.test.tsx` or a focused JSON-LD helper test — prove deterministic homepage schema.
- Modify `frontend/package.json` — include new tests and verification commands.
- Create `frontend/playwright.config.ts` — production-build browser verification configuration.
- Create `frontend/e2e/storefront-csp.spec.ts` — hydration/CSP/private-route smoke tests.

### Repeatable operations

- Create `scripts/verify-storefront-cache.mjs` — machine-readable origin/Cloudflare invariant and timing checks.
- Create `scripts/cloudflare-storefront-rules.mjs` — live export, named-rule audit, guarded phase-1 update, and restore support.
- Modify root `package.json` — add stable commands for both scripts.
- Modify `docker-compose.prod.yml` only if a deploy-only environment variable is required by the purge/verification commands; do not add secrets to source control.

### Laravel cache invalidation

- Create `backend/app/ValueObjects/CloudflarePurgeResult.php` — immutable purge outcome.
- Modify `backend/app/Services/CloudflareCacheService.php` — return structured success/failure instead of silent void.
- Create `backend/app/Jobs/PurgeCloudflareCache.php` — bounded retry/backoff job.
- Create `backend/app/Support/CloudflarePurgeNotice.php` — request-scoped purge warning state and deduplication.
- Create `backend/app/Services/PublicContentPurgeCoordinator.php` — immediate purge, failure logging, retry dispatch, and notice recording.
- Create `backend/app/Http/Middleware/AttachCloudflarePurgeWarning.php` — add warning header to successful admin API responses.
- Create `backend/app/Observers/PublicContentCacheObserver.php` — trigger the coordinator for public-content models.
- Modify `backend/app/Providers/AppServiceProvider.php` — scoped binding, middleware/observer registration.
- Modify or remove duplicate purge calls in `PostCacheObserver.php`, `ProductCacheObserver.php`, `BrandCacheObserver.php`, and `SettingCacheObserver.php` so each request attempts one immediate purge.
- Add observer coverage for `Page`, `Breed`, `Solution`, and `SiteMedia`.
- Create `backend/tests/Unit/Services/CloudflareCacheServiceTest.php`.
- Create `backend/tests/Feature/PublicContentPurgeTest.php`.
- Create `backend/tests/Feature/CloudflarePurgeWarningMiddlewareTest.php`.

### Admin warning UI

- Modify `admin/src/lib/api.ts` — detect the response warning header and emit one typed browser event.
- Create `admin/src/lib/api.test.ts` or extend its existing test file — prove warning event behavior.
- Modify `admin/src/App.tsx` — listen once and show a non-blocking `react-hot-toast` warning.
- Create/modify `admin/src/App.test.tsx` — prove one warning toast per event.

### Optional measured Laravel response cache

- Modify `backend/app/Http/Controllers/Api/SettingsController.php` only if the measurement gate in Task 8 is met.
- Modify `backend/app/Http/Controllers/Api/SiteMediaController.php` only if the measurement gate in Task 8 is met.
- Modify corresponding observers to invalidate the exact bounded keys.
- Extend `backend/tests/Feature/SettingsApiTest.php` and create `backend/tests/Feature/SiteMediaApiTest.php`.

---

### Task 1: Record a Repeatable Pre-Change Baseline

**Files:**
- Create: `scripts/verify-storefront-cache.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: environment variable `STOREFRONT_BASE_URL`; optional `VERIFY_EXPECTATION=baseline|origin|cloudflare`.
- Produces: command `npm run verify:storefront-cache`; JSON report with `scenario`, `status`, `ttfbMs`, `cacheControl`, `cfCacheStatus`, `age`, `setCookie`, `contentType`, `csp`, and pass/fail reasons.

- [ ] **Step 1: Write a failing Node test for response classification helpers**

Create `scripts/verify-storefront-cache.test.mjs` using `node:test`. Define expected parsing behavior before the implementation exists:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateResponse } from './verify-storefront-cache.mjs';

test('rejects a private response reported as a Cloudflare HIT', () => {
  const result = evaluateResponse({
    scenario: 'private-account',
    expectedCacheable: false,
    headers: new Headers({
      'cf-cache-status': 'HIT',
      'cache-control': 'private, no-store',
    }),
    body: '<html></html>',
  });
  assert.equal(result.pass, false);
  assert.match(result.reasons.join('\n'), /must never be HIT/);
});

test('rejects cacheable HTML that emits Set-Cookie or a nonce', () => {
  const result = evaluateResponse({
    scenario: 'public-home',
    expectedCacheable: true,
    headers: new Headers({
      'cache-control': 'public, s-maxage=300',
      'set-cookie': 'petposture-session=secret',
      'content-security-policy': "script-src 'nonce-abc'",
    }),
    body: '<script nonce="abc"></script>',
  });
  assert.equal(result.pass, false);
  assert.match(result.reasons.join('\n'), /Set-Cookie/);
  assert.match(result.reasons.join('\n'), /nonce/);
});
```

- [ ] **Step 2: Run the test and confirm RED**

Run:

```bash
node --test scripts/verify-storefront-cache.test.mjs
```

Expected: FAIL because `verify-storefront-cache.mjs` or `evaluateResponse` does not exist.

- [ ] **Step 3: Implement the verification script**

Export pure helpers and run network checks only when invoked as the main module. Include these scenarios:

```js
const scenarios = [
  { name: 'public-home', path: '/', expectedCacheable: true },
  { name: 'private-account', path: '/account', expectedCacheable: false },
  { name: 'query-home', path: '/?utm_source=cache-test', expectedCacheable: false },
  { name: 'preview-shape', path: '/?expires=4102444800&signature=invalid-test-signature', expectedCacheable: false },
  { name: 'rsc-query', path: '/?_rsc=cache-test', expectedCacheable: false },
  { name: 'prefetch-purpose', path: '/', expectedCacheable: false, headers: { Purpose: 'prefetch' } },
  { name: 'prefetch-next-router', path: '/', expectedCacheable: false, headers: { 'Next-Router-Prefetch': '1' } },
  { name: 'session-cookie', path: '/', expectedCacheable: false, headers: { Cookie: 'petposture-session=test' } },
  { name: 'xsrf-cookie', path: '/', expectedCacheable: false, headers: { Cookie: 'XSRF-TOKEN=test' } },
];
```

For `cloudflare` mode, make one cold request and ten warm requests for `public-home`; calculate median warm TTFB. For bypass scenarios, assert `CF-Cache-Status !== 'HIT'`. Redact `Set-Cookie` values and query signatures from JSON output.

- [ ] **Step 4: Add package commands**

Add to root `package.json`:

```json
{
  "scripts": {
    "verify:storefront-cache": "node scripts/verify-storefront-cache.mjs",
    "test:storefront-cache-script": "node --test scripts/verify-storefront-cache.test.mjs"
  }
}
```

Preserve all existing scripts.

- [ ] **Step 5: Run tests and capture baseline**

Run:

```bash
npm run test:storefront-cache-script
$env:STOREFRONT_BASE_URL='https://petposture.com'; $env:VERIFY_EXPECTATION='baseline'; npm run verify:storefront-cache
```

On Linux runners use inline environment assignments. Save raw JSON reports outside source control with timestamp and region, for example:

```text
artifacts/storefront-cache/2026-09-06-asia-baseline.json
artifacts/storefront-cache/2026-09-06-north-america-baseline.json
```

Expected baseline: public HTML may be `BYPASS`; private/query/RSC/prefetch scenarios must not be `HIT`. Do not proceed to Cloudflare enablement without reports from both regions.

- [ ] **Step 6: Commit task-sized changes**

```bash
git add scripts/verify-storefront-cache.mjs scripts/verify-storefront-cache.test.mjs package.json
git commit -m "test: add repeatable storefront cache verification"
```

---

### Task 2: Build the Single Request Policy Classifier

**Files:**
- Create: `frontend/lib/storefront-request-policy.ts`
- Create: `frontend/lib/storefront-request-policy.test.ts`
- Modify: `frontend/package.json`

**Interfaces:**
- Produces:

```ts
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
};

export const PUBLIC_HTML_CACHE_CONTROL = 'public, s-maxage=300, stale-while-revalidate=86400';
export const PRIVATE_HTML_CACHE_CONTROL = 'private, no-cache, no-store, max-age=0, must-revalidate';
export function classifyStorefrontRequest(facts: StorefrontRequestFacts): StorefrontPolicy;
```

- [ ] **Step 1: Write failing classifier tests**

Tests must cover exact allowlist and every bypass:

```ts
import { describe, expect, it } from 'vitest';
import { classifyStorefrontRequest } from './storefront-request-policy';

const home = {
  host: 'petposture.com', method: 'GET', pathname: '/', search: '', cookieHeader: '',
  purpose: null, secPurpose: null, nextRouterPrefetch: null,
};

it('allows only the anonymous canonical homepage in phase 1', () => {
  expect(classifyStorefrontRequest(home).kind).toBe('public-cacheable');
  expect(classifyStorefrontRequest({ ...home, pathname: '/our-mission' }).kind).toBe('private');
});

it.each(['?q=dog', '?expires=1&signature=x', '?_rsc=x', '?utm_source=x'])('bypasses query %s', (search) => {
  expect(classifyStorefrontRequest({ ...home, search }).kind).toBe('private');
});

it.each(['petposture-session=x', 'XSRF-TOKEN=x'])('bypasses sensitive cookie %s', (cookieHeader) => {
  expect(classifyStorefrontRequest({ ...home, cookieHeader }).kind).toBe('private');
});

it('bypasses visible prefetch signals', () => {
  expect(classifyStorefrontRequest({ ...home, purpose: 'prefetch' }).kind).toBe('private');
  expect(classifyStorefrontRequest({ ...home, secPurpose: 'prefetch' }).kind).toBe('private');
  expect(classifyStorefrontRequest({ ...home, nextRouterPrefetch: '1' }).kind).toBe('private');
});
```

Also test host mismatch, HEAD allowed, POST denied, private prefixes, cookie token boundaries, and case-insensitive method/header values.

- [ ] **Step 2: Run tests and confirm RED**

```bash
cd frontend
npx vitest run lib/storefront-request-policy.test.ts
```

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the minimal pure classifier**

Use an explicit phase-1 set:

```ts
const PHASE_ONE_PUBLIC_PATHS = new Set(['/']);
const SENSITIVE_COOKIES = new Set(['petposture-session', 'XSRF-TOKEN']);
```

Parse cookie names by splitting `;`, trimming, and comparing the name before the first `=`. Return a stable reason such as `wrong-host`, `unsafe-method`, `query-string`, `sensitive-cookie`, `prefetch`, or `not-allowlisted`.

- [ ] **Step 4: Run classifier tests and full frontend unit tests**

```bash
npx vitest run lib/storefront-request-policy.test.ts
npm test
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/storefront-request-policy.ts frontend/lib/storefront-request-policy.test.ts frontend/package.json
git commit -m "feat: classify cacheable storefront requests"
```

---

### Task 3: Split Public and Private CSP Policies

**Files:**
- Modify: `frontend/lib/content-security-policy.ts`
- Create: `frontend/lib/content-security-policy.test.ts`

**Interfaces:**
- Produces:

```ts
export function buildPublicContentSecurityPolicy(): string;
export function buildPrivateContentSecurityPolicy(nonce: string): string;
export function containsRequestNonce(value: string): boolean;
```

Keep `buildContentSecurityPolicy` only as a temporary compatibility alias if existing callers/tests require it; remove the alias once `proxy.ts` migrates in Task 4.

- [ ] **Step 1: Run GitNexus impact before editing**

```bash
npx gitnexus impact buildContentSecurityPolicy --direction upstream --repo petposture --depth 3
```

Record callers and risk. Stop for human review if HIGH/CRITICAL.

- [ ] **Step 2: Write failing CSP tests**

```ts
it('builds deterministic public CSP without nonce or strict-dynamic', () => {
  const first = buildPublicContentSecurityPolicy();
  const second = buildPublicContentSecurityPolicy();
  expect(first).toBe(second);
  expect(first).toContain("script-src 'self' 'unsafe-inline'");
  expect(first).toContain("style-src 'self' 'unsafe-inline' https://fonts.googleapis.com");
  expect(first).not.toContain('nonce-');
  expect(first).not.toContain("'strict-dynamic'");
});

it('builds private CSP with nonce and strict-dynamic', () => {
  const policy = buildPrivateContentSecurityPolicy('abc');
  expect(policy).toContain("'nonce-abc'");
  expect(policy).toContain("'strict-dynamic'");
  expect(policy).not.toContain("script-src 'self' 'unsafe-inline'");
});
```

- [ ] **Step 3: Run tests and confirm RED**

```bash
npx vitest run lib/content-security-policy.test.ts
```

Expected: FAIL because the new exports do not exist.

- [ ] **Step 4: Implement shared directive assembly**

Use one internal function that receives only the `script-src` and `style-src` variants. Preserve all existing third-party origins and restrictive directives. Do not add new origins.

- [ ] **Step 5: Run focused and full tests**

```bash
npx vitest run lib/content-security-policy.test.ts
npm test
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/lib/content-security-policy.ts frontend/lib/content-security-policy.test.ts
git commit -m "feat: split public and private CSP policies"
```

---

### Task 4: Apply Policy in Next.js Proxy and Remove Root Nonce Dependence

**Files:**
- Modify: `frontend/proxy.ts`
- Create: `frontend/proxy.test.ts`
- Modify: `frontend/app/layout.tsx`
- Modify: `frontend/app/page.tsx`
- Create: `frontend/lib/site-schema.ts`
- Create: `frontend/lib/site-schema.test.ts`

**Interfaces:**
- Consumes: `classifyStorefrontRequest`, public/private cache constants, public/private CSP builders.
- Produces: route-correct request CSP propagation and response CSP/Cache-Control; deterministic homepage Organization/WebSite JSON-LD.

- [ ] **Step 1: Read Next.js 16 Proxy documentation and record the relevant constraint**

Read:

```text
frontend/node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md
```

Specifically preserve this fact in code comments/tests: Next.js strips some internal Flight headers from `request.headers` during RSC requests. The classifier handles visible signals, while Cloudflare and production verification guarantee hidden-header requests never become `HIT`.

- [ ] **Step 2: Run GitNexus impact for edited symbols**

```bash
npx gitnexus impact proxy --direction upstream --repo petposture --depth 3
npx gitnexus impact RootLayout --direction upstream --repo petposture --depth 3
npx gitnexus impact Home --direction upstream --repo petposture --depth 3
```

Record risk and affected callers.

- [ ] **Step 3: Write failing proxy integration tests**

Construct `NextRequest` instances and assert response headers:

```ts
it('makes only anonymous canonical homepage shared-cacheable', async () => {
  const response = await proxy(new NextRequest('https://petposture.com/'));
  expect(response.headers.get('cache-control')).toBe(PUBLIC_HTML_CACHE_CONTROL);
  expect(response.headers.get('content-security-policy')).toBe(buildPublicContentSecurityPolicy());
  expect(response.headers.get('content-security-policy')).not.toContain('nonce-');
});

it('keeps query, private, cookie, and visible prefetch requests private', async () => {
  for (const request of [
    new NextRequest('https://petposture.com/?_rsc=x'),
    new NextRequest('https://petposture.com/account'),
    new NextRequest('https://petposture.com/', { headers: { cookie: 'petposture-session=x' } }),
    new NextRequest('https://petposture.com/', { headers: { purpose: 'prefetch' } }),
  ]) {
    const response = await proxy(request);
    expect(response.headers.get('cache-control')).toBe(PRIVATE_HTML_CACHE_CONTROL);
    expect(response.headers.get('content-security-policy')).toContain('nonce-');
  }
});
```

Add an invariant assertion that a response with `PUBLIC_HTML_CACHE_CONTROL` contains no nonce in CSP.

- [ ] **Step 4: Confirm RED**

```bash
npx vitest run proxy.test.ts
```

Expected: FAIL because current Proxy always emits nonce CSP and no explicit route-correct cache header.

- [ ] **Step 5: Expand the Proxy matcher to include prefetch requests**

Remove the current `missing` exclusions from `config.matcher` so visible prefetch requests reach Proxy and can receive private headers:

```ts
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)'],
};
```

This resolves the review note for prefetch requests that were previously excluded. Because Next.js may strip internal Flight headers, production verification still requires every prefetch/RSC probe to be non-`HIT`.

- [ ] **Step 6: Implement policy application in Proxy**

For public requests:

- do not generate nonce;
- set deterministic public CSP in upstream request headers and response headers;
- set `PUBLIC_HTML_CACHE_CONTROL` on the response.

For private requests:

- generate nonce;
- set `x-nonce` and private CSP upstream;
- set private CSP and `PRIVATE_HTML_CACHE_CONTROL` on redirects and normal responses.

Keep `/admin` authorization behavior unchanged. Use `INTERNAL_API_URL` for server-side admin user lookup rather than the public Cloudflare hostname if this function is touched; add a focused test.

- [ ] **Step 7: Remove root `headers()` and move global JSON-LD to homepage**

In `frontend/app/layout.tsx`:

- remove `headers` import;
- remove nonce lookup;
- remove the global inline Organization/WebSite `<script>`.

Create `frontend/lib/site-schema.ts`:

```ts
export function buildSiteSchema(settings: {
  shopName: string;
  shopLogo: string | null;
  description: string | null;
  social: Record<string, string | null | undefined>;
  contact: { phone?: string | null; address?: string | null };
}): object;
```

Render this schema in `frontend/app/page.tsx` without a nonce. This is safe only because `/` uses deterministic public CSP; private/deferred pages no longer inherit an un-nonced global inline script.

- [ ] **Step 8: Audit all page-level nonce consumers without changing deferred routes**

Run:

```bash
rg "headers\(|x-nonce|nonce=" frontend/app frontend/components frontend/lib
```

Confirm the known list in the spec. Do not remove nonce from deferred routes in phase 1. Add the audit result to the implementation report.

- [ ] **Step 9: Run tests and production build**

```bash
npx vitest run proxy.test.ts lib/site-schema.test.ts lib/storefront-request-policy.test.ts lib/content-security-policy.test.ts
npm test
npm run build
```

Expected: all tests PASS and Next production build exits 0.

- [ ] **Step 10: Commit**

```bash
git add frontend/proxy.ts frontend/proxy.test.ts frontend/app/layout.tsx frontend/app/page.tsx frontend/lib/site-schema.ts frontend/lib/site-schema.test.ts
git commit -m "feat: emit cache-safe homepage CSP and headers"
```

---

### Task 5: Add Browser CSP and Hydration Verification

**Files:**
- Create: `frontend/playwright.config.ts`
- Create: `frontend/e2e/storefront-csp.spec.ts`
- Modify: `frontend/package.json`

**Interfaces:**
- Produces command `npm run test:e2e:csp`.

- [ ] **Step 1: Write the browser tests**

Capture console errors and failed requests:

```ts
import { expect, test } from '@playwright/test';

test('homepage hydrates without CSP violations', async ({ page }) => {
  const cspErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error' && /content security policy|csp/i.test(message.text())) {
      cspErrors.push(message.text());
    }
  });
  const response = await page.goto('/');
  expect(response?.headers()['cache-control']).toContain('public');
  await expect(page.locator('body')).toBeVisible();
  expect(cspErrors).toEqual([]);
});

test('private route retains no-store and nonce CSP', async ({ page }) => {
  const response = await page.goto('/account');
  expect(response?.headers()['cache-control']).toContain('no-store');
  expect(response?.headers()['content-security-policy']).toContain('nonce-');
});
```

Also verify homepage HTML contains Organization/WebSite JSON-LD and no `nonce=` attribute.

- [ ] **Step 2: Configure Playwright against production build**

Use `webServer.command: 'npm run start -- -p 3101'`, `reuseExistingServer: false`, and `baseURL: 'http://127.0.0.1:3101'`. Do not point automated browser tests at production writes.

- [ ] **Step 3: Run and fix only CSP/cache issues**

```bash
npm run build
npx playwright install chromium
npm run test:e2e:csp
```

Expected: PASS with zero CSP console errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/playwright.config.ts frontend/e2e/storefront-csp.spec.ts frontend/package.json
git commit -m "test: verify storefront CSP in browser"
```

---

### Task 6: Make Cloudflare Purge Observable and Retryable

**Files:**
- Create: `backend/app/ValueObjects/CloudflarePurgeResult.php`
- Modify: `backend/app/Services/CloudflareCacheService.php`
- Create: `backend/app/Jobs/PurgeCloudflareCache.php`
- Create: `backend/app/Support/CloudflarePurgeNotice.php`
- Create: `backend/app/Services/PublicContentPurgeCoordinator.php`
- Create: `backend/app/Http/Middleware/AttachCloudflarePurgeWarning.php`
- Create: `backend/tests/Unit/Services/CloudflareCacheServiceTest.php`
- Create: `backend/tests/Feature/CloudflarePurgeWarningMiddlewareTest.php`

**Interfaces:**
- Produces:

```php
final readonly class CloudflarePurgeResult
{
    public function __construct(
        public bool $successful,
        public bool $configured,
        public ?int $status = null,
        public ?string $message = null,
    ) {}
}

class CloudflareCacheService
{
    public function purgeAll(): CloudflarePurgeResult;
}

class PublicContentPurgeCoordinator
{
    public function purge(): CloudflarePurgeResult;
}
```

Warning response header:

```text
X-PetPosture-Cache-Warning: purge-pending
```

- [ ] **Step 1: Run GitNexus impact**

```bash
npx gitnexus impact CloudflareCacheService --direction upstream --repo petposture --depth 3
npx gitnexus impact purgeAll --direction upstream --repo petposture --depth 3
```

Stop if risk is HIGH/CRITICAL.

- [ ] **Step 2: Write failing service tests**

Use `Http::fake()` to assert:

- configured successful API response returns `successful=true`;
- HTTP 500 returns failure with status and safe message;
- exception returns failure without throwing;
- unconfigured service returns `configured=false` and does not dispatch HTTP.

- [ ] **Step 3: Confirm RED**

```bash
cd backend
php artisan test tests/Unit/Services/CloudflareCacheServiceTest.php
```

Expected: FAIL because `purgeAll()` returns void.

- [ ] **Step 4: Implement result value object and service return contract**

Do not log or expose API tokens/bodies containing secrets. Keep `purge_everything=true` because targeted purge is not yet trusted for this zone.

- [ ] **Step 5: Write failing coordinator/middleware tests**

Tests must prove:

- first failure dispatches `PurgeCloudflareCache` and records request notice;
- repeated calls in one request are deduplicated;
- successful calls do not dispatch retry or warning;
- middleware adds warning header only to successful `/api/admin/*` responses when notice is present;
- saved resource response remains successful.

- [ ] **Step 6: Implement retry job and request notice**

Job configuration:

```php
public int $tries = 4;
public function backoff(): array { return [30, 120, 300]; }
```

On each retry call `purgeAll()` and throw a `RuntimeException` when unsuccessful so Laravel retry semantics apply. Log final failure through `failed(Throwable $exception)`.

Bind `CloudflarePurgeNotice` as a scoped service. The coordinator attempts once per request, records failure, logs it, and dispatches the job.

- [ ] **Step 7: Run tests**

```bash
php artisan test tests/Unit/Services/CloudflareCacheServiceTest.php tests/Feature/CloudflarePurgeWarningMiddlewareTest.php
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add backend/app/ValueObjects/CloudflarePurgeResult.php backend/app/Services/CloudflareCacheService.php backend/app/Jobs/PurgeCloudflareCache.php backend/app/Support/CloudflarePurgeNotice.php backend/app/Services/PublicContentPurgeCoordinator.php backend/app/Http/Middleware/AttachCloudflarePurgeWarning.php backend/tests/Unit/Services/CloudflareCacheServiceTest.php backend/tests/Feature/CloudflarePurgeWarningMiddlewareTest.php
git commit -m "feat: retry and report Cloudflare purge failures"
```

---

### Task 7: Cover Public-Content Writes and Surface Admin Warning

**Files:**
- Create: `backend/app/Observers/PublicContentCacheObserver.php`
- Modify: `backend/app/Providers/AppServiceProvider.php`
- Modify: `backend/app/Observers/PostCacheObserver.php`
- Modify: `backend/app/Observers/ProductCacheObserver.php`
- Modify: `backend/app/Observers/BrandCacheObserver.php`
- Modify: `backend/app/Observers/SettingCacheObserver.php`
- Create: `backend/tests/Feature/PublicContentPurgeTest.php`
- Modify: `admin/src/lib/api.ts`
- Create/Modify: `admin/src/lib/api.test.ts`
- Modify: `admin/src/App.tsx`
- Create/Modify: `admin/src/App.test.tsx`

**Interfaces:**
- Backend emits `X-PetPosture-Cache-Warning: purge-pending` after a successful write whose immediate purge failed.
- Admin emits browser event `petposture:cache-warning` from `fetchApi` and shows one warning toast.

- [ ] **Step 1: Run GitNexus impact for every existing symbol to edit**

```bash
npx gitnexus impact AppServiceProvider --direction upstream --repo petposture --depth 3
npx gitnexus impact PostCacheObserver --direction upstream --repo petposture --depth 3
npx gitnexus impact ProductCacheObserver --direction upstream --repo petposture --depth 3
npx gitnexus impact BrandCacheObserver --direction upstream --repo petposture --depth 3
npx gitnexus impact SettingCacheObserver --direction upstream --repo petposture --depth 3
npx gitnexus impact fetchApi --direction upstream --repo petposture --depth 3
npx gitnexus impact App --direction upstream --repo petposture --depth 3
```

- [ ] **Step 2: Write failing backend observer coverage**

Use fakes/mocks to verify saved/deleted events for `Page`, `Post`, `Product`, `Brand`, `Breed`, `Solution`, `Setting`, and `SiteMedia` call the coordinator once per request. Preserve existing setting-key invalidation.

Also test `PageController` update succeeds and includes the warning header when purge fails.

- [ ] **Step 3: Confirm RED**

```bash
cd backend
php artisan test tests/Feature/PublicContentPurgeTest.php
```

Expected: FAIL because Page/Breed/Solution/SiteMedia do not trigger purge and no warning middleware is registered.

- [ ] **Step 4: Register observer and middleware behavior**

Use one public-content observer where model-specific invalidation is unnecessary. Remove duplicate direct closure dispatches from old cache observers after tests prove coordinator coverage. Do not remove `SettingCacheObserver`'s `Cache::forget("setting:{$key}")` behavior.

Register the warning middleware only for admin API responses, using the Laravel 11 middleware configuration pattern already present in `bootstrap/app.php`; if registration belongs there, run GitNexus impact on the relevant configuration symbol before editing it.

- [ ] **Step 5: Write failing admin API warning test**

Mock a successful response containing the warning header and assert:

```ts
expect(eventListener).toHaveBeenCalledTimes(1);
expect(event.type).toBe('petposture:cache-warning');
```

Ensure ordinary responses emit no event.

- [ ] **Step 6: Implement admin warning handling**

In `fetchApi`, after receiving the response:

```ts
if (response.headers.get('X-PetPosture-Cache-Warning') === 'purge-pending') {
  window.dispatchEvent(new CustomEvent('petposture:cache-warning'));
}
```

In `App.tsx`, register one effect listener and show:

```text
Content was saved, but the storefront cache purge is still retrying. Public pages may remain stale for up to 5 minutes.
```

Use `toast()` or `toast.error()` with non-blocking duration; do not convert the successful mutation into an error.

- [ ] **Step 7: Run backend and admin tests**

```bash
cd backend
php artisan test tests/Feature/PublicContentPurgeTest.php tests/Feature/CloudflarePurgeWarningMiddlewareTest.php
cd ../admin
npm test -- src/lib/api.test.ts src/App.test.tsx
npm run build
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add backend/app/Observers backend/app/Providers/AppServiceProvider.php backend/bootstrap/app.php backend/tests/Feature/PublicContentPurgeTest.php admin/src/lib/api.ts admin/src/lib/api.test.ts admin/src/App.tsx admin/src/App.test.tsx
git commit -m "feat: purge storefront cache after public content writes"
```

---

### Task 8: Profile and, Only if Justified, Cache Laravel Settings and Site Media

**Files:**
- Modify conditionally: `backend/app/Http/Controllers/Api/SettingsController.php`
- Modify conditionally: `backend/app/Http/Controllers/Api/SiteMediaController.php`
- Extend: `backend/tests/Feature/SettingsApiTest.php`
- Create conditionally: `backend/tests/Feature/SiteMediaApiTest.php`
- Modify relevant observers for exact key invalidation.

**Interfaces:**
- Measurement gate: implement application response cache only if median local warm endpoint latency remains above 100 ms or profiling shows repeated database/MediaLibrary work.
- Proposed keys if gate passes:

```text
public-api:settings:v1
public-api:site-media:v1:{collection}
```

- [ ] **Step 1: Record local cold/warm profiles on VPS**

Run at least ten requests per endpoint through `127.0.0.1:8001`, plus query count/timing instrumentation in a non-public diagnostic execution. Record results in the implementation report, not source-controlled secrets.

- [ ] **Step 2: Decide against the explicit gate**

- If median warm latency is `<=100 ms` and no repeated expensive work appears, skip controller changes and document the evidence.
- If median warm latency is `>100 ms` or repeated queries dominate, continue with Steps 3–7.

Current historical measurements of approximately 380–500 ms suggest the gate will likely pass, but rerun fresh measurements.

- [ ] **Step 3: Run GitNexus impact before controller edits**

```bash
npx gitnexus impact SettingsController --direction upstream --repo petposture --depth 3
npx gitnexus impact SiteMediaController --direction upstream --repo petposture --depth 3
npx gitnexus impact index --direction upstream --repo petposture --depth 3
```

Disambiguate `index` with context/file if GitNexus reports multiple symbols.

- [ ] **Step 4: Write failing feature tests**

Assert the second request uses cached assembled data and model changes invalidate the exact key. Preserve identical JSON payload and status.

- [ ] **Step 5: Implement bounded Redis cache**

Use `Cache::remember(..., now()->addMinutes(5), fn () => ...)`. Do not use `rememberForever`. Invalidate settings key on relevant setting saves and collection-specific media key on SiteMedia save/delete/media update.

- [ ] **Step 6: Run tests and benchmark again**

```bash
php artisan test tests/Feature/SettingsApiTest.php tests/Feature/SiteMediaApiTest.php
```

Then rerun ten local endpoint requests. Expected median warm latency: under 100 ms. If not achieved, retain correctness changes only if profiling proves reduced DB work; otherwise revert this optional task.

- [ ] **Step 7: Commit if implemented**

```bash
git add backend/app/Http/Controllers/Api/SettingsController.php backend/app/Http/Controllers/Api/SiteMediaController.php backend/tests/Feature/SettingsApiTest.php backend/tests/Feature/SiteMediaApiTest.php backend/app/Observers
git commit -m "perf: cache assembled public settings and media"
```

---

### Task 9: Add Guarded Cloudflare Ruleset Export, Audit, Apply, and Restore

**Files:**
- Create: `scripts/cloudflare-storefront-rules.mjs`
- Create: `scripts/cloudflare-storefront-rules.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ZONE_ID`, and command `export|audit|apply-home|restore`.
- Produces timestamped live JSON export and a guarded ruleset update.

- [ ] **Step 1: Write failing transformation tests**

Fixture a ruleset containing the existing named rules:

```js
const rules = [
  { description: 'Cache HTML pages', expression: '(not starts_with(http.request.uri.path, "/api/"))' },
  { description: 'Cache safe public catalog/content API GET endpoints (5 min edge TTL)', expression: '(http.request.method eq "GET") and (...)' },
];
```

Assert `auditRuleset()` reports both by exact description and reports whether each expression contains an explicit `http.host` condition. Assert `buildHomeRule()` includes:

- exact host `petposture.com`;
- GET/HEAD;
- exact path `/`;
- empty query string;
- sensitive-cookie exclusions;
- visible prefetch header exclusions;
- no `override_origin` edge TTL.

- [ ] **Step 2: Confirm RED**

```bash
node --test scripts/cloudflare-storefront-rules.test.mjs
```

Expected: FAIL because script does not exist.

- [ ] **Step 3: Implement commands with safety guards**

`export`:

- fetch live `http_request_cache_settings` entrypoint;
- save `artifacts/cloudflare/<timestamp>-cache-ruleset-v<version>.json`;
- print SHA-256 and ruleset ID/version.

`audit`:

- identify exact rules **“Cache HTML pages”** and **“Cache safe public catalog/content API GET endpoints (5 min edge TTL)”**;
- print their full expressions and hostname-scope result;
- fail if either expected rule is missing, duplicated, or broader than the reviewed expression;
- list all cache rules in evaluation order.

`apply-home`:

- require `--from-export <path>` whose ruleset ID/version matches the just-read live version;
- convert the broad HTML rule into an allowlist rule for `/` or add a higher-priority explicit homepage rule while making the broad rule ineligible for HTML; choose the smaller diff after live audit;
- preserve the API rule behavior and explicitly confirm it is scoped to `api.petposture.com`; if it is still path-only, scope it in the same atomic update;
- use `cache: true`, browser TTL respect-origin, and edge TTL respect-origin/bypass-by-default semantics; never override origin `private/no-store`;
- write the API response as a post-change artifact.

`restore`:

- require explicit export path and confirmation flag;
- PUT the exact exported rules back;
- print new version and require subsequent purge.

- [ ] **Step 4: Add package commands**

```json
{
  "scripts": {
    "cloudflare:cache-rules": "node scripts/cloudflare-storefront-rules.mjs"
  }
}
```

- [ ] **Step 5: Run offline tests**

```bash
npm run test:storefront-cache-script
node --test scripts/cloudflare-storefront-rules.test.mjs
```

Expected: PASS without network access.

- [ ] **Step 6: Commit**

```bash
git add scripts/cloudflare-storefront-rules.mjs scripts/cloudflare-storefront-rules.test.mjs package.json
git commit -m "ops: guard Cloudflare storefront cache rollout"
```

---

### Task 10: Deploy Frontend/Backend/Admin Without Enabling HTML Cache

**Files:**
- Deployment-only changes; source files from Tasks 1–9.

**Interfaces:**
- Produces a production origin where `/` has deterministic public CSP and public cache headers, while Cloudflare HTML caching remains disabled/bypassed until verification passes.

- [ ] **Step 1: Run full verification locally/VPS**

```bash
cd frontend && npm test && npm run build && npm run test:e2e:csp
cd ../backend && php artisan test
cd ../admin && npm test && npm run build
cd .. && npm run test:storefront-cache-script && node --test scripts/cloudflare-storefront-rules.test.mjs
```

Expected: all commands exit 0.

- [ ] **Step 2: Run GitNexus change detection before deployment/commit**

Use the available GitNexus change-detection tool. If only CLI is available, refresh the index when possible and run impact/context checks for changed symbols; record any index limitation. Confirm affected scope is limited to storefront policy/CSP, purge coordination, admin warning, optional public API cache, and operations scripts.

- [ ] **Step 3: Build and deploy containers**

On VPS:

```bash
cd /opt/petposture
docker compose -f docker-compose.prod.yml build backend frontend admin
docker compose -f docker-compose.prod.yml up -d backend frontend admin
docker compose -f docker-compose.prod.yml ps
```

- [ ] **Step 4: Verify local origin before purge**

Run verification against the origin through local Nginx resolution or direct frontend port. Required:

- `/` public CSP has no nonce;
- `/` origin Cache-Control is exactly public policy;
- `/` has no Set-Cookie;
- `/account`, query, preview-shape, RSC query, and visible prefetch are private/no-store;
- browser CSP test passes against deployed frontend.

- [ ] **Step 5: Purge Cloudflare and require success**

Use the production Cloudflare purge credential through the service or API. Verify success response. If purge fails, mark deployment verification failed and do not enable HTML caching.

- [ ] **Step 6: Verify production while HTML cache is still disabled**

Run:

```bash
STOREFRONT_BASE_URL=https://petposture.com VERIFY_EXPECTATION=origin npm run verify:storefront-cache
```

Public `/` may remain `BYPASS` before rule enablement, but CSP, Cache-Control, Set-Cookie, private, query, preview, RSC, and prefetch assertions must pass.

---

### Task 11: Enable Homepage Edge Cache with Fresh Live Export

**Files:**
- Runtime Cloudflare ruleset only.
- Artifacts: timestamped pre/post ruleset exports and verification reports.

**Interfaces:**
- Consumes scripts from Tasks 1 and 9.
- Produces a homepage-only rule respecting origin headers.

- [ ] **Step 1: Reconfirm production facts immediately before change**

On VPS verify:

```bash
docker exec petposture-backend php artisan tinker --execute="dump(config('cache.default'), config('session.driver'), config('session.cookie'));"
docker exec petposture-redis redis-cli INFO memory
docker exec petposture-redis redis-cli CONFIG GET maxmemory
docker exec petposture-redis redis-cli CONFIG GET maxmemory-policy
```

Expected: Redis cache/session, cookie `petposture-session`, and no unreviewed configuration drift. Inspect browser/API cookies to reconfirm `XSRF-TOKEN` and detect additional sensitive cookies.

- [ ] **Step 2: Export and audit the live ruleset**

```bash
node scripts/cloudflare-storefront-rules.mjs export
node scripts/cloudflare-storefront-rules.mjs audit
```

The audit report must name and print:

- **Cache HTML pages** — historically broad/path-only and therefore a required explicit audit target;
- **Cache safe public catalog/content API GET endpoints (5 min edge TTL)** — historically path-matched and a required explicit audit target.

Do not continue if either rule is missing, duplicated, unexpectedly broad, or changed since export.

- [ ] **Step 3: Apply the guarded homepage rule atomically**

```bash
node scripts/cloudflare-storefront-rules.mjs apply-home --from-export artifacts/cloudflare/<fresh-export>.json
```

Expected: API success, new ruleset version, homepage rule explicitly hostname-scoped, API rule explicitly hostname-scoped, no blanket HTML override of origin `no-store`.

- [ ] **Step 4: Purge and require success**

Purge everything with the production credential. Abort/restore if purge fails.

- [ ] **Step 5: Run cold/warm verification from North America and Asia**

From each same-region runner used for baseline:

```bash
STOREFRONT_BASE_URL=https://petposture.com VERIFY_EXPECTATION=cloudflare npm run verify:storefront-cache
```

Required:

- cold homepage `MISS` or `EXPIRED`, then warm `HIT`;
- ten warm samples;
- no homepage nonce or Set-Cookie;
- private/query/preview/RSC/prefetch/cookie probes never `HIT`;
- exact origin Cache-Control remains visible/consistent;
- median `HIT` TTFB improves at least 50% against same-region baseline.

For prefetch headers that Proxy cannot observe because Next.js strips Flight headers, the pass condition is explicitly `CF-Cache-Status !== HIT`; do not require a Proxy-added private Cache-Control if the matcher/framework path prevents it.

- [ ] **Step 6: Run browser production smoke verification**

Run read-only Playwright checks against production for homepage hydration/CSP and private-route headers. Do not execute checkout/payment writes.

- [ ] **Step 7: Keep or rollback**

Keep the rule only if every gate passes. Otherwise:

```bash
node scripts/cloudflare-storefront-rules.mjs restore --from-export artifacts/cloudflare/<fresh-export>.json --confirm
```

Then purge and verify homepage returns `BYPASS`/`DYNAMIC` again.

---

### Task 12: Validate CMS Purge Failure and Deployment Purge Runbook

**Files:**
- Modify: `README.md` deployment/cache section or create `docs/operations/storefront-cache.md`

**Interfaces:**
- Produces operator runbook with deploy purge, CMS warning/retry, ruleset restore, and verification commands.

- [ ] **Step 1: Write the runbook with exact commands**

Document:

- frontend/backend/admin deploy sequence;
- mandatory purge API/service command;
- failure means deployment verification failed;
- queue worker status check;
- failed-job inspection/retry;
- admin warning meaning;
- 300-second stale fallback;
- fresh ruleset export/audit/apply/restore commands;
- regional verification command and 50% gate;
- explicit statement that Tiered Cache is off/unavailable and Redis eviction settings must not be changed.

- [ ] **Step 2: Exercise purge failure safely in test/staging configuration**

Use an invalid token only in a test environment. Verify:

- resource save succeeds;
- warning header/event/toast appears;
- retry job is dispatched;
- final failure is logged/observable;
- no real production content or token is exposed.

- [ ] **Step 3: Exercise successful CMS invalidation in production with a harmless approved content update**

After human approval for the content update, verify purge succeeds and the next homepage request is cold (`MISS`/`EXPIRED`) followed by `HIT`.

- [ ] **Step 4: Run final full verification**

```bash
cd frontend && npm test && npm run build && npm run test:e2e:csp
cd ../backend && php artisan test
cd ../admin && npm test && npm run build
cd .. && npm run test:storefront-cache-script && node --test scripts/cloudflare-storefront-rules.test.mjs
```

Then rerun production regional verification and archive reports.

- [ ] **Step 5: Run final GitNexus change detection**

Confirm only expected symbols and flows changed. Report stale-index/tooling limitations rather than claiming detection succeeded when it did not.

- [ ] **Step 6: Commit documentation**

```bash
git add docs/operations/storefront-cache.md README.md
git commit -m "docs: add storefront cache rollout runbook"
```

---

## Final Acceptance Checklist

- [ ] Public phase-1 allowlist is exactly `/`.
- [ ] Homepage public CSP is deterministic, nonce-free, uses `'unsafe-inline'`, and excludes `'strict-dynamic'`.
- [ ] Private CSP retains nonce and `'strict-dynamic'`.
- [ ] Root layout no longer calls `headers()` for global nonce consumption.
- [ ] Known page-level nonce consumers were audited and deferred routes remain private.
- [ ] Query, `expires`/`signature`, `_rsc`, RSC/navigation, and prefetch probes never return Cloudflare `HIT`.
- [ ] Proxy matcher no longer intentionally excludes visible prefetch requests; hidden Flight-header cases use the explicit non-`HIT` verification rule.
- [ ] `petposture-session` and `XSRF-TOKEN` are bypassed; any additional live sensitive cookies are enumerated.
- [ ] Public cacheable HTML has exact shared Cache-Control, no nonce, and no Set-Cookie.
- [ ] Private/bypassed HTML has exact private/no-store Cache-Control.
- [ ] Frontend deploy purge failure fails deployment verification.
- [ ] CMS purge failure preserves data, warns admin, logs, and retries with bounded backoff.
- [ ] Live Cloudflare ruleset was exported immediately before modification.
- [ ] Existing **Cache HTML pages** and **Cache safe public catalog/content API GET endpoints (5 min edge TTL)** rules were audited by exact name and final expression.
- [ ] Cloudflare public HTML rule is hostname-scoped to `petposture.com`, homepage-only, and respects origin.
- [ ] API rule remains hostname-scoped to `api.petposture.com`.
- [ ] Tiered Cache/Argo status and Redis configuration are recorded without speculative changes.
- [ ] Asian and North American median homepage `HIT` TTFB improve at least 50% against same-region baseline.
- [ ] All unit, feature, build, browser, operations-script, and production integration checks pass.
