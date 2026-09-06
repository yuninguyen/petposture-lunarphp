# Task 3 Report: Split Public and Private CSP Policies

## Status

Implemented Task 3 in the `storefront-edge-cache-csp` worktree using test-driven development.

## Scope

Task 3 files changed:

- `frontend/lib/content-security-policy.ts`
- `frontend/lib/content-security-policy.test.ts`
- `.superpowers/sdd/2026-09-06-storefront-edge-cache-csp/task-3-report.md` (this required report)

No existing unrelated worktree modifications were edited or staged for the Task 3 commit.

## GitNexus impact analysis

Repository: `storefront-edge-cache-csp`

The index was stale at commit `52cb345` versus current commit `20818b6`, so it was refreshed with:

```text
npx gitnexus analyze . --skip-agents-md
```

Refresh result:

```text
Repository indexed successfully
14,994 nodes | 32,410 edges | 1847 clusters | 300 flows
```

Required upstream impact command:

```text
npx gitnexus impact buildContentSecurityPolicy --direction upstream --repo storefront-edge-cache-csp --depth 3
```

Result:

- Risk: LOW
- Direct graph dependents: 0
- Affected processes: 0
- Affected modules: 0

Repository text search separately found the live compatibility caller in `frontend/proxy.ts`. Task 3 therefore retains `buildContentSecurityPolicy(nonce)` as an alias to the private builder until Task 4 migrates that caller. The new symbols (`buildPublicContentSecurityPolicy`, `buildPrivateContentSecurityPolicy`, and `containsRequestNonce`) did not exist before the edit, so pre-edit impact lookup correctly returned “Target not found.”

Pre-commit GitNexus change detection was run through the GitNexus `detect_changes` tool endpoint with repository `storefront-edge-cache-csp` and scope `all` because the installed CLI does not expose `detect_changes` as a direct subcommand. Result:

- Changes detected across the pre-existing dirty worktree: 7 tracked files, 10 indexed symbols
- Affected execution flows: 0
- Overall risk: LOW
- Task 3 indexed symbol detected: `buildContentSecurityPolicy`

The broader file count includes unrelated pre-existing changes. Task 3 staging is restricted to the two CSP files and this report.

## TDD evidence

### RED

Created `frontend/lib/content-security-policy.test.ts` first and ran:

```text
npx vitest run lib/content-security-policy.test.ts
```

Expected failure observed:

```text
TypeError: buildPublicContentSecurityPolicy is not a function
Test Files 1 failed (1)
```

The failure was caused by the missing Task 3 exports.

### GREEN

Implemented the minimal production change and reran the focused suite:

```text
npx vitest run lib/content-security-policy.test.ts
```

Result:

```text
Test Files 1 passed (1)
Tests 5 passed (5)
```

A production-environment focused run also passed:

```text
$env:NODE_ENV='production'; npx vitest run lib/content-security-policy.test.ts
Test Files 1 passed (1)
Tests 5 passed (5)
```

## Implementation

- Added one internal `buildPolicy(scriptSource, styleSource)` assembler that accepts only the `script-src` and `style-src` variants.
- Added deterministic `buildPublicContentSecurityPolicy()`:
  - includes `script-src 'self' 'unsafe-inline'`;
  - includes `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`;
  - contains no nonce;
  - contains no `'strict-dynamic'`.
- Added `buildPrivateContentSecurityPolicy(nonce)` retaining nonce-based script/style sources and `'strict-dynamic'`.
- Added `containsRequestNonce(value)` to detect CSP nonce sources and HTML `nonce=` attributes without matching unrelated `nonce-value` text.
- Retained `buildContentSecurityPolicy(nonce)` as a temporary compatibility alias to the private policy.
- Preserved every existing approved script/frame/font origin and all existing restrictive directives. No origins were added.
- Preserved development-only `'unsafe-eval'`, `http:`, and `ws:` behavior and production-only `upgrade-insecure-requests` behavior.

## Verification

Focused Task 3 suite:

```text
npx vitest run lib/content-security-policy.test.ts
PASS: 1 file, 5 tests
```

Configured frontend suite:

```text
npm test
PASS: 3 files, 61 tests
```

Legacy CSP compatibility suite:

```text
node --test lib/content-security-policy.test.mjs
PASS: 2 tests
```

Diff hygiene:

```text
git diff --check -- frontend/lib/content-security-policy.ts frontend/lib/content-security-policy.test.ts
PASS (no output)
```

Additional repository-wide checks exposed pre-existing/non-Task-3 harness issues:

1. `npx tsc --noEmit` fails at `app/favicon.png/route.test.ts:45` because `Buffer<ArrayBufferLike>` is not assignable to `BodyInit`. This file is outside Task 3 and was not changed.
2. Unscoped `npx vitest run` executes Node `node:test` `.mjs` files as Vitest suites, producing 16 “No test suite found” failures (plus one existing alias-resolution failure in `lib/fetchApi.test.mjs`). The project’s configured `npm test` command and all Task 3/legacy CSP tests pass.

## Concerns / follow-up

- `frontend/proxy.ts` still consumes the compatibility alias by design. Task 4 must migrate it to select the public or private builder and can then remove the alias.
- `frontend/package.json` currently lists an explicit configured test set that does not include the new CSP test; Task 3’s required focused command was run directly. The package file is outside Task 3 scope and was not modified.
- The worktree remains dirty with unrelated prior-task changes. Only Task 3 paths are included in the Task 3 commit.

## Fix round 1

### Status

Addressed the Task 3 review findings with focused changes to the nonce detector and CSP tests.

### Impact before edit

The stale GitNexus index was refreshed at commit `b194c8e` with:

```text
npx gitnexus analyze . --skip-agents-md
```

The required upstream impact check used repository `storefront-edge-cache-csp`:

```text
npx gitnexus impact containsRequestNonce --direction upstream --repo storefront-edge-cache-csp --depth 3
```

Result:

- Risk: LOW
- Direct graph dependents: 0
- Affected processes: 0
- Affected modules: 0
- GitNexus context showed the focused CSP test file as the only incoming reference.

### TDD evidence

Added focused positive and negative cases before changing `containsRequestNonce`, then ran:

```text
npx vitest run lib/content-security-policy.test.ts
```

RED result:

```text
Test Files 1 failed (1)
Tests 6 failed | 13 passed (19)
```

The expected failures demonstrated false positives for `data-nonce`, `aria-nonce`, and CSP nonce values containing whitespace. Additional positive cases established that a CSP nonce source may occur in directives such as `default-src`, while an actual HTML `nonce` attribute follows HTML attribute syntax and may be empty or contain whitespace when quoted.

After the minimal implementation changes, the focused result was:

```text
Test Files 1 passed (1)
Tests 22 passed (22)
```

### Implementation

- CSP detection now tokenizes directives and accepts only complete quoted `'nonce-<base64-value>'` source tokens, rejecting malformed values containing whitespace.
- HTML detection now examines opening tags and matches only an actual whitespace-delimited `nonce` attribute, rejecting `data-nonce`, `aria-nonce`, `nonce-value`, and nonce-like prose.
- Origin-preservation tests now extract the `script-src` directive and assert approved script origins within that directive rather than anywhere in the policy.

### Verification

```text
npx vitest run lib/content-security-policy.test.ts
PASS: 1 file, 22 tests

npm test
PASS: 3 files, 61 tests

node --test lib/content-security-policy.test.mjs
PASS: 2 tests

git diff --check -- frontend/lib/content-security-policy.ts frontend/lib/content-security-policy.test.ts
PASS (no output)
```

The legacy Node test still emits the pre-existing module-type warning documented above; it has zero test failures.

Pre-commit GitNexus change detection was run through the local GitNexus tool endpoint with repository `storefront-edge-cache-csp` and scope `all`:

```text
Changes: 9 files, 13 symbols
Affected processes: 0
Risk level: low
```

The broad result includes unrelated pre-existing worktree changes. Task 3 symbols detected were `containsRequestNonce` plus test-local variables in `frontend/lib/content-security-policy.test.ts`; staging remains restricted to the two CSP files and this report.

### Concerns / follow-up

- `containsRequestNonce` intentionally validates CSP nonce source syntax more narrowly than HTML attribute value syntax: CSP nonce source values cannot contain whitespace, while quoted HTML nonce attribute values are still recognized as actual attributes.
- Unrelated worktree modifications remain present and must stay outside this fix commit.
