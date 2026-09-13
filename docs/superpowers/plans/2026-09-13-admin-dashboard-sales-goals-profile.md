# Admin Dashboard (Sales), Goals, and Current-User Profile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the Filament dashboard's live widgets, the Goals page, and the current-user Profile page to React admin as the first slice of `docs/superpowers/plans/2026-09-06-react-admin-migration-roadmap.md` Phase 1. Dashboard becomes a navigation group; this plan ships its **Sales** page only. The sibling **Conversion Report** page (Phase 1B) is separate, later work — do not build it now.

**Architecture:** New dedicated backend endpoints under `/api/admin/dashboard/sales`, `/api/admin/goals`, `/api/admin/profile`. React feature folders for `dashboard` (Sales), `goals`, and `profile`. Leave the legacy Filament Dashboard/Goals/Profile pages untouched and running until this phase's release gate passes.

**Tech Stack:** Laravel 11, Spatie Activitylog, React, TypeScript, Vite, TanStack Query, i18next, PHPUnit, Vitest.

**Spec:** `docs/superpowers/plans/2026-09-06-react-admin-migration-roadmap.md` (Phase 1 section), `docs/superpowers/specs/2026-09-06-order-email-content-admin-followups-design.md`

## Global Constraints

- This plan covers **Sales + Goals + Profile only**. The Conversion Report (Phase 1B) is a separate plan; do not start it as part of this work.
- `/dashboard` (the Dashboard nav group) defaults to the Sales page. Build the Dashboard group's routing so a later Conversion Report page can be added as a sibling without restructuring this work.
- Migrate only the widgets **actually registered** on the live Filament dashboard (confirmed in `backend/app/Providers/Filament/AdminPanelProvider.php` `->widgets([...])`):
  - `SiteOverviewStatsWidget` (total sales, AOV, order count KPI cards — note its "Active users" stat is currently a hardcoded `'—'` placeholder; do not fabricate a real number for it, keep it explicitly unavailable or drop it)
  - `SalesOverviewChart` (sales-over-time series)
  - `SalesSidebarWidget`
  - `OrderPipelineWidget`
  - `TopProductsWidget`
  - `SalesByCategoryChart`
  - `LatestOrdersTable` (recent orders)
  - `RecentActivityWidget`
  - `PendingReturnRequestsWidget` (returns/refunds summary)
- Do **not** migrate these widget files even though they exist in `backend/app/Filament/Widgets/` — they are not registered in `AdminPanelProvider` and are dead code for this surface: `AverageOrderValueChart`, `NewVsReturningCustomersChart`, `OrderStatusBreakdownChart`, `OrdersSalesChart`, `PopularProductsTable`. Confirm this yourself by re-checking `->widgets([...])` before starting, in case it has changed.
- `AffiliateClicksOverview`, `TopClickedPostsWidget`, `ClicksByNetworkWidget` belong to the Affiliate Reports surface (roadmap Phase 3), registered separately as `livewireComponents`. Out of scope here — do not fold affiliate data into the Sales dashboard.
- Exclude cancelled orders consistently across every Sales metric (total sales, AOV, order count, series, top products).
- `backend/app/Filament/Pages/Profile.php::getRecentActivity()` currently shows the **global** activity feed, not the current user's own actions, because most activity-log entries have no causer recorded (see its own doc comment). Preserve this same behavior in the new API — do not silently claim it is personal. Label it honestly as "Recent system activity" (not "Your activity") in both EN and VI, matching the roadmap's explicit instruction.
- `User::$casts` already has `last_login_at => datetime`; confirm where/whether it is actually being written on login (if nothing sets it today, wire that up server-side — do not display a field that never updates).
- Goals persist only `monthly_revenue_target`, `monthly_orders_target`, `monthly_new_customers_target` via the existing `Setting` model (see `backend/app/Filament/Pages/Goals.php`). Accept `null` to explicitly clear a goal; distinguish "unconfigured" from "target is zero" in the response.
- All admin strings require EN and VI (`admin/src/locales/en.json` / `vi.json`).
- Before editing any symbol, run GitNexus upstream impact; before every commit, run `gitnexus_detect_changes`. Report HIGH/CRITICAL risk before proceeding.
- Do not remove or hide the legacy Filament Dashboard/Goals/Profile pages/nav entries in this plan — that only happens at the roadmap's "Final Filament Cutover Gate," after release-gate verification.

---

### Task 1: Backend — Sales Report Endpoint

**Files:**
- Create: `backend/app/Http/Controllers/Api/Admin/DashboardSalesController.php`
- Create: `backend/app/Http/Requests/Admin/DashboardSalesRequest.php` (validate `range=7|30|90|365|all`)
- Create: `backend/tests/Feature/Api/Admin/DashboardSalesControllerTest.php`
- Reference: the 9 live widget classes listed above, to replicate their exact query logic (do not guess at formulas — read each widget's source).

- [x] Write failing tests first: response shape includes total sales, AOV, order count, sales-over-time series, returns/refunds summary, order pipeline, recent orders, top products, and current-month goal progress, for each supported range.
- [x] Add a test proving cancelled orders are excluded from every metric.
- [x] Add a test proving no affiliate-specific data appears in this response.
- [x] Add an authorization test (only roles with an existing dashboard-viewing ability can call this).
- [x] Implement `GET /api/admin/dashboard/sales?range=7|30|90|365|all` returning presentation-neutral JSON (no pre-formatted currency strings baked in that the frontend can't reformat — return raw numeric values plus currency code, matching the money-formatting conventions already used elsewhere in this codebase, e.g. `OrderResource`/`AdminOrderPresentation`).
- [x] Reuse/extract shared query logic from the widget classes rather than duplicating SQL; do not delete the widget classes yet.
- [x] Run focused tests, then full backend suite for touched files.
- [x] Commit `feat(api): add dashboard sales report endpoint`.

---

### Task 2: Backend — Goals Endpoint

**Files:**
- Create: `backend/app/Http/Controllers/Api/Admin/GoalsController.php`
- Create: `backend/app/Http/Requests/Admin/GoalsUpdateRequest.php`
- Create: `backend/tests/Feature/Api/Admin/GoalsControllerTest.php`
- Reference: `backend/app/Filament/Pages/Goals.php`, `backend/app/Filament/Widgets/RevenueTargetsWidget.php`

- [x] Write failing tests: GET returns `actual`, `target` (nullable), `uncapped_percentage`, and `unit` per goal; PUT accepts `null` to clear a target and distinguishes "unconfigured" (no Setting row) from "target explicitly 0".
- [x] Add a test that the visual/response percentage is only capped for display purposes, not the underlying uncapped value (both should be returned; let the frontend decide how to cap the bar).
- [x] Implement `GET/PUT /api/admin/goals` against the existing `Setting` model, same 3 keys Filament already uses (`monthly_revenue_target`, `monthly_orders_target`, `monthly_new_customers_target`). Do not introduce a new storage mechanism.
- [x] Run tests. Commit `feat(api): add goals endpoint`.

---

### Task 3: Backend — Profile Endpoint

**Files:**
- Create: `backend/app/Http/Controllers/Api/Admin/ProfileController.php`
- Create: `backend/app/Http/Requests/Admin/ProfileUpdateRequest.php`, `ProfilePasswordUpdateRequest.php`
- Create: `backend/tests/Feature/Api/Admin/ProfileControllerTest.php`
- Reference: `backend/app/Filament/Pages/Profile.php`, `backend/app/Models/User.php`

- [x] Write failing tests: GET returns name, email, role labels, joined date (`created_at`), `last_login_at`, and the recent-activity feed; PUT profile validates name/email (email uniqueness excluding self); PUT password requires current-password confirmation and enforces the same password rules used elsewhere in this app.
- [x] Add a test proving `getRecentActivity()`'s existing global-feed behavior (not filtered by causer) is preserved, and that the API/response labels this honestly (a `label`/`scope` field or equivalent the frontend can use to render "Recent system activity" rather than "Your recent activity").
- [x] Confirm (read the login flow, e.g. Fortify/Sanctum session controller or auth listener) whether anything currently writes `last_login_at`. If nothing does, add that write on successful login with its own small test. If it's already wired, just verify it.
- [x] Implement `GET/PUT /api/admin/profile` and `PUT /api/admin/profile/password`.
- [x] Run tests. Commit `feat(api): add profile endpoint`.

---

### Task 4: React — Dashboard Nav Group Shell

**Files:**
- Modify: `admin/src/navigation/adminNavigation.tsx` (from the Phase 0 mobile-shell work)
- Create: `admin/src/features/dashboard/` folder (routes only in this task; content in Task 5)

- [x] Add "Dashboard" as a navigation **group** (not a single link) with one child today: "Sales". Structure it so a "Conversion Report" child can be added later without a nav-model change.
- [x] Wire `/dashboard` to redirect to `/dashboard/sales` so the core-admin home experience is unchanged (no extra click to reach the primary view).
- [x] Run admin test suite/build to confirm navigation/routing tests still pass.
- [x] Commit `feat(admin): add dashboard nav group shell`.

---

### Task 5: React — Sales Page

**Files:**
- Create: `admin/src/features/dashboard/api.ts`, `SalesPage.tsx`, `SalesPage.test.tsx`
- Modify: `admin/src/locales/en.json`, `vi.json`

- [x] Add failing tests for: range selector (7/30/90/365/all), KPI cards (total sales, AOV, order count — "Active users" shown as explicitly unavailable, not a fabricated number), sales-over-time chart, returns/refunds summary, order pipeline, recent orders table, top products, and goal-progress bars sourced from the Goals endpoint (Task 2).
- [x] Implement the page using the same money-formatting helpers already established in this codebase (do not reinvent currency formatting).
- [x] Add bilingual locale strings for every new label.
- [x] Run tests, `tsc --noEmit`, `npm run build`.
- [x] Commit `feat(admin): add dashboard sales page`.

---

### Task 6: React — Goals Page (under Finance)

**Files:**
- Create: `admin/src/features/finance/GoalsPage.tsx`, `GoalsPage.test.tsx`, wire into `admin/src/features/dashboard/api.ts` or a new `admin/src/features/finance/goalsApi.ts`
- Modify: navigation to add Goals under the existing/placeholder Finance group.

- [x] Add failing tests: form with 3 numeric inputs (revenue/orders/new-customers targets), each clearable to "unconfigured", validation errors surfaced per-field (matching the error-surfacing pattern fixed in `ComparisonItemRepeater.tsx` this session — do not repeat that silent-failure mistake).
- [x] Implement the form; on save, invalidate the Sales page's query so goal-progress bars update without a full reload (release-gate requirement).
- [x] Add bilingual locale strings.
- [x] Run tests, `tsc --noEmit`, `npm run build`.
- [x] Commit `feat(admin): add goals page`.

---

### Task 7: React — Profile (User Menu)

**Files:**
- Create: `admin/src/features/profile/ProfilePage.tsx`, `ProfilePage.test.tsx`, `profileApi.ts`
- Modify: the existing user-menu/avatar dropdown component to add a "Profile" entry (not the sidebar).

- [x] Add failing tests: displays name/email/role labels/joined date/last login; separate "Update profile" and "Change password" forms; "Recent system activity" section is clearly labeled as system-wide, not personal (per Global Constraints).
- [x] Implement the page and the user-menu entry.
- [x] Add bilingual locale strings.
- [x] Run tests, `tsc --noEmit`, `npm run build`.
- [x] Commit `feat(admin): add profile page in user menu`.

---

### Task 8: Cross-Surface Verification

- [x] Run full backend test suite for touched files plus `--filter=Dashboard`, `--filter=Goals`, `--filter=Profile`.
- [x] Run full admin test suite, `tsc --noEmit`, `npm run build`.
- [x] Manually verify in a real browser (not just curl): Sales numbers match a direct DB calculation for at least one range; goal progress updates after editing Goals without a page reload; profile validation errors are visible (not silent); mobile viewport (360px) needs no horizontal scroll on the Sales page.
- [x] Confirm no affiliate-specific data leaked into the Sales page.
- [x] Run GitNexus `detect_changes` and review the full diff before considering this plan done.
- [x] Update this plan file's checkboxes.

## Definition of Done

1. `/dashboard` shows the Sales page by default, matching or exceeding the 9 live Filament widgets' data (with the "Active users" placeholder honestly unavailable, not fabricated).
2. Goals live under Finance nav, editable, and their progress reflects live on the Sales page without a reload.
3. Profile lives in the user menu (not the sidebar), shows last login, and honestly labels its activity feed as system-wide.
4. No affiliate data appears on the Sales page; cancelled orders are excluded everywhere.
5. The legacy Filament Dashboard/Goals/Profile pages are untouched and still function as a rollback path.
