# Task 8 Measurement Gate Report

## Status

Round 1 retained **site-media assembled caching only**. The settings assembled-response cache was removed after review because the measured database work did not improve enough to justify that cache. Existing per-setting cache invalidation remains in place for both save and delete.

## Measurement environment and deviations

- Worktree: `C:\laragon\www\petposture\.worktrees\storefront-edge-cache-csp`
- GitNexus repository: `storefront-edge-cache-csp`
- Endpoint address: `127.0.0.1:8001`
- Environment: **Windows local development workstation**, PHP 8.3.30, Laravel 11.51.0.
- Database: **SQLite**, isolated local `storage/task8-profile.sqlite`, migrated from scratch; no production data or secrets were copied.
- Cache backend for the final HTTP run: local file cache, not production Redis.
- **VPS/container timing is absent.** Docker/VPS runtime was unavailable locally, so these measurements are not VPS evidence and must not be treated as VPS compliance.
- The initial benchmark attempt used a missing/unmigrated SQLite file and returned HTTP 500; that run is excluded from timing evidence. The final run used a freshly migrated database and returned HTTP 200 for all 20 requests.

## Before-change HTTP profile

The pre-fix profile from the original Task 8 implementation report was collected through the local Windows PHP development server at `127.0.0.1:8001`:

### `GET /api/settings`

- Requests: 10 total, status 200, 462 bytes each.
- Cold request: **281.554 ms**.
- Warm median (requests 2–10): **252.286 ms**.

### `GET /api/site-media?collection=banner`

- Requests: 10 total, status 200, 61 bytes each.
- Cold request: **278.329 ms**.
- Warm median (requests 2–10): **233.719 ms**.

## Before-change non-public query instrumentation

The original profile dispatched requests through Laravel's HTTP kernel with `DB::listen`:

- Settings: **18 queries cold, then 1 per warm request**. Per-setting `rememberForever` entries removed the individual setting lookups after the first request.
- Site media: **2 queries on every request**. The collection query repeated on every request; with populated records, MediaLibrary also loads media per `SiteMedia` model through `getMedia($collection)`.
- In-process warm medians were 1.328 ms (settings) and 1.405 ms (site media), showing that local HTTP timing is substantially affected by Windows development-server/process overhead.

## Review ruling and implementation

The review ruling was to retain only site-media assembled caching because measured database work did not improve enough to justify settings assembled caching.

- `SiteMediaController` continues to cache assembled payloads independently with `public-api:site-media:v1:{collection}` for five minutes.
- `SettingsController` now assembles the same response per request; `public-api:settings:v1` is no longer read or written.
- `SettingCacheObserver` continues to forget `setting:{key}` on save and delete and continues the existing public-content purge. It no longer invalidates the removed assembled settings key.
- `SiteMediaCacheObserver` invalidates both the original and current `collection` values on save/delete, so collection moves clear both endpoint cache keys safely.
- `SiteMediaLibraryCacheObserver` invalidates both the original and current `collection_name` values on Media save/delete, restricted to `SiteMedia` morphs. Non-SiteMedia media remains unaffected.
- The site-media response wrapper, fields, media URL generation, ordering, and HTTP status remain unchanged.

## Tests added or updated

- Settings tests verify that the assembled settings response is not cached and that deleting an existing setting invalidates its per-setting cache.
- Site-media tests verify distinct payloads and cache keys for `banner` and `general`, SiteMedia collection moves, Media collection moves, SiteMedia save/delete, and Media create/delete observer behavior.

TDD evidence:

- RED: the new no-settings-cache assertion failed against the assembled settings cache; both move tests failed because only the current collection key was invalidated.
- GREEN: after the minimal changes, the focused suite passed:

```text
php artisan test tests/Feature/SettingsApiTest.php tests/Feature/SiteMediaApiTest.php
11 passed (50 assertions)
```

## After-change HTTP evidence

Final run through the local Windows PHP development server at `127.0.0.1:8001`, using the freshly migrated isolated SQLite database and local file cache. All responses were HTTP 200 and retained the original response sizes.

### `GET /api/settings`

- 10 requests; 462 bytes each.
- Cold: **1869.352 ms**.
- Warm median (requests 2–10): **1586.667 ms**.

### `GET /api/site-media?collection=banner`

- 10 requests; 61 bytes each.
- Cold: **1556.039 ms**.
- Warm median (requests 2–10): **1395.486 ms**.

These are **Windows/SQLite local timings only**. They are not VPS measurements and do not establish VPS compliance. The local HTTP warm target of `<100 ms` was not met; the result is dominated by local PHP development-server/process overhead.

## After-change query evidence available

The focused Laravel tests verify the observable cache behavior and observer invalidation. The original non-public query instrumentation showed the settings branch's per-setting cache work and the repeated site-media query. In this fix round, no new VPS/production DB timing is available. The retained site-media cache is justified by the existing measured repeated collection/MediaLibrary work and by the regression tests proving the assembled collection payload is cached and correctly invalidated. The settings assembled cache was removed because the measured DB work did not demonstrate a sufficient improvement.

## GitNexus safety evidence

- GitNexus index was refreshed before exploration: **15,425 symbols, 33,136 relationships, 300 flows**.
- Pre-edit upstream impact for `SiteMediaCacheObserver`, `SiteMediaLibraryCacheObserver`, `SettingsController`, `SettingCacheObserver`, and `AppServiceProvider` was LOW; no HIGH or CRITICAL result occurred.
- Direct upstream dependencies were the provider registration and API route registration paths described by the refreshed index.
- The installed CLI does not expose a `detect-changes` subcommand. The available equivalent Cypher change-scope query mapped the six changed PHP files only to the expected API route, `AppServiceProvider`, observer namespace, and feature-test namespace; it reported no unexpected execution flow.

## Verification

- Focused Task 8 tests: **11 passed, 50 assertions**.
- Focused Task 8 plus existing public-content purge regression suite: **29 passed, 74 assertions**.
- PHP syntax checks passed for the changed settings controller and three observers.
- `git diff --check` passed.
- A fresh full backend run was started and reproduced unrelated pre-existing failures in `AdminAuthTest` session-cookie assertions and `AffiliateNetworkControllerTest` response-shape assertion. It was stopped after those known failures were confirmed; the focused Task 8 and purge suites remained green.

## Concerns

1. All timing evidence is from Windows local PHP + SQLite/file-cache execution. VPS/container/Redis timing and compliance remain unverified.
2. The final local HTTP warm medians are above 100 ms; this is not evidence to retain the removed settings assembled cache because the measured settings DB work was already largely eliminated by per-setting caching.
3. The worktree contains unrelated modified and untracked files. Only the Task 8 report, controllers/observers, and focused feature tests are eligible for this fix commit.
