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
