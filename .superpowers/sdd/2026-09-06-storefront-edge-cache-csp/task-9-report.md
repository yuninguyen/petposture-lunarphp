# Task 9 Report: Guarded Cloudflare Ruleset Tooling

## Status

Implemented Task 9 as offline-tested tooling only. No production Cloudflare mutation or live credential use occurred.

## Changes

- Added `scripts/cloudflare-storefront-rules.mjs` with `export`, `audit`, `apply-home`, and `restore` commands.
- Added fixture-driven Node tests in `scripts/cloudflare-storefront-rules.test.mjs` and `scripts/fixtures/cloudflare-cache-ruleset.json`.
- Added `cloudflare:cache-rules` and extended `test:storefront-cache-script` in `package.json`.

## Safety behavior

- Credentials are read only from `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ZONE_ID`; errors redact token/zone values and bearer credentials.
- `audit` matches exact rule descriptions `Cache HTML pages` and `Cache safe public catalog/content API GET endpoints (5 min edge TTL)`, prints expressions/evaluation order, and fails closed on missing, duplicate, or unscoped rules.
- `export` reads the live `http_request_cache_settings` entrypoint and writes a timestamped full ruleset artifact with SHA-256, ID, and version.
- `apply-home` requires a tool-created fresh export whose complete ruleset, ID, version, and hash match the just-read live ruleset. It updates the existing HTML rule in place (the smaller diff), adds exact homepage/host/method/query/cookie/prefetch constraints, and scopes the API rule in the same atomic PUT when needed.
- `apply-home` creates a fresh pre-apply rollback export before any possible PUT and saves the post-change API response.
- `restore` requires `--from-export` and `--confirm-restore`, and restores the exported rules in one PUT.
- Mutation commands default to dry-run. A PUT requires explicit `--execute`; successful apply/restore output requires a subsequent purge.
- Browser and edge TTL modes respect origin; the tool does not configure `override_origin` and therefore does not override origin `private`/`no-store` policy.

## TDD evidence

1. Initial test run failed with `ERR_MODULE_NOT_FOUND` because the implementation did not exist.
2. The smaller-diff transformation test was added and observed failing (`4 !== 3`) before changing the implementation to update the named HTML rule in place.
3. Final verification:
   - `node --test scripts/cloudflare-storefront-rules.test.mjs` — 10/10 passing.
   - `npm run test:storefront-cache-script` — 18/18 passing.
   - `node --check scripts/cloudflare-storefront-rules.mjs` — passing.
   - `node --check scripts/cloudflare-storefront-rules.test.mjs` — passing.
   - `git diff --check -- package.json scripts/cloudflare-storefront-rules.mjs scripts/cloudflare-storefront-rules.test.mjs scripts/fixtures/cloudflare-cache-ruleset.json` — passing.

## GitNexus

- Refreshed the stale `storefront-edge-cache-csp` index before implementation.
- New helper symbols had no pre-existing upstream dependants; adjacent storefront verifier impact was LOW (one test caller, zero affected execution flows).
- Pre-commit scoped change detection is recorded in the completion response.

## Concerns / operator notes

- This task deliberately did not call Cloudflare production APIs. Fixture tests validate request sequencing and payload safety, but a real operator must run `export` and `audit` with production environment credentials before any later apply.
- `artifacts/cloudflare` is intentionally runtime output and may contain complete ruleset configuration. Operators should store and handle those rollback artifacts securely and avoid committing them.
- After an executed apply or restore, a separate Cloudflare purge remains mandatory before storefront verification.

## Task 9 Fix Round 1

### Status

Fixed all load-bearing review findings in the Task 9 tooling. This round remained offline-only: no production Cloudflare network calls or mutations were performed.

### Safety fixes

- `auditRuleset()` now fails closed unless the named HTML rule exactly matches the normalized reviewed homepage expression, or is the explicitly recognized broad legacy candidate (which remains a FAIL until transformed). The API rule must exactly match the reviewed safe GET/path expression and `api.petposture.com` host scope; arbitrary host substrings and broadened expressions are rejected.
- Audit now detects earlier enabled `set_cache_settings` rules capable of matching `petposture.com` homepage traffic and reports a precedence conflict; disabled earlier rules are allowed.
- The homepage expression excludes the presence of Purpose, Sec-Purpose, Next-Router-Prefetch, RSC, Next-Router-State-Tree, and Next-Router-Segment-Prefetch headers; requires an empty query and exact `/` path; and uses cookie-name boundary regexes for `petposture-session`, `XSRF-TOKEN`, and `laravel_session`.
- Trusted exports now require a tool schema, live source marker, timestamp, and a present, well-formed, matching SHA-256. Restore requires the same ruleset ID as the fresh live GET, permits an older version only with explicit confirmation, and emits a stale-version warning.
- Mutation payload tests cover one PUT, exact rule order/refs/extra fields, and absence of `override_origin`. Post-PUT artifact failures now throw an unmistakable `MUTATION SUCCEEDED` error with the Cloudflare response and response artifact attached for durable recovery by the caller.
- Secret redaction also removes zone IDs from Cloudflare URLs. The zone redaction behavior is implemented rather than merely claimed.

### TDD and verification evidence

1. Expanded tests were first run against the missing `API_EXPRESSION` export and failed before implementation; the intentionally broadened precedence test was also observed failing before its fail-closed detection was implemented.
2. `node --test scripts/cloudflare-storefront-rules.test.mjs` — 17/17 passing.
3. `npm run test:storefront-cache-script` — 25/25 passing.
4. `node --check scripts/cloudflare-storefront-rules.mjs` and `node --check scripts/cloudflare-storefront-rules.test.mjs` — passing.
5. `git diff --check -- scripts/cloudflare-storefront-rules.mjs scripts/cloudflare-storefront-rules.test.mjs` — passing.

### Concerns

- The exact Cloudflare expression grammar for header-name arrays and case-insensitive cookie regexes must still be confirmed by a real operator against the account/API schema before any production apply; this round intentionally made no network request.
- Existing unrelated worktree modifications and generated files were left untouched and are excluded from the Task 9 commit.

## Task 9 Fix Round 2

### Status

Resolved the four round-2 findings with offline fixture coverage only. No Cloudflare network request or production mutation was made.

### Changes

- `apply-home` now accepts the exact broad legacy HTML candidate together with either the exact reviewed host-scoped API rule or its exact reviewed path-only predecessor. The tool scopes both named rules in the same request; broadened or otherwise unsafe API expressions still fail before a PUT.
- Earlier enabled cache rules now use a small fail-closed recognition set. Only exact known-safe static/API predicates are permitted; unknown, broad, path-only non-API, method-only, host-set, negated-API, and composite expressions block on precedence.
- Homepage cookie boundaries now emit Cloudflare raw regex literals exactly as `r"(?i)(^|;\s*)<cookie>="` for `petposture-session`, `XSRF-TOKEN`, and `laravel_session`.
- Added end-to-end fixture tests for dry-run and execute migration of broad HTML plus path-only API, asserting zero PUTs in dry-run, exactly one PUT in execute, both rules atomically scoped, and unsafe API rejection in both modes.
- Kept the specified prefetch/header minimum unchanged; `Next-Url` was not added.

### TDD and verification evidence

1. The new suite initially failed in three expected areas: combined legacy `apply-home`, safe earlier static precedence, and raw cookie regex grammar.
2. `node --test scripts/cloudflare-storefront-rules.test.mjs` — 19/19 passing.
3. `npm run test:storefront-cache-script` — 27/27 passing.
4. `node --check scripts/cloudflare-storefront-rules.mjs` and `node --check scripts/cloudflare-storefront-rules.test.mjs` — passing.
5. `git diff --check -- scripts/cloudflare-storefront-rules.mjs scripts/cloudflare-storefront-rules.test.mjs .superpowers/sdd/2026-09-06-storefront-edge-cache-csp/task-9-report.md` — passing (Git emitted only the worktree's existing LF-to-CRLF warnings).

### Concerns

- The precedence allowlist is intentionally exact and conservative rather than a boolean-expression parser. A newly introduced safe predicate will block until it is explicitly reviewed and added.
- Cloudflare grammar remains fixture-validated offline; an operator must still run the guarded export/audit process before any production execution.

## Task 9 Fix Round 3

### Status

Closed the remaining apply guard finding with offline end-to-end coverage. No Cloudflare network request or production mutation was made.

### Changes

- `auditRuleset()` now records earlier-rule precedence conflicts separately while retaining them in the fail-closed audit failures.
- `apply-home` permits transformation only when both named rules have exact reviewed or recognized legacy semantic statuses, both counts are exactly one, and `precedenceConflicts` is empty.
- Missing/duplicate named rules, unsafe named-rule semantics, and any earlier unknown/broad enabled cache rule fail before rollback/dry-run output or a PUT.
- Added end-to-end dry-run and `--execute` coverage for legacy HTML/API candidates preceded by an unknown broad enabled cache rule; both modes reject after the live GET and execute performs zero PUTs.
- Preserved the successful atomic migration path for the exact broad legacy HTML and path-only legacy API rules.

### TDD and verification evidence

1. The new end-to-end precedence test was observed failing with `Missing expected rejection` against the round-2 implementation.
2. `node --test scripts/cloudflare-storefront-rules.test.mjs` — 20/20 passing.
3. `npm run test:storefront-cache-script` — 28/28 passing.
4. `node --check scripts/cloudflare-storefront-rules.mjs` and `node --check scripts/cloudflare-storefront-rules.test.mjs` — passing.
5. `git diff --check -- scripts/cloudflare-storefront-rules.mjs scripts/cloudflare-storefront-rules.test.mjs` — passing (Git emitted only the worktree's existing LF-to-CRLF warnings).

### GitNexus

- Refreshed the stale index at commit `5ac7e92` before editing.
- Upstream impact for `runCommand` was LOW: two direct dependants and zero affected execution flows.
- Upstream impact for `auditRuleset` was LOW: three direct callers, one script module, and zero affected execution flows.

## Task 9 Fix Round 4

### Status

Completed the post-production tooling fixes with offline fixture coverage only. No Cloudflare mutation was made.

### Changes

- Added the exact deployed hostname-scoped, GET-only API expression to the finite reviewed semantics set. It preserves the existing allowlist for `/api/settings`, `/api/checkout/payment-methods`, `/api/categories`, `/api/blog/categories`, and the `/api/products`, `/api/brands`, and `/api/posts` prefixes.
- `auditRuleset()` and `apply-home` accept that exact live expression in addition to the existing reviewed expression; `apply-home` clones and preserves an already accepted live API rule unchanged.
- Added fail-closed tests for near-misses that add a path, permit an unsafe method, use the wrong host, or append an `or` broadening.
- Full-ruleset apply and restore PUT payloads now contain only writable top-level fields: `name`, `description`, `phase`, and `rules`. Response-only `kind`, `version`, and `last_updated` are omitted.
- Stock restore execute coverage now succeeds without the Task 11 in-memory adapter while preserving the exact exported rule array, evaluation order, refs, and extra rule fields.
- All existing export trust, identity/version/hash, precedence, confirmation, dry-run, mutation-result, rule-order, and origin-policy guards remain in place.

### TDD and verification evidence

1. The new focused suite was observed failing in four expected areas: live API acceptance/preservation, live API reviewed status, apply payload generation, and restore payload response-field omission.
2. `node --test scripts/cloudflare-storefront-rules.test.mjs` — 24/24 passing.
3. `npm run test:storefront-cache-script` — 32/32 passing.
4. `node --check scripts/cloudflare-storefront-rules.mjs` and `node --check scripts/cloudflare-storefront-rules.test.mjs` — passing.
5. `git diff --check` for the Task 9 files — passing, with only the worktree's existing LF-to-CRLF warnings.

### GitNexus

- The index was current at commit `495e3ed` before editing.
- Upstream impact remained LOW: `auditRuleset` had three direct dependants, `buildApplyRules` one, and `runCommand` two; no indexed execution flows were affected.
- The installed GitNexus CLI does not expose `detect_changes`; pre-commit change detection therefore used the current indexed impact results plus exact staged-path and staged-diff inspection.

### Concerns

- The protected VPS v5 export could not be read from this delegated runtime because SSH authentication was unavailable. The exact deployed path predicate was recovered from the repository's production rules backup and cross-checked against the Task 10/11 reports and current architecture documentation; the accepted form adds the Task 11-confirmed `api.petposture.com` host scope without changing that predicate.
- This round deliberately made no network mutation. A future operator must still use a fresh trusted export and the existing dry-run/execute gates.
