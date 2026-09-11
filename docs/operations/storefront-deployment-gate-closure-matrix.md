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

## Current status

- Local C2 connected-runtime acceptance is closed only for loopback fixture/fake-purge evidence.
- Whole-branch Critical/Important source review has accepted commit `0edeee2`.
- The deployment gate remains **NOT READY** until the target-runtime/release and Cloudflare-baseline gates above are evidenced.
- This document itself grants no production access or mutation permission.
