# Task 8 Measurement Gate Report

## Status

Implemented the bounded application cache because the fresh local HTTP measurements exceeded the explicit 100 ms gate and profiling showed repeated database work for site media.

## Measurement environment

- Worktree: `C:\laragon\www\petposture\.worktrees\storefront-edge-cache-csp`
- GitNexus repository: `storefront-edge-cache-csp`
- Endpoint address: `127.0.0.1:8001`
- Local runtime: PHP 8.3.30, Laravel 11.51.0
- Isolated SQLite database migrated from scratch; no production data or secrets were copied.
- Docker/VPS container runtime was unavailable locally, so `php artisan serve` was used on the required address.
- Ten HTTP requests were made for each endpoint. The first request is treated as cold; requests 2–10 are the warm sample.

## Before-change HTTP profile

### `GET /api/settings`

| Request | Status | Elapsed ms | Bytes |
|---:|---:|---:|---:|
| 1 | 200 | 281.554 | 462 |
| 2 | 200 | 204.565 | 462 |
| 3 | 200 | 209.614 | 462 |
| 4 | 200 | 252.286 | 462 |
| 5 | 200 | 202.952 | 462 |
| 6 | 200 | 256.754 | 462 |
| 7 | 200 | 214.193 | 462 |
| 8 | 200 | 255.761 | 462 |
| 9 | 200 | 351.656 | 462 |
| 10 | 200 | 278.052 | 462 |

- Cold: **281.554 ms**
- Warm median (requests 2–10): **252.286 ms**

### `GET /api/site-media?collection=banner`

| Request | Status | Elapsed ms | Bytes |
|---:|---:|---:|---:|
| 1 | 200 | 278.329 | 61 |
| 2 | 200 | 232.548 | 61 |
| 3 | 200 | 317.061 | 61 |
| 4 | 200 | 233.166 | 61 |
| 5 | 200 | 233.719 | 61 |
| 6 | 200 | 283.439 | 61 |
| 7 | 200 | 225.808 | 61 |
| 8 | 200 | 540.729 | 61 |
| 9 | 200 | 208.377 | 61 |
| 10 | 200 | 351.311 | 61 |

- Cold: **278.329 ms**
- Warm median (requests 2–10): **233.719 ms**

## Before-change non-public query instrumentation

The endpoints were dispatched directly through Laravel's HTTP kernel with `DB::listen`, ten times each.

- Settings query counts: **18 cold, then 1 per warm request**. The cold request performed 17 individual setting lookups plus Laravel's settings-table existence check. Per-setting `rememberForever` entries removed those lookups from later requests.
- Site-media query counts: **2 on every request**. Each request repeated the `site_media` collection query; the other query was Laravel's settings-table existence check. With populated records, MediaLibrary additionally loads media per `SiteMedia` model through `getMedia($collection)`.
- In-process warm medians were 1.328 ms (settings) and 1.405 ms (site media), demonstrating that the >100 ms HTTP result is substantially affected by local server/process overhead. The repeated site-media database work independently satisfies the gate.

## Gate conclusion

**Gate met.** Both HTTP warm medians were above 100 ms, and site media repeated its collection query on every request. Proceeding with the optional cache was justified by both branches of the brief's criterion.

## GitNexus safety evidence

The stale index was refreshed before exploration (`15400` symbols, `33069` relationships, `300` flows).

Pre-edit upstream impact:

- `SettingsController`: LOW, one direct upstream importer (`backend/routes/api.php`), zero affected processes.
- `SiteMediaController`: LOW, one direct upstream importer (`backend/routes/api.php`), zero affected processes.
- Exact controller `index` symbols were disambiguated with `gitnexus context`; each routes through `backend/routes/api.php`.
- `SettingCacheObserver`: LOW, one direct importer (`AppServiceProvider`), two total upstream files.
- `PublicContentCacheObserver`: LOW, four direct dependents, zero affected processes.
- `AppServiceProvider::boot`: LOW, no graph upstream callers.
- No HIGH or CRITICAL result occurred.

The installed GitNexus CLI has no `detect-changes` command. Before commit, equivalent graph detection was run with a GitNexus Cypher query over every changed source file. It mapped only the expected controller routes, observer/provider registration, settings resolver, and existing provider unit-test dependency; no execution process was reported.

## Implementation

- `public-api:settings:v1` caches the assembled settings data for five minutes.
- `public-api:site-media:v1:{collection}` caches assembled site-media data independently for five minutes.
- Setting save/delete invalidates the exact settings response key while retaining existing per-setting invalidation and public edge purge.
- SiteMedia save/delete invalidates only its collection key and retains the existing public edge purge observer.
- MediaLibrary media save/delete invalidates only the collection key when the media belongs to `App\Models\SiteMedia`.
- The JSON response wrapper, data fields, media URL generation, order, and HTTP status remain unchanged.

## After-change measurements

HTTP through `127.0.0.1:8001` with persistent file cache:

- Settings warm median (requests 2–10): **213.095 ms**; response remained 462 bytes.
- Site-media warm median (requests 2–10): **219.534 ms**; response remained 61 bytes.

The local single-process development server did not reach the optional `<100 ms` HTTP target. However, correctness changes are retained under Step 6 because query profiling proves reduced database work:

- Site-media query counts changed from **2 on every request** to **2 cold, then 1 per warm request**, eliminating the repeated `site_media` query after cache fill.
- Settings retains one framework settings-table existence query per request, but its assembled response cache prevents controller assembly and the per-key setting reads after fill.
- Post-change in-process warm medians: **1.269 ms** settings and **1.317 ms** site media.

## TDD and verification

RED evidence:

- The new settings test failed because `public-api:settings:v1` did not exist.
- The site-media tests failed because the collection cache did not exist and save did not invalidate it.

GREEN evidence:

```text
php artisan test tests/Feature/SettingsApiTest.php tests/Feature/SiteMediaApiTest.php
6 passed (33 assertions)
```

PHP syntax checks passed for both controllers, all three relevant observers, and `AppServiceProvider`.

`git diff --check` passed.

A full `php artisan test` run was attempted. It did not complete green because the pre-existing broader suite has unrelated failures, including session-cookie assertions in `AdminAuthTest` and an `AffiliateNetworkControllerTest` shape assertion. The Task 8 targeted tests remained green in a fresh rerun.

## Concerns

1. The local HTTP benchmark is dominated by Laravel's Windows development-server/process overhead, so it is not a VPS production-performance substitute.
2. The `<100 ms` post-change HTTP target was not met locally. The retained change is justified by measured query elimination, as explicitly permitted by Step 6.
3. The worktree already contained unrelated modified and untracked files. The Task 8 commit must stage only the files named in this report.
