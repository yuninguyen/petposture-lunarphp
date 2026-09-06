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

## Production provenance check (2026-09-06T19:18:09.460Z)

Read-only fresh production evidence was obtained from the live Cloudflare `http_request_cache_settings` entrypoint. Credentials were sourced only inside a non-tracing VPS process from `/opt/petposture/backend/.env`; no token, zone ID, cookie, or secret value was printed or stored. No apply, PUT, purge, or source edit was performed as part of the production check.

- Fresh ruleset version: `5`
- Total rules: `3`
- Exact named-rule count for `Cache safe public catalog/content API GET endpoints (5 min edge TTL)`: `1`
- Live expression SHA-256: `7d8150a31baeda7b3d3453bb3b2c949187f6f686f3eff9988250943bba1bded9`
- Exported `LIVE_API_EXPRESSION` SHA-256: `6b6d08e1e847452c015549048caa1b80dcfdd0e97775f77639044a53d051d9a9`
- Byte-for-byte equality: `false`
- Normalized-whitespace equality: `false`
- Verdict: **MISMATCH**

The live rule remains host-scoped to `api.petposture.com`, method-scoped to `GET`, enabled, and uses `set_cache_settings`. Its exact paths are `/api/settings`, `/api/site-media`, `/api/checkout/payment-methods`, `/api/categories`, and `/api/blog/categories`; its prefixes are `/api/products`, `/api/brands`, `/api/posts`, `/api/breeds`, and `/api/solutions`. Compared with the current exported constant, production has exactly three additional allowlist entries: exact `/api/site-media`, prefix `/api/breeds`, and prefix `/api/solutions`. No current exported path was absent from production.

The live API rule fields are `action`, `action_parameters`, `description`, `enabled`, `expression`, `id`, `last_updated`, `ref`, and `version`. The non-expression fields remain compatible with the clone-preservation behavior of `buildApplyRules`; an accepted API rule is preserved field-for-field, including response metadata and action parameters. However, invoking `buildApplyRules` against this fresh live ruleset fails closed before producing an apply rules array because the live expression is outside the finite reviewed set. Existing settings are unchanged: browser TTL is `override_origin` with 60 seconds, edge TTL is `override_origin` with 300 seconds, and `cache` is `true`.

## Task 9 Fix Round 4 follow-up (fresh provenance correction)

### Status

Updated the reviewed live API expression and captured production fixture to the exact fresh v5 expression from the read-only production provenance above. No Cloudflare mutation, PUT, purge, or subagent activity occurred.

### Changes

- `LIVE_API_EXPRESSION` now preserves the authoritative live condition order and parentheses while adding exactly `/api/site-media`, `/api/breeds`, and `/api/solutions`.
- The captured production fixture stores the exact live API rule fields needed to verify byte-for-byte preservation by `buildApplyRules`; writable PUT sanitation remains unchanged.
- Added a SHA-256 assertion pinning the captured expression to authoritative hash `7d8150a31baeda7b3d3453bb3b2c949187f6f686f3eff9988250943bba1bded9`.
- Near-miss coverage now rejects removing or adding each of the three newly confirmed endpoint entries, plus method broadening, host broadening, and an appended `or` broadening.

### TDD and verification evidence

1. The provenance hash test first failed with the prior constant hash `6b6d08e1e847452c015549048caa1b80dcfdd0e97775f77639044a53d051d9a9`, and the near-miss suite first accepted the expression missing the three newly confirmed entries.
2. After the minimal expression/fixture update, `node --test scripts/cloudflare-storefront-rules.test.mjs` passed 25/25.
3. `npm run test:storefront-cache-script` passed 33/33.
4. `node --check` passed for both Task 9 script files, and `git diff --check` passed for the Task 9 files/report (with only existing LF-to-CRLF warnings).

### Fresh-source provenance

- Source: read-only live Cloudflare `http_request_cache_settings` export from the protected VPS, as recorded above.
- Fresh ruleset version: `5`; exact named API rule count: `1`.
- Authoritative exact live expression SHA-256: `7d8150a31baeda7b3d3453bb3b2c949187f6f686f3eff9988250943bba1bded9`.
- Confirmed exact additions relative to the prior constant: `/api/site-media` (exact), `/api/breeds` (prefix), `/api/solutions` (prefix).
- No credentials, tokens, zone IDs, Cloudflare writes, or production mutations were performed during this follow-up.

## Task 9 Fix Round 5/5 — final breaker round

### Status

Closed the two remaining production blockers using fresh read-only v5 evidence and account-specific non-mutating Cloudflare error evidence. No Cloudflare PUT, apply, restore, purge, or other production mutation was performed in this fix turn.

### Fresh live v5 provenance

- Source: protected VPS `root@51.79.54.208`, with Cloudflare credentials sourced only inside a non-tracing shell process from `/opt/petposture/backend/.env`.
- Transport: authenticated GET of the `http_request_cache_settings` entrypoint only. The temporary response file was mode `0600` and removed by a shell trap.
- No API token, zone ID, cookie, or secret value was printed, copied into the worktree, or included in command output.
- Fresh ruleset: ID `eebfd01b68fb4427b8afc5174faa468f`, version `5`, name `default`, empty description, three rules.
- Exact disabled `Cache HTML pages` expression:

  ```text
  (http.host eq "petposture.com") and (not starts_with(http.request.uri.path, "/api/")) and (not starts_with(http.request.uri.path, "/account")) and (not starts_with(http.request.uri.path, "/cart")) and (not starts_with(http.request.uri.path, "/checkout")) and (not starts_with(http.request.uri.path, "/sign-in")) and (not starts_with(http.request.uri.path, "/sign-up")) and (not starts_with(http.request.uri.path, "/returns")) and (not starts_with(http.request.uri.path, "/admin"))
  ```

- Exact expression SHA-256: `cf3920616575be3acb242523a918646cb76dd854a28721e1670731d492bc8a88`.
- Exact live HTML rule object fields captured in the fixture: `action`, `action_parameters`, `description`, `enabled`, `expression`, `id`, `last_updated`, `ref`, and `version`. It is disabled, uses `set_cache_settings`, respects origin browser TTL, and uses edge `bypass_by_default`.
- The live API rule remains byte-for-byte pinned to SHA-256 `7d8150a31baeda7b3d3453bb3b2c949187f6f686f3eff9988250943bba1bded9` and is preserved unchanged by the proposed apply.

### Writable entrypoint PUT schema evidence

The sanitizer is based on this account's actual non-mutating failure sequence, not on inferred response fields:

1. Task 11's first stock full-entrypoint restore request included the GET response's top-level `kind`; Cloudflare rejected the request with HTTP 400 before mutation. Removing response-only top-level fields allowed the guarded adapter path to proceed.
2. The reviewed retry then sent `name`, `description`, `phase`, and `rules`; Cloudflare again rejected the stock request non-mutating, this time specifically for top-level `phase`.
3. The same guarded request succeeded only after the adapter removed `phase`, leaving `name`, `description`, and `rules` unchanged.

Therefore the account-proven writable full-entrypoint body is exactly `name`, `description`, and `rules`. The shared `buildMutationRequest()` helper is now used by both `apply-home` and stock `restore`; it excludes `id`, `kind`, `version`, `last_updated`, `phase`, and any other response-only top-level field. Rule objects themselves remain cloned exactly except for the reviewed HTML transformation.

### Implementation and fixture

- Added the exact live disabled legacy HTML expression as one finite recognized candidate, separately SHA-pinned. Whitespace normalization remains the existing comparison behavior, but no path, host, boolean, or allowlist near-miss is accepted.
- `apply-home` transforms that exact disabled candidate in place to `HOME_EXPRESSION`, enables it, preserves its `id`, `ref`, position, description, version metadata, and other fields, and applies the reviewed cache settings.
- Added `scripts/fixtures/cloudflare-cache-ruleset-live-v5.json`, representing the complete fresh v5 entrypoint response with the exact HTML and API rules plus the intervening static/storage rule.
- The fixture dry-run proves one changed rule only: rule index 0, `Cache HTML pages`; changed keys are `enabled`, `expression`, and `action_parameters`. API and intervening rule objects are byte-for-byte preserved, as are all refs and evaluation order.
- Added fail-closed near-miss tests for omitted exclusions, changed paths, broadened hosts, and appended boolean broadening.

### TDD and verification evidence

1. The new suite first failed at module load because `LIVE_LEGACY_HTML_EXPRESSION` was not exported.
2. After adding the exact candidate and sanitizer, the focused suite passed; a separate activation test was then made strict and observed failing because the live disabled rule remained `enabled: false`. The minimal implementation now sets `enabled: true` during the reviewed in-place transformation.
3. `node --test scripts/cloudflare-storefront-rules.test.mjs` — 28/28 passing.
4. `npm run test:storefront-cache-script` — 36/36 passing.
5. `node --check scripts/cloudflare-storefront-rules.mjs` and `node --check scripts/cloudflare-storefront-rules.test.mjs` — passing.
6. Safe fixture dry-run summary: request keys exactly `name`, `description`, `rules`; one changed rule; HTML changed keys exactly `enabled`, `expression`, `action_parameters`; API preserved; order preserved.

### GitNexus

- The existing index was stale at `5648f89`; `npx gitnexus analyze` updated the generated instruction metadata/graph even though the Windows CLI exited with its known unsigned `4294967295` code. No generated GitNexus files are included in this Task 9 commit.
- Pre-edit upstream impact was LOW: `auditRuleset` had three direct dependants and zero affected processes; `buildApplyRules` one direct test dependant and zero processes; `runCommand` two direct dependants and zero processes; `replaceBroadHtmlRule` one direct caller and zero processes.
- Pre-commit change-scope verification is recorded in the final response.

### Concerns

- This round proves tool behavior and the exact request shape from read-only live state plus prior account-specific rejected/successful restore evidence. It intentionally does not prove a new live PUT because production mutation was forbidden.
- The older synthetic broad HTML candidate remains separately recognized for historical fixture compatibility; the newly added production candidate is exact and finite, and near misses fail closed.
