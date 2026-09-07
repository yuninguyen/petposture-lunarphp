# Task 2 Report — Single Storefront Request Policy Classifier

## Status

GREEN for the Task 2 classifier and the full configured frontend unit-test suite. The classifier is a pure exported function with the exact Task 2 request/response interfaces and cache-control constants, ready for Task 4 to consume as the single source of truth.

## Implemented Files

- `frontend/lib/storefront-request-policy.ts`
  - Exports `StorefrontPolicy` and `StorefrontRequestFacts` exactly as specified.
  - Exports the exact public and private HTML `Cache-Control` constants.
  - Uses the explicit phase-1 public path set containing only `/`.
  - Classifies by exact host, case-insensitive safe method, any query string, exact sensitive-cookie token, visible prefetch signals, and explicit path allowlist.
  - Returns stable reasons: `wrong-host`, `unsafe-method`, `query-string`, `sensitive-cookie`, `prefetch`, `not-allowlisted`, and `allowlisted`.
- `frontend/lib/storefront-request-policy.test.ts`
  - Covers the exact phase-1 allowlist, all required query bypass examples, sensitive cookies, visible prefetch signals, host mismatches, GET/HEAD casing, unsafe methods, private prefixes, cookie boundaries, and exact cache constants.
- `frontend/package.json`
  - Adds `lib/storefront-request-policy.test.ts` to the committed frontend unit-test command. The worktree's pre-existing unstaged `lib/api.test.ts` script addition remains preserved in the working copy but is intentionally excluded from the Task 2 commit.

## TDD Evidence

### RED

Command:

```text
cd frontend
npx vitest run lib/storefront-request-policy.test.ts
```

Result: failed before production code existed because `./storefront-request-policy` could not be found. This was the expected missing-module failure.

### GREEN

After installing dependencies from the existing lockfile with `npm ci`:

```text
npx vitest run lib/storefront-request-policy.test.ts
```

Result: 1 test file passed; 41 tests passed; 0 failed, using the lockfile version Vitest 4.1.11.

```text
npm test
```

Result: 3 test files passed; 53 tests passed; 0 failed:

- `app/favicon.png/route.test.ts`: 11 passed
- `lib/api.test.ts`: 1 passed
- `lib/storefront-request-policy.test.ts`: 41 passed

```text
npx eslint lib/storefront-request-policy.ts lib/storefront-request-policy.test.ts
```

Result: exit 0 with no output.

```text
git diff --check -- frontend/package.json frontend/lib/storefront-request-policy.ts frontend/lib/storefront-request-policy.test.ts
```

Result: exit 0 with no whitespace errors.

## Additional Verification and Known Existing Failure

```text
npx tsc --noEmit
```

Result: exit 1 because of a pre-existing type error in `frontend/app/favicon.png/route.test.ts:45`: `Buffer<ArrayBufferLike>` is not assignable to `BodyInit`. Task 2 files produced no reported TypeScript errors. Fixing this unrelated existing test is outside Task 2's allowed files.

`npm ci` did not modify `frontend/package-lock.json`. NPM reported 8 dependency audit findings (1 low, 1 moderate, 6 high); dependency upgrades/audit fixes are outside Task 2 and were not applied.

## GitNexus Impact and Scope Evidence

- The initial pre-edit query for the new `classifyStorefrontRequest` symbol returned `target not found`, as expected for a new file; therefore it had no indexed callers or execution flows.
- GitNexus reported its shared index stale, so `npx gitnexus analyze` refreshed the worktree index before final impact review.
- Refreshed upstream impact for `classifyStorefrontRequest`: LOW risk, 0 impacted production symbols, 0 affected processes, and 0 affected modules. Context showed only the new unit-test file as an incoming reference.
- Refreshed upstream impact for `hasSensitiveCookie` and `isPrefetchValue`: LOW risk; each has exactly one direct caller (`classifyStorefrontRequest`) and no affected execution processes.
- The installed GitNexus CLI provides `impact`, `query`, and `context`, but no `detect_changes` command. The required pre-commit change-scope check was therefore performed with the refreshed index impact/context results plus explicit Git path/diff inspection.
- Only the two new classifier files, the Task 2 portion of `frontend/package.json`, and this required report are included in the Task 2 commit. Pre-existing unrelated worktree modifications remain unstaged and uncommitted.

## Requirement Review

- Exact public host only: yes (`petposture.com`, case-sensitive exact match).
- GET and HEAD accepted case-insensitively: yes.
- Every non-empty query string bypassed: yes.
- Sensitive cookies parsed on semicolon boundaries, trimmed, and matched by exact name before the first `=`: yes.
- Sensitive-cookie matching preserves exact production name casing: yes.
- Purpose and Sec-Purpose `prefetch` values handled case-insensitively: yes.
- Any visible `Next-Router-Prefetch` header value bypasses: yes.
- Phase-1 allowlist contains only `/`: yes.
- Stable reasons returned: yes.
- Prior frontend test interfaces preserved: yes; the Task 2 commit adds its test without removing the existing favicon test, while the separate unstaged API test entry remains intact in the working copy.
- Lockfiles unchanged: yes.

## Fix Round 1 Evidence

- Review finding reproduced with focused regression cases for non-null `Purpose`, `Sec-Purpose`, and `Next-Router-Prefetch` values: arbitrary `navigate`, composite `prefetch;prerender`, and empty string. Before the fix, the six `Purpose`/`Sec-Purpose` cases failed while `Next-Router-Prefetch` already passed.
- Root cause: `isPrefetchValue` only returned true for a trimmed, case-insensitive exact `prefetch` value, so arbitrary and empty visible `Purpose`/`Sec-Purpose` values were incorrectly cacheable.
- Fix: `isPrefetchValue` now returns `value !== null`, making every visible non-null signal private while preserving null as absent.
- Focused TDD RED: `npx vitest run lib/storefront-request-policy.test.ts` failed 6 of 49 tests before the production fix.
- GREEN: the focused suite passed 49/49 tests after the fix; the configured frontend suite passed 61/61 tests across 3 files.
- Changed-file lint passed with `npx eslint lib/storefront-request-policy.ts lib/storefront-request-policy.test.ts`; `git diff --check` passed for the classifier files.
- Pre-edit and pre-commit GitNexus impact for `isPrefetchValue`: LOW risk, one direct caller (`classifyStorefrontRequest`), zero affected processes. `classifyStorefrontRequest` itself has one direct test caller and zero affected processes.
- The installed GitNexus CLI has no `detect_changes` command. Equivalent scope verification via `git diff --name-only` showed only the two classifier fix files plus unrelated pre-existing worktree changes; only the two classifier files and this report are staged for the fix commit.

## Concerns

1. Full-project frontend typecheck remains red due solely to the existing favicon route-test `Buffer`/`BodyInit` mismatch noted above.
2. `npm ci` reports 8 existing dependency vulnerabilities; no lockfile or dependency version changes were made.
3. Task 4 must map request headers into this deliberately narrow facts interface. Hidden Next.js navigation headers remain an integration/Cloudflare-verification concern described by the design, not a Task 2 classifier input.
