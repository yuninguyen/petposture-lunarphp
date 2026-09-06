# Task 5 Report: Browser CSP and Hydration Verification

## Status

PASS. Production-build Chromium coverage now verifies the homepage and `/account` with no browser page errors or CSP console violations.

## Implementation

- Added `frontend/playwright.config.ts` with:
  - `webServer.command: 'npm run start -- -p 3101'`
  - `reuseExistingServer: false`
  - `baseURL: 'http://127.0.0.1:3101'`
  - Chromium host resolution mapping `petposture.com` to `127.0.0.1` so the real production-host policy is exercised against the local build.
- Added `frontend/e2e/storefront-csp.spec.ts`.
  - Fails on `pageerror` events.
  - Fails on CSP-related browser console errors; no CSP ignores or policy weakening.
  - Homepage asserts public cache headers, visible hydrated content, Organization/WebSite JSON-LD, and absence of a JSON-LD `nonce` attribute.
  - `/account` asserts `no-store`, nonce CSP, and zero browser CSP/page errors.
- Added `npm run test:e2e:csp` and the matching `@playwright/test` dependency.

## Browser Findings and Fixes

The initial real-browser RED run found two Task 4 integration gaps:

1. Next.js `request.nextUrl.hostname` retained the local origin while the request `Host` header represented `petposture.com`, causing the homepage to be classified private during local production-host verification. `proxy` now classifies with the request `Host` header (port stripped), with `nextUrl.hostname` as fallback. A focused proxy test covers this boundary.
2. `/account` emitted strict nonce CSP but remained statically rendered, so Next.js did not attach the request nonce to framework scripts and Chromium blocked them. `AccountLayout` now calls `connection()` to force request-time rendering, as required by the installed Next.js 16 CSP guide. The private CSP itself was not changed.

GitNexus impact before symbol edits:

- `Home`: LOW, 0 direct callers, 0 affected processes/modules.
- `proxy`: LOW, 0 direct callers, 0 affected processes/modules.
- `AccountPage`: LOW, 0 direct callers, 0 affected processes/modules.
- `AccountLayout`: LOW, 0 direct callers, 0 affected processes/modules.

## Verification

- `npm run build` — PASS. `/` remained static with 5-minute revalidation; `/account` is dynamic.
- `npx playwright install chromium` — PASS.
- `npm run test:e2e:csp` — PASS, 2 tests.
- `npx vitest run proxy.test.ts lib/site-schema.test.ts lib/storefront-request-policy.test.ts lib/content-security-policy.test.ts` — PASS, 87 tests.
- `npm test` — PASS, 61 tests.

## Concerns

- The build still prints pre-existing local API `ECONNREFUSED` messages for breed/solution prerender fetches when the backend is not running; the build exits 0 and pages use their existing fallback behavior.
- Next.js emits a pre-existing `MODULE_TYPELESS_PACKAGE_JSON` warning for `tailwind.config.ts`.
- `npm install` reports 8 existing audit findings (1 low, 1 moderate, 6 high); no audit remediation was included because it is outside Task 5.
- The worktree contained unrelated pre-existing modifications. The Task 5 commit stages only the browser test/config, dependency metadata, narrow browser-discovered fixes, and this report.
- The installed GitNexus CLI has no `detect-changes` command, so exact change detection could not be executed. Pre-commit fallback checks used the staged path list plus fresh upstream impact analysis for the changed `proxy` and `AccountLayout` symbols; both remained LOW with no affected processes/modules.
