# React Admin Migration Roadmap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate remaining valuable Filament capabilities to React admin in safe, independently releasable phases while preserving fallback and authorization parity.

**Architecture:** Establish mobile/semantic navigation first, then migrate vertical slices with dedicated admin APIs and React pages. Preserve existing compact selector APIs. Move mutable Roles/Permissions last, after every route/action has a stable server-enforced semantic ability.

**Tech Stack:** Laravel 11, Filament fallback, Spatie Permission/Media Library, React, TypeScript, Vite, TanStack Query, i18next, PHPUnit, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-06-order-email-content-admin-followups-design.md`

## Global Constraints

- This roadmap is not authorization to implement all phases as one change. Create a fresh detailed implementation plan for each phase before execution.
- Execute in this order: shell → Dashboard(Sales)/Goals/Profile → Dashboard(Conversion Report) → Users/Media → Affiliate → Finance → Notifications/System → abilities/Permissions/Roles.
- Dashboard is a navigation group, not a single page: it contains Sales (Phase 1) and Conversion Report (Phase 1B) as sibling pages, matching how Finance and System already group multiple pages. `/dashboard` defaults to the Sales page so the core-admin home experience is unchanged.
- Do not remove Filament navigation until React parity, authorization tests, browser QA, and rollback are proven.
- Affiliate analytics stay separate from commerce Dashboard.
- Goals remain under Finance but progress appears on Dashboard with Edit targets.
- Finance exposes only Stripe, PayPal, Airwallex. Leave Payoneer/PingPong storage/integrations untouched.
- Never return raw secrets to SPA; provider tests run server-side.
- System is core-admin-only and contains Users, Roles, Permissions, Media Library, Settings, Notifications, and Activity Logs; Profile lives in the user menu.
- Preserve compact selector APIs used by existing forms.
- All admin strings require EN and VI.
- Before API handler edits, run GitNexus API impact; before symbol edits, upstream impact; before commits, detect changes.

---

## Phase 0: Mobile Shell and Semantic Access Foundation

**Plan:** `docs/superpowers/plans/2026-09-06-admin-mobile-shell-navigation.md`

- [ ] Deliver shared typed navigation, accessible mobile drawer, explicit capability predicates, and capability-aware home routing.
- [ ] Preserve current specialized-role behavior.
- [ ] Do not expand navigation until Phase 0 is verified.

**Release gate:** all current modules are reachable on mobile; desktop remains unchanged; no index-based filtering remains.

---

## Phase 1: Dashboard Group — Sales, Goals, and Current-User Profile

Dashboard is a navigation group with two sibling report pages: **Sales** (this phase) and **Conversion Report** (Phase 1B). `/dashboard` defaults to Sales.

### Backend target

Create dedicated controllers/requests/services/tests for:

```text
GET /api/admin/dashboard/sales?range=7|30|90|365|all
GET/PUT /api/admin/goals
GET/PUT /api/admin/profile
PUT /api/admin/profile/password
```

Sales returns presentation-neutral total sales, AOV, order count, series, returns/refunds summary, order pipeline, recent orders, top products, and current-month goal progress. Exclude cancelled orders consistently. Do not migrate dead/unregistered placeholder widgets.

Goals persist only `monthly_revenue_target`, `monthly_orders_target`, and `monthly_new_customers_target`. Accept null to clear a goal; distinguish unconfigured from zero. Return actual, target, uncapped percentage, and unit; cap only the visual bar.

Profile exposes name, email, role labels, joined date, last login timestamp, profile update, separate password update, and honestly labeled “Recent system activity” unless the query is changed to filter by current actor.

### React target

Create dashboard (Sales), goals, and profile feature folders with API contracts, components, tests, routes, bilingual locales, and query invalidation. Put Profile in the user menu. Once available, `/dashboard` (defaulting to Sales) becomes the core-admin home while specialized roles keep safe homes.

**Release gate:** numbers match direct DB calculations/current widgets for the same range; no affiliate data appears; goals update without reload; profile validation is server-enforced; mobile primary metrics need no horizontal scroll.

---

## Phase 1B: Dashboard Group — Conversion Report

Added after the initial roadmap review (user request, 2026-09-13). Named after Shopify's "Online store conversion" report: a lightweight conversion report — sessions/carts created → checkouts started → orders completed — built entirely on existing data (Lunar's `Cart`/`CartItem` models and the existing `CheckoutSession` model's `status` field). No new tracking/instrumentation is introduced; this is a reporting query over data already persisted today. Lives as a sibling page under the Dashboard nav group, next to Sales.

### Backend target

```text
GET /api/admin/dashboard/conversion?range=7|30|90|all
```

Returns, for the selected range: carts created, checkouts started (`CheckoutSession` rows by status), orders completed, and the derived drop-off rate at each stage. Treat cart abandonment and checkout abandonment as two distinct stages — do not collapse them into a single "abandoned" bucket. Do not expose any customer PII (email, name, address) in the aggregate report; this is a counts/rates report, not a customer-list view. If a later phase needs to drill into *which* sessions/carts were abandoned (e.g. for a manual outreach/recovery flow), that is separate, explicitly-scoped follow-up work, not part of this phase.

### React target

Create a `/dashboard/conversion` report route (sibling of `/dashboard/sales` under the Dashboard nav group) with its own feature folder, API contract, component, tests, route, and bilingual locales.

**Release gate:** stage counts match direct DB calculations for the same range; no PII appears in the response; cart and checkout abandonment remain distinguishable; mobile layout needs no horizontal scroll.

---

## Phase 2A: System Users

Preserve compact `GET /api/admin/users` selector. Add management under `/api/admin/system/users` with a separate controller/resource/requests/tests and React list/form routes.

Safety requirements:

- show only eligible admin-panel users;
- password required on create and optional on update;
- prevent self-disable/delete that strands the active session;
- prevent removing the last active super admin;
- role options are read-only until Phase 6.

**Release gate:** selector consumers remain green; authorization and irreversible-operation safeguards are tested.

---

## Phase 2B: System Media Library

Treat these as separate sources:

1. Existing Curator picker/upload API already used by React.
2. Spatie MediaLibrary attachments shown in legacy Filament.

Keep the existing picker API unchanged. Add `/api/admin/system/media?source=all|curator|attachment` with a source discriminator and source-aware delete endpoint. Never treat both storage models as interchangeable. Refuse deletion where a required attachment would be broken unless existing behavior explicitly permits it.

**Release gate:** both sources are visible and labeled; picker upload/filter/move remains intact; delete uses the correct model/storage pipeline.

---

## Phase 3: Affiliate Reports and Affiliate Networks

### API compatibility lock

Preserve `GET /api/admin/affiliate-networks` as the bare active `{name, slug}` selector consumed by post comparison forms.

Add separate management/report endpoints:

```text
GET /api/admin/affiliate/reports?range=7|30|90|all
GET/POST /api/admin/affiliate/networks
GET/PUT/DELETE /api/admin/affiliate/networks/{network}
POST /api/admin/affiliate/networks/{network}/sync
```

Reports distinguish tracked outbound clicks from imported conversion/commission data. Do not imply revenue attribution when provider reports are absent.

Credential responses expose configured booleans only. Omitted secret updates preserve encrypted values. Never round-trip `********`. Prefer queued sync with `202 Accepted` and an explicit unconfigured/disabled state.

### React target

Create separate `/affiliate/reports` and `/affiliate/networks` list/form routes, tests, bilingual strings, and access predicates.

**Release gate:** selector contract unchanged; inactive historical networks remain attached but are excluded from new selectors; no decrypted credential reaches response/cache/DOM/log/snapshot.

---

## Phase 4: Finance Payment Methods

Only Stripe, PayPal, and Airwallex appear in React. Do not delete legacy fallback storage or alter Payoneer/PingPong checkout behavior.

### Backend target

```text
GET /api/admin/finance/payment-methods
PUT /api/admin/finance/payment-methods/{stripe|paypal|airwallex}
POST /api/admin/finance/payment-methods/{gateway}/test
```

GET returns configured state, source (`database|environment|none`), mode, safe hint, webhook URL, and optional last-test metadata—never secrets. Omitted secrets preserve current value/environment fallback; replacement is explicit; clearing requires explicit `clear_fields`; editable secret fields are blank rather than fake bullets; provider errors/logs are sanitized.

Connection tests run in Laravel with `Http::fake()` coverage for correct host/auth by mode, success, invalid credentials, timeout/network exception, unauthorized access, and no secret leakage. Invalidate checkout settings caches after updates.

### React target

Create Payment Methods page, gateway form, tested masked-secret input, API contract, bilingual copy, and server-only test actions.

**Release gate:** browser never calls provider APIs; refresh never populates secrets; non-secret update preserves credentials; checkout discovery remains healthy; only the approved three gateways are visible.

---

## Phase 5A: Notifications

Add user-scoped notification list/unread filters, mark-one, mark-all, bell, and page. New payloads store structured type/record ID and the API generates safe React routes. Legacy Filament-only URLs fall back safely and are not opened by default.

```text
GET /api/admin/notifications?filter=all|unread
POST /api/admin/notifications/{notification}/read
POST /api/admin/notifications/read-all
```

**Release gate:** bell/page counts agree; actions update without reload; each user sees only their notifications; links stay inside React admin.

---

## Phase 5B: Activity Logs and Remaining System Settings

Activity Logs must be an explicit read-only migration surface, not hidden under generic “System” wording. Provide paginated, filterable audit entries with actor, action/event, subject type/ID, timestamp, and a safe structured change summary. Do not return secret values, encrypted casts, raw credentials, tokens, or unrestricted serialized model snapshots.

Audit each remaining System setting independently. Do not sweep unrelated settings into a generic JSON editor. Preserve the existing storage contract and add typed request validation per settings domain.

**Release gate:** activity entries match the legacy audit source, sensitive attributes are redacted, filters/pagination are tested, and each settings domain has explicit authorization and validation.

---

## Phase 6: Server-Driven Abilities, Permissions, and Roles

Execute in this order:

1. Register semantic abilities for every delivered route/action.
2. Map current roles without changing effective access.
3. Add `GET /api/admin/session` returning identity, display roles, and `abilities: string[]`.
4. Switch React `can()`, navigation, routes, and actions to effective abilities.
5. Remove role-name authorization checks.
6. Ship a read-only Permissions matrix.
7. Ship mutable Roles/Permissions editing last.

Do not expand storefront `/api/me`; the admin session is a dedicated contract.

```text
GET /api/admin/session
GET/POST /api/admin/system/roles
GET/PUT/DELETE /api/admin/system/roles/{role}
GET /api/admin/system/permissions
```

Group permissions by Dashboard, Commerce, Catalog, Content, Affiliate, Finance, System, and Profile. Protect `super_admin`, prevent irreversible self-lockout, clear Spatie’s cache, keep backend 403 authoritative, and make changes visible after session refetch.

**Release gate:** role rename does not change access; permission changes update UI after refetch; every visible mutation has backend enforcement; existing role parity matrix passes.

---

## Recommended PR/Plan Breakdown

1. `admin-shell-mobile-and-access-foundation`
2. `admin-dashboard-goals-profile-api`
3. `admin-dashboard-goals-profile-react`
4. `admin-dashboard-conversion-report-api`
5. `admin-dashboard-conversion-report-react`
6. `admin-system-users`
7. `admin-system-media`
8. `admin-affiliate-reporting-api`
9. `admin-affiliate-reporting-react`
10. `admin-payment-settings-api-security`
11. `admin-payment-settings-react`
12. `admin-system-notifications`
13. `admin-activity-logs`
14. `admin-remaining-system-settings` (split again by settings domain when scoped)
15. `admin-server-driven-abilities`
16. `admin-permissions-read-only`
17. `admin-roles-permissions-react`
18. `admin-filament-cutover-cleanup`

Each item requires its own implementation plan before coding. Work may run in parallel only after Phase 0 when dependencies and file ownership do not conflict. Phase 6 waits for all earlier routes/actions.

## Per-Phase Verification Template

- [ ] Write backend authorization/validation/response-contract tests first.
- [ ] Run GitNexus API impact before route-handler edits.
- [ ] Implement the minimal backend vertical slice and run focused/full backend checks.
- [ ] Write React API/component/route/access tests first.
- [ ] Implement bilingual React UI; run tests, type-check, and build.
- [ ] Browser-QA desktop/mobile and the specialized-role matrix.
- [ ] Verify no compact selector API shape changed.
- [ ] Verify no secret or personal operational data leaks.
- [ ] Run GitNexus detect-changes and inspect the diff.
- [ ] Keep the Filament rollback entry until production parity is confirmed.

## Final Filament Cutover Gate

A migrated Filament area may be hidden or marked legacy only when API authorization tests, React route/action tests, desktop/mobile QA, production 401/403/422/500 monitoring, selector compatibility, secret review, staff workflow parity, and navigation-only rollback are complete.

## Definition of Done

The roadmap is complete only when every phase has been separately planned, implemented, verified, released, and cut over under the gate above. Roles/Permissions are last, and React authorization is server-driven.
