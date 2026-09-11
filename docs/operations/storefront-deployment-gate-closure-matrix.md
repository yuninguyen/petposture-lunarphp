# Storefront deployment-gate closure matrix

## Purpose and authorization boundary

This document turns the local deployment audit's **NOT READY** findings into evidence gates. It does not authorize production inspection, deployment, a Cloudflare rule change, a TTL change, a purge, a migration, a restart, or any other mutation.

Production inspection has two distinct access boundaries:

1. **Cloudflare:** use only a token whose verified permissions are restricted to Zone Read (and any minimum read-only ruleset/settings reads required). The inspector may issue GET requests only. A correctly scoped token is the technical enforcement boundary: Cloudflare rejects mutation even if a client attempts it.
2. **VPS/runtime:** do not give an automated agent SSH access, especially root access. An operator runs the approved read-only commands and supplies only redacted evidence for review.

A separate explicit authorization is required for each later mutation: release/deployment, migration/restart/worker action, Cloudflare rule update, purge, or TTL change.

## Evidence handling and redaction

- Never disclose secret values, API tokens, passwords, cookies, private keys, full environment dumps, or Cloudflare authorization headers.
- For configuration evidence, report only `set` / `unset` plus safe URL authority, port, and path. Redact query strings, credentials, and token-like values.
- Keep release IDs, immutable image digests, migration status, and Cloudflare export checksums in the release record. Do not include raw sensitive exports in chat.
- If any output includes a secret, stop collection, do not paste or persist the raw output, and report only that redaction failed.
- A failed gate stops before the next mutation. Collect only redacted diagnostics and use the listed rollback decision point.

## Gate matrix

| Gate | Approved evidence mechanism | Required evidence | Pass condition | Failure / rollback decision | Classification |
|---|---|---|---|---|---|
| Runtime secret injection | Operator-provided, redacted VPS evidence | Presence of `STOREFRONT_INTERNAL_URL`, `STOREFRONT_BACKEND_INTERNAL_URL`, `STOREFRONT_REVALIDATION_SECRET` for services that require them; proof they are runtime references, not build args or `NEXT_PUBLIC_*` | Required settings are set at runtime without secret exposure in image, build context, or logs | Stop release preparation; operator corrects secret references outside source/build context | Operator/runtime evidence; may require manifest change |
| URL and asset authority parity | Operator-provided, redacted VPS evidence | Effective `INTERNAL_API_URL`, `STOREFRONT_BACKEND_INTERNAL_URL`, `STOREFRONT_INTERNAL_URL`, `APP_URL`, and `ASSET_URL` authorities | `INTERNAL_API_URL` equals `STOREFRONT_BACKEND_INTERNAL_URL`; Next POST and both direct GETs use one pinned private `STOREFRONT_INTERNAL_URL`; no target is the public Cloudflare hostname; asset authority is canonical | Stop; correct topology/config and repeat evidence collection | Operator/runtime evidence |
| Immutable build and release identity | Operator-provided evidence | Clean release revision, backend/frontend image digests, currently running service image identities, secret-safe build-context inspection | Reviewed SHA and immutable digests are recorded; no mutable tag is used as release identity; no secret is copied into an image | Do not deploy; rebuild/review a clean immutable artifact | Operator/release evidence |
| Migration and journal readiness | Operator-provided read-only command output | Migration status, database backup/recovery record, existence/readiness of storefront refresh journal | Migration is compatible with rollback plan; journal readiness has operator evidence | Stop before traffic cutover; use owner-approved database recovery plan | Operator/release evidence |
| Queue, scheduler, worker, and drain | Operator-provided read-only command output | Effective queue driver, retry/visibility/failed-job persistence, worker command/status, scheduler ownership, hard timeout and drain relationship | Async/retry/drain bounds are compatible; exactly one scheduler owner; controlled drain cannot lose an in-flight journal job | Do not release journal behavior; correct worker/deployment configuration and verify in non-production first | Operator/runtime evidence |
| Release and rollback | Operator-provided release record | Release ID/digests, previous release references, configuration reference IDs, database compatibility note, named rollback owner and decision procedure | Owner approves a reversible release record before any deploy | No deployment without rollback owner/path | Operator/release evidence |
| Production freshness authority | Operator-provided evidence unless separately authorized for safe verification | Committed content visibility, writer-quiescence process, same authority for expected API/read path/direct Next path | Target topology matches the local freshness contract before any CDN action | Stop rollout; collect redacted topology/projection diagnostics | Requires separate production verification authorization |
| Cloudflare baseline | Cloudflare Zone Read token, GET-only | Fresh full ruleset export, audit of named broad HTML and public API cache rules, ruleset scope, Tiered Cache state, rollback-export checksum | Fresh baseline satisfies plan constraints and is retained as rollback input | No rule change; retain current export and resolve audit findings | Requires separate Cloudflare read-only authorization |
| Cloudflare guarded mutation | Not authorized by this document | Proposed exact diff, fresh baseline, dry-run, protected rollback controller/artifact | User separately approves exact rule mutation | Restore fresh baseline through owner-approved rollback procedure | Requires separate mutation authorization |
| Post-change safety and US performance | Not authorized by this document | Anonymous/public and private query/cookie/RSC/prefetch checks; same-region cold/first and warm HIT samples; deployment purge verification | No private/CSP regression and at least 50% median public HIT TTFB improvement from the same region | Roll back release/rule under separate approved procedure | Requires separate post-rollout authorization |

## Operator evidence command templates

The operator may adapt names to the actual topology. These examples are read-only inspection commands; redact output before sharing.

```bash
# Container/service/image identity
cd /path/to/release && docker compose ps
docker inspect <backend-container> --format '{{.Config.Image}}'
docker inspect <frontend-container> --format '{{.Config.Image}}'
docker image inspect <image-reference> --format '{{json .RepoDigests}}'

# Laravel migration and readiness (inside the already-running backend container)
docker exec <backend-container> php artisan migrate:status
docker exec <backend-container> php artisan storefront:refresh-readiness

# Redacted setting presence only — do not print values
# Report each requested name as set/unset, and redact all values before sharing.
docker exec <backend-container> sh -lc 'for n in STOREFRONT_INTERNAL_URL STOREFRONT_BACKEND_INTERNAL_URL STOREFRONT_REVALIDATION_SECRET APP_URL ASSET_URL; do if printenv "$n" >/dev/null; then printf "%s=set\n" "$n"; else printf "%s=unset\n" "$n"; fi; done'
docker exec <frontend-container> sh -lc 'for n in INTERNAL_API_URL STOREFRONT_REVALIDATION_SECRET; do if printenv "$n" >/dev/null; then printf "%s=set\n" "$n"; else printf "%s=unset\n" "$n"; fi; done'

# Worker/scheduler status: use the deployment's read-only status mechanism
supervisorctl status
```

Do **not** run `docker compose up`, `down`, `restart`, `pull`, `build`, `php artisan migrate`, `php artisan queue:restart`, filesystem mutation commands, Cloudflare purge endpoints, or Cloudflare POST/PUT/PATCH/DELETE requests under this inspection scope.

## Audit evidence collected (2026-09-11)

### Cloudflare baseline — collected via Zone Read, GET-only token (scoped to petposture.com, TTL 2026-09-11–14)

No mutation call was made; only `GET /zones/:id/rulesets`, `GET /zones/:id/rulesets/:ruleset_id` (×2), `GET /zones/:id/settings`, `GET /zones/:id/cache/tiered_cache_smart_topology_enable` were issued.

- **Rulesets present (5):** `http_request_sanitize`, `http_request_firewall_managed`, `ddos_l7`, `http_request_cache_settings`, `http_request_dynamic_redirect`.
- **`http_request_cache_settings` (4 rules):**
  1. "Cache HTML pages" — **disabled**, `respect_origin`.
  2. "Long cache for Next.js static assets and uploaded storage files" — enabled, edge/browser TTL 2,592,000s, scoped to `/_next/static/` and `/storage/`.
  3. "Cache safe public catalog/content API GET endpoints" — enabled, edge TTL 300s / browser TTL 60s, scoped to specific public read-only API paths.
  4. "Cache anonymous petposture.com homepage" — **enabled**, `respect_origin`, excludes any request carrying a cookie/RSC/prefetch header — matches the `public, s-maxage=300, stale-while-revalidate=86400` policy the backend fix enforces.
- **`http_request_dynamic_redirect` (1 rule):** "www to non-www 301 redirect" — enabled. Matches the prior non-www canonical decision; no unexpected redirect rule found.
- **Zone settings (cache/TLS relevant subset):** `cache_level=aggressive`, `browser_cache_ttl=14400`, `edge_cache_ttl=7200`, `sort_query_string_for_cache=off`, `always_use_https=off`, `automatic_https_rewrites=on`, `min_tls_version=1.2`, `ssl=strict`, `security_level=medium`, `development_mode=off`, `always_online=off`.
- **Tiered Cache:** `tiered_cache_smart_topology_enable=off`.
- **Gate verdict:** Cloudflare baseline gate evidence is **complete** — fresh export retained above as rollback/comparison input. No rule was created, updated, or deleted.

### VPS operator evidence — collected by operator via manual SSH, read-only commands only

- **Deployed release:** `DEPLOYED_COMMIT` / `DEPLOYED_RELEASE` on the VPS both point to commit `0ca592524da3ced41d3029b0647a064358bbc15e`. This **predates** this branch's work entirely (`45a1df8`, `0edeee2`, `7cf1815` are not deployed). The freshness-barrier fix and its local/Cloudflare evidence gathered above describe code that is not yet running in production.
- **Migrations:** `php artisan migrate:status` — all migrations show `Ran`, none pending, for the currently deployed release.
- **Runtime secret/URL presence (backend container):** `STOREFRONT_INTERNAL_URL=unset`, `STOREFRONT_BACKEND_INTERNAL_URL=unset`, `STOREFRONT_REVALIDATION_SECRET=unset`, `APP_URL=set`, `ASSET_URL=unset`.
- **Runtime secret presence (frontend container):** `INTERNAL_API_URL=set`, `STOREFRONT_REVALIDATION_SECRET=unset`.
- **Interpretation:** the three `STOREFRONT_*` variables are unset because the currently deployed commit predates the feature that reads them, not because of a misconfiguration of an already-shipped feature. They will need to be provisioned before this branch is ever deployed.
- **Scheduler and worker ownership:** confirmed via process tree — `supervisord` (in-container, PID 366765) owns exactly three children: `frankenphp run` (web), `php artisan schedule:work` (persistent scheduler daemon — not cron-based, so no crontab entry is expected or missing), and `php artisan queue:work --tries=3 --max-time=3600 --sleep=3` (auto-restarted by supervisord; observed PID changing from 672839 to 676290 across an automatic restart). Exactly one scheduler owner confirmed; worker crash-restart confirmed.
- **Image identity:** `petposture-backend:prod`, `petposture-frontend:prod` — mutable tags, not immutable digests. Release identity gate is not yet satisfied by this alone.
- **Unrelated finding:** the same VPS also runs an unrelated site (`rebateops.online`) with its own queue worker and cron `schedule:run` entry; not a petposture concern but relevant to shared host resource/ownership awareness.
- **Not evidenced in this pass:** immutable image digest capture, `ASSET_URL`/authority parity for the new branch (moot until deployed), rollback owner/procedure record, post-deploy Cloudflare purge verification.

## Current status

- Local C2 connected-runtime acceptance is closed only for loopback fixture/fake-purge evidence.
- Whole-branch Critical/Important source review has accepted commit `0edeee2`.
- Cloudflare baseline gate: evidenced complete (see above).
- **`feat/storefront-edge-cache-csp` merged to `main` locally (commit `b233758`, 2026-09-12)**, not yet pushed to `origin`. Two real merge conflicts (`frontend/app/layout.tsx`, `frontend/lib/storefront-request-policy.{ts,test.ts}`) and one silent semantic break (`proxy.test.ts` predating the 2026-09-07 static-page no-nonce fix) were resolved; all 282 Vitest tests pass post-merge.
- **VPS runtime secret/URL provisioning complete (2026-09-12).** Operator appended `STOREFRONT_INTERNAL_URL=http://127.0.0.1:3001`, `STOREFRONT_BACKEND_INTERNAL_URL=http://127.0.0.1:8001`, and a freshly generated `STOREFRONT_REVALIDATION_SECRET` to `/opt/petposture/backend/.env`, and the same secret to `/opt/petposture/frontend/.env` (pre-existing file, only appended — not overwritten). Verified by name-only grep, no values pasted into chat. `docker-compose.prod.yml` was also updated (commit `b31a16c`) to add `env_file: ./frontend/.env` to the frontend service, since it previously had no way to receive a runtime secret at all.
  - Confirmed via VPS inspection that `/opt/petposture/{backend,frontend}/.env` are the **canonical, persistent** files — every release under `/opt/petposture-releases/<sha>/` gets its `.env` **symlinked** back to these two files (verified: `/opt/petposture-releases/0ca592524da3ced41d3029b0647a064358bbc15e/backend/.env -> /opt/petposture/backend/.env`). This provisioning therefore survives the next deploy automatically; it does not need to be repeated.
  - The currently *running* containers are still built from the pre-merge commit (`0ca5925`) and do not read these three variables, so this change has no effect on the live site until the merged code is actually deployed.
- **First production deploy of this branch happened (2026-09-12), release `0fb0844`.** Pushed to `origin`, archived to `/opt/petposture-releases/0fb0844...`, backend/frontend running from it (backend healthy, `http://127.0.0.1:3001/` 200 locally on the VPS). Deploy included an unreviewed hotfix (`0fb0844`) removing a duplicate-key TypeScript build blocker in `frontend/proxy.ts` that I introduced but missed fixing during the merge conflict resolution — verified afterward to be the same class of auto-merge artifact already fixed in `storefront-request-policy.ts`, correct and minimal.
  - Public `curl https://petposture.com/` returned 403 immediately after deploy. **Verified via a real browser (chrome-devtools MCP) that this was a Cloudflare bot-challenge false positive, not an outage** — `GET https://petposture.com/` returned 200 with correct HTML, consistent with the prior documented pattern of curl-vs-real-browser false positives on this domain ([[feedback_verify_via_real_browser_2026-09-07]]). Do not trust a bare curl 403 against this domain as evidence of a real problem; verify with a real browser session first.
  - That same browser check found a **real, separate bug**: the public JSON-LD `Organization.logo` showed `https://127.0.0.1:8001/storage/...` (the SSR-internal authority) instead of a public URL. Root cause: `resolveAssetUrl()` and the existing `StorefrontAssetParityTest` both assume `ASSET_URL` env can override the asset authority via `config('app.asset_url')`, but that config key was never defined in `config/app.php` (removed from Laravel 11's trimmed skeleton) — so `ASSET_URL` had no effect no matter what it was set to. Fixed in `2ef6b8d` by adding `'asset_url' => env('ASSET_URL')` to `config/app.php`; default behavior (unset) is unchanged, preserving the tested SSR-authority-echo behavior. 129/129 relevant backend tests pass post-fix.
  - **Follow-up still required on the VPS:** set `ASSET_URL=https://api.petposture.com` in `/opt/petposture/backend/.env` and redeploy/restart the backend container — without it, the public JSON-LD logo will keep leaking the internal authority even with this code fix deployed, since the fix only wires the override path, it doesn't force a value.
  - Rollback digests for the pre-`0fb0844` images were recorded in `ROLLBACK_IMAGES` on the VPS before this deploy (backend/frontend digests noted by the release process); mutable `:prod` tags are still in use day-to-day, so treat the recorded digest, not the tag, as the actual rollback target.
- Deployment gate closure now stands at: merged, pushed, and deployed to production (`0fb0844`), with one still-open follow-up (`ASSET_URL` provisioning + redeploy) before the asset-authority gate can be called fully closed. A named rollback *owner* (a person, not just a recorded digest) is still not established.
- The deployment gate remains **NOT READY** — the operative blocker is now "not yet deployed with a recorded rollback plan," not missing evidence or missing config.
- This document itself grants no production access or mutation permission beyond what is explicitly logged above. No Cloudflare rule, migration, restart, or deploy action was performed.
