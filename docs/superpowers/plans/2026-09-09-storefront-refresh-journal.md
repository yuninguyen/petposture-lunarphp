# Storefront Refresh Journal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make committed storefront refresh snapshots durably recoverable after successful journal recording, without replacing saved responses or original exceptions on infrastructure failure.

**Architecture:** One table on the existing Laravel database, accessed using an independent primary autocommit PDO, records immutable committed-only snapshots. The existing coordinator/job owns journal-first handoff and fenced attempts; a bounded command resubmits unfinished work without trusting enqueue acknowledgement. This is one coherent integration task with one parent acceptance boundary, not independently shippable storage/observer/queue fragments.

**Tech Stack:** PHP, Laravel 11.51.0, Eloquent/query builder, existing database queue, Artisan, PHPUnit, Livewire/Filament, GitNexus LocalBackend.

**Spec:** `docs/superpowers/specs/2026-09-09-storefront-refresh-journal-design.md` (read completely before execution).

## Global Constraints

- Worktree: `C:\laragon\www\petposture\.worktrees\storefront-edge-cache-csp`; original base `982e66ec3a6361c7382654e8c6aa320a20aada63`.
- This plan was requested after implementation commit `c5ba25ef3b85fdfbde53b19b7c13949927f0b955`; it is a prospective completion/correction plan, not evidence that planning preceded that commit. Existing implementation must be audited against every unchecked step.
- No production calls/deploy/purge; test migrations only on isolated databases. Preserve dirty overlays. Do not change global queue/Redis/session configuration.
- Run upstream GitNexus impact before every edited existing symbol; warn HIGH/CRITICAL. Run actual staged LocalBackend `detect_changes` before every code commit.
- “Content commit and the independent journal insert are two commits.” Never describe this as a transactional outbox or promise recovery for unrecorded mutations.
- “Delivery/execution is at least once, not exactly once. Finite attempts do not guarantee eventual refresh success.”
- Four recovery attempts, `[30,120,300]` backoff; optional initial HTTP attempt does not consume that budget. Lease120 seconds; worker timeout60 seconds, existing queue visibility90 seconds; deployment must verify all hard/network/DB bounds fit.
- Command `storefront:refresh-replay --limit=100 --max-seconds=20`; register minute invocation in existing Laravel scheduler (`backend/routes/console.php`), with operator verification of scheduler ownership at activation. At most100 selected unfinished records and100 completed-only cleanup rows; seven-day completed retention. Never automatically delete/reset exhausted or unfinished records.
- Critical recording-failure copy: “Content saved; cache refresh recovery could not be recorded. Automatic retry is not guaranteed; operator action is required.”
- Preserve `X-PetPosture-Cache-Warning: purge-pending`; critical API-only addition `X-PetPosture-Cache-Recovery: unavailable`. Web/Livewire must distinguish recovery unavailable without claiming retries or adding API headers.
- C0 remains edge-only; independent current committed reads/Next invalidation/verified warm/full-chain deployment belong to C1/C2. No activation until these prerequisites and operator monitoring are reviewed.

---

## File responsibilities

- `backend/database/migrations/2026_09_09_000001_create_storefront_refresh_journal_table.php`: schema/indexes only.
- `backend/app/Models/StorefrontRefreshJournalEntry.php`: metadata inspection/casts, not state authority.
- `backend/app/Services/StorefrontRefreshJournal.php`: validation, dedicated connection, immutable insert, claims/fenced updates, transport throttle, replay/retention.
- `backend/app/Console/Commands/ReplayStorefrontRefresh.php`: bounded CLI invocation, sanitized failure exit.
- `backend/app/Services/PublicContentPurgeCoordinator.php`: connection-owned committed snapshots and journal-first final handoff.
- `backend/app/Jobs/PurgeCloudflareCache.php`: legacy compatibility or one claimed journal attempt, mandatory per-key eviction, persisted result, existing Laravel retries.
- `backend/app/Observers/{SettingCacheObserver,SiteMediaCacheObserver,SiteMediaLibraryCacheObserver}.php`: snapshot/register before guarded early eviction.
- `backend/app/Support/CloudflarePurgeNotice.php`: result/severity only; sticky recovery-unavailable severity.
- `backend/app/Http/Middleware/AttachCloudflarePurgeWarning.php`: finally completion/original outcome and truthful scoped warnings.
- `backend/tests/Feature/{StorefrontRefreshJournalTest,StorefrontJournalFailureTest,StorefrontRefreshRoutedLifecycleTest,StorefrontRefreshTransactionTest,CloudflarePurgeWarningMiddlewareTest}.php`: durable DB/fault/actual boundary/compatibility evidence.
- `.superpowers/sdd/2026-09-09-storefront-cache-v16-hardening-addendum/task-C0-journal-report.md`: exact evidence, gaps, commit and parent handoff.

### Task 1: Complete and verify the coherent durable journal integration

**Files:** All exact paths above; retain existing mutation/public-content/API/Filament tests. No unrelated frontend/configuration changes.

**Interfaces:**

```php
// App\Services\StorefrontRefreshJournal
public const CONNECTION = 'storefront_refresh_journal';
public function record(array $keys, ?string $id = null): string;
public function find(string $id): ?object;
public function claim(string $id, bool $initial = false): ?object;
public function finish(string $id, string $token, bool $success, string $status): bool;
public function dispatch(string $id): ?bool; // false infrastructure failure, true submitted, null deferred/not due (none means completion)
public function replay(int $limit = 100, int $maxSeconds = 20): int;
public function replayDispatchFailures(): int; // last replay only; count reset at every invocation
public function replaySummary(): array; // exact selected/submitted/deferred/failed integer counts; reset per replay
// Returned row: id:string, cache_keys:list<string>, state:string,
// recovery_attempts:int, initial_attempted:bool, lease_token:?string,
// lease_expires_at:?timestamp plus due/completion timestamps and allowlisted status.
// record/claim/finish may throw DB/validation failures. dispatch contains failures.
// claim returns only ownership acquired by THIS invocation, never another token.

// Existing job; legacy envelopes have journalId=null.
public function __construct(public array $cacheKeys = [], ?string $journalId = null);
public function handle(CloudflareCacheService $cloudflare): void;
public function attemptJournal(CloudflareCacheService $cloudflare, bool $initial = false): CloudflarePurgeResult;
public function failed(Throwable $exception): void;

// Notice additions; no keys or durable recovery state stored here.
public function isRecoveryUnavailable(): bool;
public function markRecoveryUnavailable(): CloudflarePurgeResult;
```

**Schema:** UUID primary id; JSON cache_keys; state pending/leased/retry/completed/exhausted; recovery_attempts0; initial_attempted false; next_attempt_at/next_dispatch_at; nullable lease_token/lease_expires_at; allowlisted last_status; created_at/updated_at/completed_at. Index state+next_dispatch_at, state+lease_expires_at, state+completed_at. No models/content/credentials/URLs/raw errors in payloads.

- [ ] **1. Verify baseline and gates before any further source edits.** Run `pwd`, `git status --short`, `git log -2 --oneline`; read spec and C0 report/reviews. Preserve all preexisting overlays. Check `gitnexus status`; analyze if stale. Resolve exact per-file symbol IDs with LocalBackend cypher and run upstream impact. For the known correction, analyze `StorefrontRefreshJournal::claim` plus each edited test method/class; capture direct callers/processes/risk and warn before proceeding.

- [x] **2. Write deterministic RED for the open claim-token adoption race.** In isolated `StorefrontRefreshJournalTest`, hook the connection's query listener after the first claim UPDATE: advance the test clock beyond120 seconds, replay the expired initial lease, then perform a replacement recovery claim. Protect the hook from recursion and restore the clock/listener lifecycle in teardown. Assert the original invocation cannot return the replacement token:

```php
$id = $journal->record(['setting:fencing']);
$replacement = null;
$interleaved = false;
DB::connection(StorefrontRefreshJournal::CONNECTION)->listen(
    function ($query) use ($journal, $id, &$replacement, &$interleaved) {
        if ($interleaved || ! str_starts_with(strtolower($query->sql), 'update')) return;
        $interleaved = true;
        $this->travel(121)->seconds();
        $journal->replay(1, 20);
        $replacement = $journal->claim($id);
    }
);
$original = $journal->claim($id, true);
$this->assertNotNull($replacement);
$this->assertNull($original);
$this->assertSame($replacement->lease_token, $journal->find($id)->lease_token);
```

Use Bus fake so replay cannot execute an inline worker. Run `php artisan test tests/Feature/StorefrontRefreshJournalTest.php --filter=claim --compact`; verify failure is replacement-token adoption, not listener/setup error. If listener fires earlier than intended, scope it to SQL/bindings matching this row's lease UPDATE before accepting RED.

- [x] **3. Implement minimum token-bound claim return, then GREEN.** Retain atomic UPDATE and durable count. After successful update, never adopt arbitrary ownership:

```php
$row = $this->find($id);
if ($row === null || $row->state !== 'leased' || $row->lease_token !== $token
    || CarbonImmutable::parse($row->lease_expires_at, 'UTC')->lessThanOrEqualTo(CarbonImmutable::now('UTC'))) {
    return null;
}
return $row;
```

An additional post-check pause can still allow external effects after expiry; it cannot turn the original token into a replacement token. Finish remains matching-unexpired-token CAS. Rerun the new regression and full repository file.

- [ ] **4. Audit independent connection/schema with test-first corrections.** Clone resolved default write config; remove read/write/sticky/url/name after write override; set PDO persistent false; ensure J differs from A/B and rejects both Laravel depth and PDO inTransaction. Add/retain RED tests for incorrect primary selection/shared PDO, active J transaction and same-file SQLite contention; no silent fallback to A/B or alternate DB server. Run repository file after minimal corrections. Provision migration through normal owner only at eventual authorized deployment.

- [ ] **5. Verify immutable handoff/validation/crash boundary.** Use same UUID twice with reordered duplicate keys and assert one matching immutable row; same UUID/different keys throws; invalid/overlong/session/assembled keys throw; every currently supported setting/media key passes. Dirty empty snapshot produces a row. Inject an insert acknowledgement exception after the database insert; verify same UUID recovery, not overwrite/new ID. Test expected unrecoverable content-commit-before-record interruption explicitly: committed content remains, no journal exists, and no guarantee is claimed. Example invariant:

```php
$id = $journal->record(['setting:old', 'setting:new']);
$this->assertSame($id, $journal->record(['setting:new', 'setting:old'], $id));
$this->assertSame(1, DB::table('storefront_refresh_journal')->count());
```

For uncovered cases write/run RED before changing record/validation.

- [ ] **6. Verify connection ownership and real queue rollback.** Retain actual database queue A separate SQLite fixture, content B and J sharing one content file but different PDOs, no Bus fake. Begin A, commit real Setting/Media B, assert queue insert visible within A, rollback A and assert queue row gone while independent reader sees committed B/J. Reset lifecycle/J, replay and run real `queue:work --once`; fake HTTP checks exact old/new keys absent and final committed values. Add uncommitted A content to prove no current-read through A. Retain B rollback, nested child rollback, child-commit/parent-rollback, unrelated A rollback and late B commit tests. Attempt MySQL/Postgres same-database test only if isolated configured fixtures exist; otherwise record this missing driver evidence as a parent acceptance gap, never substitute SQLite lock failure as proof.

- [ ] **7. Verify all three dispatch-loss owners across scope exit.** For nonHTTP postcommit, commit after HTTP collection ends, and failed initial HTTP attempt, make Bus dispatch throw. Persist exact old/new keys, discard scoped instances, restore transport, advance throttle and replay/worker. Assert committed final DB, original successful/error response or identical exception, and exact re-eviction. Logger failures must not skip healthy dispatch or escape failed dispatch. Minimal replay invariant:

```php
app()->forgetScopedInstances();
$this->travel(301)->seconds();
app(StorefrontRefreshJournal::class)->replay(100, 20);
$this->assertSame(['setting:old', 'setting:new'], app(StorefrontRefreshJournal::class)->find($id)->cache_keys);
```

Use actual job execution to assert effect/completion, not merely Bus mock calls.

- [ ] **8. Verify journal failure and truthful result delivery.** Fail record with healthy/failing queue and throwing critical logger; require no unjournaled attempt/dispatch, committed save/original exception preserved and exact critical copy. Critical cannot be overwritten by later result success. For successful admin API require both warning and unavailable header; unsuccessful/API-other/web routes must not acquire API-only headers. Add actual raw Livewire failure test and visible notification/result adapter distinguishing critical unavailable from recorded pending; current implementation exposes scoped result but has no new visible web critical adapter, so do not silently treat that requirement as met. Deliver notification after completion using the existing response/session notification convention, not by injecting keys or raw exceptions. Write RED boundary assertions before modifying middleware/adapter symbols.

- [ ] **9. Verify early eviction fault matrix.** Inject one-shot Cache::forget failure on actual Setting save/delete, direct Media move/delete and SiteMedia in both observer orders. Snapshot/register first, catch per key, continue other keys; rollback produces no journal/refresh. Actual subsequent attempt must re-evict every old/new key, fail rather than skip required eviction, and never read mutable captured models. Existing focused fault tests cover part of this matrix; complete missing order/one-shot/rollback combinations with separate RED runs.

- [ ] **10. Verify attempt/crash/fencing matrix.** Duplicate envelopes while live lease or future due/completed/exhausted/missing ID do no effects; optional initial flag consumed once; recovery count increases atomically to4; failure delays30/120/300; missing config never completes. Inject interruption after journal/before dispatch, dispatch/before worker, claim/before effects, external success/before finish, finish/before acknowledgement; observe pending/expiry/unknown exhaustion/duplicate no-op as appropriate. Completion-update outage must not return confirmed completion; preserve original lease for expiry. Failed transport callback cannot exhaust/reset logical budget. Token-A finish after token-B replacement returns false. No new retry framework or counter.

- [ ] **11. Verify bounded replay/idempotence/retention and CLI.** Two interleaved replay owners cannot both throttle-submit the same due row; duplicate workers cannot claim live lease. Bound selected rows<=100; time budget stops starting work; future due excluded. Enqueue rollback/silent lost transport remains eligible after throttle. Cleanup deletes<=100 completed older than7days only, retains pending/retry/leased/exhausted; pruned IDs no-op. Assert command clamps limit/time and emits sanitized operational output, never keys/content. Register minute scheduling through existing operator ownership; document the explicit invocation and monitoring of oldest pending, expired/exhausted, and recording failures. Do not add cache-lock correctness dependencies.

- [ ] **12. Verify actual API/Livewire/media lifecycle and legacy compatibility.** Keep authenticated `/api/admin/seo-social`, raw signed `/livewire/update` ManageSettings and real CreateMedia signed multipart upload/finish/save tests with independent committed reader/fake storage. Assert one final attempt sees all settings/media/file operations and exact journal keys. Temporarily disable only completion middleware in test fixture: all three must fail; restore. Retain old serialized key-only job compatibility and four transport tries/backoff. Check journal/job/log/notice fields never contain secrets/raw payloads. Existing tests are evidence only after fresh runs, not assumed acceptance.

- [ ] **13. Run focused tests and full aggregate honestly.** In backend use process-only environment (never .env): APP_ENV testing; test-only32-byte APP_KEY; DB_CONNECTION sqlite; DB_DATABASE :memory:; DB_URL empty; CACHE_STORE/SESSION_DRIVER array; QUEUE_CONNECTION sync (real queue fixture overrides locally).

```powershell
php artisan test tests/Feature/StorefrontRefreshJournalTest.php tests/Feature/StorefrontJournalFailureTest.php tests/Feature/StorefrontRefreshRoutedLifecycleTest.php --compact
php artisan test tests/Feature/StorefrontRefreshTransactionTest.php tests/Feature/StorefrontMutationCompletionTest.php tests/Feature/PublicContentPurgeTest.php tests/Feature/CloudflarePurgeWarningMiddlewareTest.php tests/Feature/SiteMediaApiTest.php tests/Feature/SettingsApiTest.php tests/Feature/Filament/ManageSettingsTest.php --compact
php artisan test --compact
```

Collect every background result. If native4294967295 occurs, report exact printed summary separately from exit; run narrowly isolated files for usable evidence without calling aggregate green. Full aggregate is unverified until clean completion. Do not repair unrelated suites without authority.

- [ ] **14. Review diff, self-check spec matrix, stage narrowly, run actual change gate, commit once.** Lint changed PHP, inspect full diff and `git diff --cached --check`. Explicitly stage only journal integration source/tests, no overlays. Run:

```javascript
const backend = new LocalBackend();
try {
  await backend.init();
  console.log(await backend.callTool('detect_changes', {
    repo: 'storefront-edge-cache-csp', scope: 'staged'
  }));
} finally { await backend.disconnect(); }
```

Verify only intended symbols/flows, investigate HIGH/CRITICAL rather than suppress. Commit coherent correction with `git commit -m "fix: fence storefront journal claim ownership"` only after tests and scope check. No automatic deployment.

- [ ] **15. Write report and stop at parent acceptance boundary.** Update task-C0-journal-report.md with this plan path, exact commit/tests/impact, RED vs added-after-GREEN attribution, all unmet spec tests and runtime limitations. State bounded post-journal guarantee, content gap, absence of driver/concurrency evidence, visible web warning completion status, replay/worker/timeout prerequisites, and C1/C2 separation. Parent owns overall goal and independent review; do not mark acceptance or proceed to later tasks.

## Operational correction and activation procedure

The replay command is now registered every minute in `backend/routes/console.php` with bounded options. Before any authorized activation, deployment owner MUST execute `php artisan storefront:refresh-readiness --request-timeout=<verified hard server bound> --io-timeout=<verified maximum DB/cache/queue bound>` against intended runtime configuration. Missing/unknown values, sync/unsupported queue, request>=120, IO>=min(request,worker), or visibility outside worker<visibility<120 fail readiness. Example compatible declared bounds60/5 with database visibility90 are configuration checks, NOT evidence of actual process termination. Owner must independently verify effective server/request and worker termination, driver timeouts, async consumption and scheduler ownership; no production readiness invocation or activation occurred here. This is an explicit deployment gate, not a global queue/default mutation or magic runtime enforcement. Scheduled replay infrastructure failure returns exit1 with sanitized degraded output while journal rows remain retained. Separate submitted/deferred counts and actual deployment enforcement remain subject to parent review.

## Plan self-review (performed before further source work)

- Spec sections1–3 ownership/guarantee/storage: steps1,4–6,15. No atomicity promise.
- Sections4–5 record/interfaces/lifecycle/failure: interfaces/schema and steps3–9. Known claim-token defect has explicit RED/GREEN, not deferred.
- Section6 retries/leases/replay: steps3,6–7,10–11; no transport acknowledgement completion or counter reset.
- Section7 retention/operator: step11 and15; no unfinished age deletion.
- Section8 storage tradeoff: existing DB selected, no filesystem fallback/infrastructure expansion.
- Section9 acceptance tests1–8: steps5–12 map every test family including missing driver and full fault-matrix evidence. Unavailable fixtures are explicitly reported, not passed or skipped silently.
- Section10 non-goals: constraints and15 preserve parent boundary/C1/C2 separation.
- Interfaces consistently use StorefrontRefreshJournal, journalId, cache_keys, lease_token and same method signatures. Inspection model is not a state writer.
- No unresolved placeholders. One acceptance task intentionally contains multiple bite-sized test/code steps because storage, observers, coordinator, job, replay and warnings are one correctness unit.
- **Current gaps remain execution obligations:** token adoption race, visible web critical-warning adapter, exhaustive fault/crash/multi-process/driver evidence and clean aggregate. Existing commit alone does not satisfy this plan.
