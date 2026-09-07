# Task 4 Implementation Report

## Status

Implemented Task 4 in the `storefront-edge-cache-csp` worktree.

The proxy now applies the Task 2 request classifier and Task 3 CSP builders directly:

- only anonymous canonical `https://petposture.com/` GET/HEAD requests receive the deterministic public CSP and shared-cache policy;
- query-string, non-allowlisted, sensitive-cookie, wrong-host, unsafe-method, and visible prefetch requests receive private no-store headers and a per-request nonce CSP;
- request CSP headers are propagated upstream, and `x-nonce` is propagated only for private requests;
- redirects and normal responses receive the same route-correct CSP and Cache-Control policy;
- visible prefetch requests are no longer excluded by the matcher;
- `/admin` authorization behavior remains unchanged, while its `/api/me` lookup now prefers `INTERNAL_API_URL`.

The root layout no longer reads `headers()`, depends on `x-nonce`, or renders global Organization/WebSite JSON-LD. The homepage now renders deterministic Organization/WebSite JSON-LD without a nonce through `buildSiteSchema`.

## Next.js 16 Proxy Documentation

Read the installed documentation at:

`frontend/node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`

Relevant constraint (lines 436-444): during RSC requests, Next.js strips internal Flight headers such as `rsc`, `next-router-state-tree`, and `next-router-prefetch` from the `NextRequest` headers exposed to Proxy. The implementation documents that the classifier can handle only visible request signals. Cloudflare configuration and production probes must therefore guarantee that requests whose Flight signal is hidden never become cache `HIT`s.

The documentation also confirms that request headers must be passed upstream through `NextResponse.next({ request: { headers } })`, rather than as client response headers.

## GitNexus Impact Analysis

Repository: `storefront-edge-cache-csp`

The initial index was stale. `npx gitnexus analyze` refreshed it successfully despite the command process returning an abnormal Windows exit marker after analysis. A subsequent `npx gitnexus status` reported the index up to date at commit `526f373` with 15,029 symbols and 32,444 relationships.

Pre-edit impact results:

| Symbol | Direct callers | Affected processes | Risk |
| --- | --- | --- | --- |
| `proxy` | 0 | 0 | LOW |
| `RootLayout` | 0 | 0 | LOW |
| `Home` | 0 | 0 | LOW |
| `fetchNavigationUser` | `proxy` | 0 | LOW |
| `fetchHeroImage` | `Home` | 0 | LOW |
| `getShopSettings` | `generateMetadata`, `RootLayout` | 0 | LOW |
| `generateMetadata` | 0 | 0 | LOW |
| `buildContentSecurityPolicy` compatibility alias | 0 | 0 | LOW |

No HIGH or CRITICAL impact was reported.

Before commit, GitNexus `detect_changes` was first run against the dirty worktree. It reported MEDIUM aggregate risk across nine tracked files and three execution flows because the worktree contains unrelated earlier-task modifications in `AGENTS.md`, `CLAUDE.md`, `docker-compose.prod.yml`, `frontend/lib/api.ts`, and `frontend/package.json`. Task 4 staging was therefore restricted to Task 4 paths, with only the Task 4 hunks of the already-modified root layout staged.

A second `detect_changes` run with `scope: staged` reported exactly seven Task 4 files, 14 changed symbols, three affected `* -> Secure` flows, and MEDIUM aggregate risk. The affected symbols were confined to `RootLayout`, `Home`, proxy policy/authorization locals, `fetchNavigationUser`, `proxy`, and `config`; no unrelated earlier-task file was staged.

## TDD Evidence

### RED

Created `frontend/proxy.test.ts` and `frontend/lib/site-schema.test.ts` before production implementation, then ran:

```text
npx vitest run proxy.test.ts lib/site-schema.test.ts
```

Observed two failing suites:

- `proxy.test.ts` could not load the old proxy's unresolved `@/lib/content-security-policy` import in direct Vitest execution;
- `lib/site-schema.test.ts` failed because `./site-schema` did not exist.

This established the missing proxy integration and schema module before implementation.

### GREEN

After the minimal implementation:

```text
npx vitest run proxy.test.ts lib/site-schema.test.ts lib/storefront-request-policy.test.ts lib/content-security-policy.test.ts
```

Result: 4 files passed, 84 tests passed, 0 failed.

Coverage includes:

- public homepage CSP/cache behavior;
- private behavior for query, route, cookie, and visible prefetch requests;
- the invariant that shared-cache responses never contain a nonce CSP;
- route-correct upstream CSP and private `x-nonce` propagation;
- matcher inclusion of visible prefetch requests;
- internal admin API lookup and preserved redirect security headers;
- deterministic Organization/WebSite schema output and optional-field omission.

## Verification

Commands and results:

```text
npx vitest run proxy.test.ts lib/site-schema.test.ts lib/storefront-request-policy.test.ts lib/content-security-policy.test.ts
```

- PASS: 84 tests.

```text
npm test
```

- PASS: 61 tests.
- Note: the existing `npm test` script does not yet include the new Task 4 suites; the required focused command above runs them explicitly.

```text
npx eslint proxy.ts proxy.test.ts app/layout.tsx app/page.tsx lib/site-schema.ts lib/site-schema.test.ts lib/content-security-policy.ts
```

- PASS: exit 0, no output.

```text
npm run build
```

- PASS: Next.js 16.2.3 production build completed and generated all routes.
- Existing environmental warnings remain: Tailwind config module-type warning and backend-dependent breed/solution fetches logging `ECONNREFUSED` during static generation. These did not fail the build.

```text
git diff --check
```

- PASS after removing the trailing blank-line warning.

## Nonce Consumer Audit

Searched `frontend/app`, `frontend/components`, and `frontend/lib` for `headers(`, `x-nonce`, and `nonce=`.

The root layout consumer was removed. No component consumers were found. The following deferred page-level consumers remain unchanged, as required for phase 1:

- `frontend/app/faqs/page.tsx`
- `frontend/app/blog/[slug]/page.tsx`
- `frontend/app/shop/page.tsx`
- `frontend/app/shop/[category]/[slug]/page.tsx`
- `frontend/app/shop/solutions/[slug]/page.tsx`
- `frontend/app/shop/breeds/[slug]/page.tsx`

Task 3 nonce-detection test fixtures remain in `frontend/lib/content-security-policy.test.ts`; they are test strings, not runtime nonce consumers.

## Files

Task 4 files:

- `frontend/proxy.ts`
- `frontend/proxy.test.ts`
- `frontend/app/layout.tsx`
- `frontend/app/page.tsx`
- `frontend/lib/site-schema.ts`
- `frontend/lib/site-schema.test.ts`
- `.superpowers/sdd/2026-09-06-storefront-edge-cache-csp/task-4-report.md`

The Task 3 compatibility alias in `frontend/lib/content-security-policy.ts` was deliberately left unchanged. Task 4 consumes `buildPublicContentSecurityPolicy` and `buildPrivateContentSecurityPolicy` exactly; retaining the alias avoids expanding this commit beyond the specified Task 4 files.

## Concerns / Follow-up

1. Hidden Flight headers cannot be classified inside Next.js Proxy. Production Cloudflare verification must prove all RSC/prefetch probes remain non-`HIT`.
2. The worktree contains unrelated uncommitted changes from prior tasks. They were not staged for this commit.
3. The existing `npm test` script does not include the new proxy/schema suites; the Task 4 focused verification command is required until a later task updates the aggregate script.
4. Build-time backend fetch warnings are environmental and pre-existing, but they reduce build-log signal quality.

## Fix Round 1

Addressed the Task 4 review findings without changing hidden RSC/Cloudflare behavior or Set-Cookie handling:

- added `serializeJsonLd` at the homepage JSON-LD rendering boundary; it serializes with `JSON.stringify`, escapes every `<` as `\\u003c`, and escapes U+2028/U+2029 while preserving JSON parse semantics;
- added the exact CMS payload `</script><script>alert(document.domain)</script>` regression test, asserting the serialized value contains no literal `</script` or executable injected tag and parses back to the original schema;
- canonicalized `sameAs` in the fixed supported order `facebook`, `instagram`, `twitter`, `tiktok`, `pinterest`, `youtube`, filtering blank values and ignoring unsupported keys;
- added an insertion-order equivalence test proving semantically identical social settings produce identical schema output;
- confirmed there were no frontend callers of `buildContentSecurityPolicy`, migrated the legacy Node test to `buildPrivateContentSecurityPolicy`, and removed the compatibility alias.

### Fix-round TDD evidence

RED command:

```text
npx vitest run lib/site-schema.test.ts
```

Result: 2 failures as expected: insertion-order output differed and `serializeJsonLd` did not exist.

GREEN commands:

```text
npx vitest run lib/site-schema.test.ts lib/content-security-policy.test.ts proxy.test.ts lib/storefront-request-policy.test.ts
node --test lib/content-security-policy.test.mjs
```

Result: 4 Vitest files passed, 86 tests passed; legacy Node CSP suite passed 2 tests.
