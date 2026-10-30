# Storefront Edge Cache and Split CSP Design

## Status

Revised after the “Review Handoff — Required Revisions Before Implementation Planning” review. The mandatory decisions from that handoff are incorporated into the design below. Implementation planning remains gated on human approval of this revision.

## Objective

Reduce anonymous public storefront Time to First Byte globally by allowing Cloudflare to cache a deliberately small set of HTML responses, while preserving request-specific CSP nonces and `no-store` behavior for private, transactional, preview, query-driven, RSC, prefetch, and admin traffic.

Success requires all of the following:

- A cache-eligible public HTML request returns `CF-Cache-Status: MISS` and then `HIT`.
- Median public `HIT` TTFB improves by at least 50% against the pre-rollout baseline measured from the same region and route.
- No response contains both a request-specific CSP nonce and shared-cacheable `Cache-Control`.
- No authenticated, cart, checkout, CSRF, preview, RSC/navigation, personalized, or query-driven response is stored at the edge.
- Private routes continue to return nonce-protected CSP and `private, no-store` cache headers.
- Public cacheable HTML never emits `Set-Cookie`.
- Stripe, PayPal, Google Analytics, JSON-LD, React hydration, and client navigation continue working without CSP violations.
- Repeatable verification passes from at least one Asian and one North American location.

## Current Production Facts

### Storefront and origin

- Public HTML currently returns `Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate` and `CF-Cache-Status: BYPASS`.
- The origin is in Montréal, Canada.
- Warm Nginx-to-Next.js TTFB is approximately 30–43 ms.
- Warm public TTFB observed from an Asian Cloudflare POP is approximately 280–320 ms because every HTML request returns to Montréal.
- Next.js server-side API calls now use `INTERNAL_API_URL=http://127.0.0.1:8001`, so Cloudflare is no longer in the internal SSR data path.

### CSP and request dependence

`frontend/proxy.ts` currently creates a unique nonce for each matched request. The root layout and several page components read `x-nonce` through `headers()` and write the nonce into script elements. This request dependence prevents shared HTML caching.

Known page-level nonce consumers that must be audited before route eligibility changes:

- `frontend/app/layout.tsx`
- `frontend/app/faqs/page.tsx`
- `frontend/app/shop/page.tsx`
- `frontend/app/shop/[category]/[slug]/page.tsx`
- `frontend/app/shop/breeds/[slug]/page.tsx`
- `frontend/app/shop/solutions/[slug]/page.tsx`
- `frontend/app/blog/[slug]/page.tsx`

The audit must also search the entire frontend for `headers()`, `x-nonce`, and explicit `nonce` usage so this list cannot silently become stale.

### Preview mechanism

The active preview helper emits the real parameters:

```text
expires
signature
```

`preview_token` is not the current application contract. It may be included in bypass tests only as backwards compatibility if production usage is independently confirmed.

### Laravel, Redis, and Cloudflare capabilities

Verified production configuration:

```text
CACHE_STORE=redis
SESSION_DRIVER=redis
SESSION_COOKIE=petposture-session
Redis used memory ≈ 1.29 MB
Redis maxmemory=0
Redis maxmemory-policy=noeviction
```

`XSRF-TOKEN` is also a sensitive cookie and must be part of cache bypass rules.

Redis stores both cache and sessions. This project must not introduce or change global Redis eviction policy or memory limits as part of this work. Only bounded application cache keys may be added after measurement confirms their value.

Cloudflare Tiered Cache is currently `off` and not editable on the current plan. Argo Smart Routing availability could not be confirmed with the current account permissions and must not be assumed. Neither Tiered Cache nor Argo is a prerequisite for this rollout.

## Architectural Decision

A single route-classification policy controls both CSP and origin cache behavior:

1. **Public cacheable HTML** receives deterministic public CSP and shared-cache headers.
2. **Private or bypassed traffic** receives request-specific nonce CSP and private `no-store` headers.

The classifier must run before rendering and consider host, method, pathname, query string, request headers, and sensitive cookies. CSP and caching may not be classified independently.

## Hard Security Invariant

No response may contain both:

- a request-specific CSP nonce in either the CSP header or HTML body; and
- a shared-cacheable policy such as `public` or `s-maxage`.

Formally:

```text
contains_request_nonce(response) => response_is_not_shared_cacheable
response_is_shared_cacheable => contains_request_nonce(response) == false
```

This invariant must have automated unit and production integration assertions. A violation fails deployment verification and prevents enabling or expanding the Cloudflare HTML rule.

## Route and Request Classification

### Host and method gate

A request can be public-cacheable only when:

- `http.host` is exactly `petposture.com`;
- method is `GET` or `HEAD`;
- it passes every bypass rule below; and
- its pathname is in the explicit rollout allowlist.

`api.petposture.com`, `admin.petposture.com`, and `www.petposture.com` are never eligible for this public HTML rule. Existing `www` canonical redirect behavior remains separate.

### Always private route prefixes

These prefixes always retain nonce CSP and `private, no-store`:

- `/account`
- `/admin`
- `/auth`
- `/cart`
- `/checkout`
- `/returns`
- `/sign-in`
- `/sign-up`
- `/wishlist`
- `/api`
- `/sanctum`

Next.js internals are not public HTML candidates, including `/_next/image` and non-static framework/data endpoints. The existing dedicated long-cache rule for `/_next/static/` remains separate.

### Query-string bypass

Phase 1 bypasses **every request with any query string**. There is no UTM exception and no query-string normalization in phase 1.

This rule necessarily bypasses:

- signed previews using `expires` and `signature`;
- `_rsc` requests;
- search and filter state;
- pagination;
- marketing parameters;
- any future unknown parameter.

A later phase may design a separate, tested query cache policy, but it is out of scope for the initial rollout.

### RSC and navigation bypass

Requests are private/uncacheable when any Next.js navigation or prefetch indicator is present, including at minimum:

- query parameter `_rsc`;
- header `RSC: 1`;
- header `Next-Router-Prefetch`;
- header `Next-Router-State-Tree`;
- header `Next-Router-Segment-Prefetch`;
- header `Purpose: prefetch`;
- header `Sec-Purpose: prefetch`.

RSC payloads and navigation responses require a separate cache design before they may be edge-cached. The initial Cloudflare expression and repeatable verification must explicitly test these bypasses.

### Sensitive-cookie bypass

Before writing the final Cloudflare expression, production request cookies must be rechecked immediately before rollout. The minimum confirmed bypass set is:

- `petposture-session`
- `XSRF-TOKEN`

If the live application uses additional auth, cart, checkout, wishlist, or impersonation cookies, they must be enumerated and added before enabling the rule. Guessed generic cookie names are not acceptable.

### `Set-Cookie` response invariant

Cloudflare Cache Rules execute before the origin response and therefore cannot use `Set-Cookie` as a request-phase eligibility condition.

Instead:

- the request classifier prevents known session-bearing traffic from eligibility;
- the origin must not emit `Set-Cookie` on cacheable public HTML;
- Cloudflare's documented response behavior is respected rather than overridden blindly; and
- integration verification fails if an allowlisted public HTML response emits `Set-Cookie`.

## Initial Rollout Scope

The rollout is allowlist-based, not “all routes except private routes.”

### Stage 1

Enable only:

- `/`

### Stage 2 candidates

After each route passes the same nonce, `Set-Cookie`, query, RSC, personalization, CSP, and content-freshness checks, expand only to verified editorial/legal routes:

- `/our-mission`
- `/acceptable-use-policy`
- `/affiliate-disclosure`
- `/cookie-policy`
- `/privacy-policy`
- `/return-refund-policy`
- `/shipping-policy`
- `/terms-and-conditions`

Stage 2 is not automatic. Each route must be added to the explicit allowlist only after verification.

### Deferred routes

The following remain uncached until dedicated review:

- `/contact`
- `/faqs`
- `/track-order`
- `/shop` and all product/category/breed/solution commerce pages
- `/dogs` and breed detail pages
- `/solutions` and solution detail pages
- `/blog` and blog detail pages
- legacy `/product/[id]`

Reasons include forms, page-level nonce consumers, previews, query/search state, RSC behavior, personalization, or dynamic CMS/product data.

## CSP Policies

### Private CSP

Private and bypassed requests retain the existing nonce policy:

- `script-src 'self' 'nonce-{request nonce}' 'strict-dynamic'` plus required external sources;
- nonce-aware `style-src` plus required style sources;
- current restricted `frame-src`, `font-src`, `connect-src`, `img-src`, and `media-src`;
- `object-src 'none'`;
- `base-uri 'self'`;
- `form-action 'self'`;
- `frame-ancestors 'none'`;
- `upgrade-insecure-requests` in production.

### Public CSP

Phase 1 public CSP is deterministic and contains no nonce.

Public `script-src`:

```text
script-src 'self' 'unsafe-inline' https://js.stripe.com https://www.paypal.com https://www.sandbox.paypal.com https://maps.googleapis.com https://www.googletagmanager.com https://challenges.cloudflare.com
```

Public CSP must **not** include `'strict-dynamic'`. Combining it with the phase-1 public policy would alter source-list behavior and is not approved.

Public `style-src` is explicit and deterministic:

```text
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com
```

`style-src-attr 'unsafe-inline'` remains explicit. This prevents accidental retention of a nonce-only style policy that would block required inline styles or font-generated markup.

All other directives remain at least as restrictive as the current production policy, including:

- `object-src 'none'`;
- `base-uri 'self'`;
- `frame-ancestors 'none'`;
- restricted `frame-src`;
- restricted `font-src`;
- `upgrade-insecure-requests`.

The accepted trade-off is limited to anonymous allowlisted public routes: inline script/style execution is permitted there to make deterministic HTML cacheable. Private routes keep nonce enforcement. Stable hashes may be evaluated later but are not part of phase 1.

## Layout and Page-Level Nonce Migration

The root public rendering path must stop calling `headers()` and stop writing a request nonce into HTML.

Before any route becomes cacheable:

1. Audit all known page-level nonce consumers listed in “Current Production Facts.”
2. Remove request nonce dependence only for the specific allowlisted public route path.
3. Keep deferred pages private while they still consume request nonces.
4. Search the full frontend for additional `headers()`, `x-nonce`, and `nonce` consumers.
5. Assert that cacheable public HTML and its CSP contain no nonce.

The preferred design is an explicit public/private layout boundary or an equivalent deterministic shared shell that avoids duplicating providers and visual behavior. The implementation plan must validate the approach against the installed Next.js 16 documentation before moving files or changing layout conventions.

## Cache-Control Ownership

The **Next.js frontend proxy/response layer** is the authoritative emitter of HTML cache policy because it already performs request classification and CSP selection.

Exact behavior:

### Public cacheable response

```http
Cache-Control: public, s-maxage=300, stale-while-revalidate=86400
```

### Private or bypassed response

```http
Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate
```

Cloudflare must respect origin headers. It must not use blanket `override_origin` behavior for public HTML and must never override `private` or `no-store` into a cacheable response.

For static or prerendered pages whose Next.js default cache lifetime would otherwise exceed 300 seconds, the classifier-owned response header overrides that default at the final HTML response layer. The effective shared edge TTL for every phase-1 allowlisted page is exactly 300 seconds. Browser HTML caching remains disabled or origin-controlled; browsers must not receive a long immutable HTML TTL.

The Cloudflare HTML rule only makes responses eligible. Origin `Cache-Control` remains decisive.

## Cloudflare Ruleset Design

Immediately before any Cloudflare change:

1. Export the live ruleset through the Cloudflare API.
2. Save it as a timestamped deployment artifact outside the source-controlled historical backup.
3. Record ruleset ID and version.
4. Audit interactions with all existing cache, redirect, WAF, and broad zone rules.

`cloudflare-cache-rules-backup.json` is historical evidence only and is not an acceptable rollback baseline for a future deployment.

The new public HTML rule must explicitly require:

- host equals `petposture.com`;
- method GET or HEAD;
- pathname belongs to the current rollout allowlist;
- query string is empty;
- no RSC/navigation/prefetch indicator;
- no confirmed sensitive cookie.

Private/bypass behavior must have higher effective priority than public eligibility. Verification must prove that private prefixes, query requests, RSC requests, preview requests, and cookie-bearing requests remain `BYPASS` or `DYNAMIC`.

Recommended initial edge behavior:

```text
Respect origin Cache-Control
Effective public s-maxage: 300 seconds
Browser HTML TTL: no long override
```

Static assets and public API cache rules remain separate and hostname-scoped.

## Personalized Client State

Cached HTML contains anonymous defaults only.

Before rollout, verify:

- `AuthProvider` does not server-render a user identity into cacheable HTML.
- `CartProvider` does not server-render cookie-specific cart data.
- `WishlistProvider` does not server-render cookie-specific wishlist data.
- Attribution and cookie-consent state hydrate client-side without changing cache eligibility.
- No allowlisted public Server Component reads authentication/session cookies.
- Cacheable public responses do not emit `Set-Cookie`.

Any route that fails one of these checks remains deferred.

## Purge and Invalidation

### Frontend deployments

Every production frontend deployment must purge cached storefront HTML after the new version is live and before deployment verification is considered successful.

Required sequence:

1. Build and start the new frontend container.
2. Verify local origin health.
3. Purge Cloudflare cache using the freshly configured production credential.
4. Confirm the purge API succeeded.
5. Run cold/warm production verification.

If purge fails, deployment verification fails. The deployment must not be reported successful. Operators may either restore the prior frontend/ruleset or repair the purge and rerun verification.

Because targeted URL purge was previously observed to be unreliable with this zone's cache-rule behavior, `purge_everything` remains the initial reliable mechanism. This can be revisited only after targeted purge is proven in production.

### CMS/catalog writes

Publish, update, unpublish, and delete operations that can affect public pages must trigger purge handling. At minimum audit and cover:

- pages/legal content;
- posts and publish state;
- products;
- brands;
- breeds;
- solutions;
- storefront settings;
- site media used by public pages.

If purge fails after an admin write:

- the saved database change remains committed;
- the failure is logged with status/body or exception detail;
- a retryable queued purge job is created with bounded retry/backoff;
- the admin response/UI receives a non-blocking warning that cached public content may remain stale for up to 300 seconds;
- final job failure remains observable in logs/failed jobs;
- the 300-second TTL is fallback protection, not the primary invalidation mechanism.

The current `CloudflareCacheService::purgeAll()` soft-fails only to logs. The implementation plan must extend its contract or introduce a retryable job/result object so callers can distinguish success from failure and surface the required warning without rolling back saved content.

## Laravel Application Cache

Laravel Redis optimization is separate from HTML edge caching and is measurement-gated.

Before adding keys:

1. Measure internal cold and warm latency for `/api/settings` and `/api/site-media?collection=banner`.
2. Profile whether delay is application bootstrap, database work, MediaLibrary queries, or cache access.
3. Confirm the expected invalidation owner for each data set.

If measurements justify caching, use bounded keys such as:

- assembled public settings response;
- site media response by collection.

Invalidate those keys on corresponding admin writes. Do not change Redis `maxmemory`, eviction policy, or session configuration in this project. Current `noeviction` behavior remains unchanged because sessions share Redis.

## Measurement Gate

Public HTML caching must not be enabled until a repeatable baseline is recorded.

### Required regions

- At least one Asian location.
- At least one North American location.

Use the same locations before and after rollout. A third-party regional tester or controlled remote runner is acceptable if it records headers and timing consistently.

### Required baseline targets

Measure:

- cold and warm `/` public HTML;
- at least one private route such as `/account` or `/checkout`;
- `/api/settings`;
- `/api/site-media?collection=banner`;
- one RSC/navigation request;
- one query-string request;
- one signed preview-shaped request using `expires` and `signature` without exposing a real unpublished token in logs.

Record at minimum:

- region;
- timestamp;
- status;
- DNS/connect/TLS/TTFB/total timing where available;
- `CF-Cache-Status`;
- `Age`;
- `Cache-Control`;
- `Set-Cookie` presence;
- CSP header hash or normalized value;
- response content type.

### Sample and pass/fail rule

For each public region/route, collect at least one cold sample and ten warm samples. Compare median warm TTFB from the same location and route.

Rollout passes only when:

- public warm requests are confirmed `HIT`;
- median public `HIT` TTFB improves by at least 50% from that region's baseline;
- private, query, preview, RSC, and prefetch requests remain uncacheable;
- no cacheable public response contains `Set-Cookie`;
- no nonce/cache invariant fails;
- no CSP, hydration, payment-script, analytics, auth, cart, checkout, or preview regression is detected.

If the 50% target is missed, do not expand the route allowlist. Investigate Cloudflare POP behavior, cache key, origin headers, and plan limitations. Tiered Cache is currently unavailable/off and must be documented as an environmental limitation rather than enabled speculatively.

## Repeatable Verification Tooling

Replace one-off curl checks with a repository script or test command that accepts a base URL and produces machine-readable pass/fail output.

It must assert:

- route classification;
- exact `Cache-Control` policy;
- expected `CF-Cache-Status` after cold/warm sequence;
- no unexpected `Set-Cookie`;
- no preview response caching;
- query-string bypass;
- RSC/navigation/prefetch bypass;
- public deterministic CSP with no nonce;
- private nonce CSP and `no-store`;
- nonce/cache invariant;
- public response body does not contain known account/cart personalization markers;
- response remains valid HTML and hydrates without CSP console errors in browser integration tests.

The same command must be runnable locally against an origin deployment and remotely against production. Region-specific timing collection may wrap this assertion command, but pass/fail semantics must stay consistent.

## Rollout Sequence

1. Record Asian and North American baseline measurements.
2. Reconfirm production cookie names, Redis configuration, Tiered Cache status, and Argo availability.
3. Implement and test the shared request classifier.
4. Implement deterministic public CSP and strict private CSP.
5. Remove nonce consumption from `/` public rendering only; keep deferred pages private.
6. Emit route-correct `Cache-Control` from the Next.js proxy/response layer.
7. Run automated invariant, CSP, RSC, query, cookie, preview, and `Set-Cookie` tests without Cloudflare HTML caching enabled.
8. Deploy frontend, purge, and verify origin behavior.
9. Export the live Cloudflare ruleset immediately before modification.
10. Add the hostname-scoped, allowlist-based public HTML rule that respects origin headers.
11. Purge and run cold/warm production verification from both regions.
12. Keep only `/` enabled unless all pass criteria, including the 50% TTFB improvement, succeed.
13. Add each Stage 2 editorial/legal route individually after route-specific verification.
14. Implement measured Laravel response caching only if profiling justifies it.

## Failure and Rollback

Immediate rollback triggers include:

- any private or personalized response is cached;
- any preview/RSC/query response is cached;
- a cacheable response contains a request nonce or `Set-Cookie`;
- CSP blocks required scripts/styles or hydration;
- auth/cart/checkout behavior regresses;
- deploy purge fails;
- Cloudflare rule interactions cannot be proven safe.

Rollback procedure:

1. Disable or restore the Cloudflare public HTML ruleset from the fresh pre-change export.
2. Purge Cloudflare cache and require purge success.
3. Restore the prior frontend CSP/cache behavior if necessary.
4. Verify public HTML returns `BYPASS`/`DYNAMIC` and private routes remain `no-store`.
5. Record the failure evidence before another attempt.

## Automated and Integration Testing

### Unit tests

- Every private prefix classifies private.
- Only explicit rollout paths classify public.
- Non-GET/HEAD methods classify private.
- Any query string classifies private.
- `expires` plus `signature` classifies private.
- `_rsc` and each listed navigation/prefetch header classify private.
- `petposture-session` and `XSRF-TOKEN` classify private.
- Public CSP is deterministic, contains `'unsafe-inline'`, contains no nonce, and excludes `'strict-dynamic'`.
- Public `style-src` is explicit and permits required inline styles.
- Private CSP contains a fresh nonce and `'strict-dynamic'`.
- Public/private `Cache-Control` values are exact.
- The nonce/cache invariant cannot be violated.

### Build/browser integration

- Frontend test suite passes.
- Next.js production build succeeds.
- Public HTML has no nonce and no `Set-Cookie`.
- Private HTML has nonce CSP and `no-store`.
- Stripe and PayPal scripts load where applicable.
- Google Analytics loads when configured.
- React hydration and client navigation produce no CSP errors.
- Sign-in, account, cart, checkout, returns, and wishlist remain functional.
- Signed previews remain private and uncached.

### Production integration

Public `/` must show:

```http
CF-Cache-Status: MISS
CF-Cache-Status: HIT
Cache-Control: public, s-maxage=300, stale-while-revalidate=86400
```

Private/query/RSC/preview requests must show:

```http
CF-Cache-Status: BYPASS or DYNAMIC
Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate
```

The exact Cloudflare outcome may vary between `BYPASS` and `DYNAMIC`, but it must never be `HIT` for bypassed traffic.

## Out of Scope

- Moving the VPS to another region.
- Redirecting the old Filament admin to the new admin.
- Caching RSC/navigation responses.
- Caching query-string pages.
- Enabling or purchasing Argo/Tiered Cache.
- Changing Redis memory limits, eviction policy, or session storage.
- Refactoring unrelated providers or routes.
- Dependency upgrades unrelated to CSP and caching.
