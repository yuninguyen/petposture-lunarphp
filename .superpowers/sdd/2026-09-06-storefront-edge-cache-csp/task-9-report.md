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
