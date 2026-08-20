# Admin Frontend Rebuild — Design

**Date:** 2026-08-21
**Status:** Approved (architecture), not yet implemented

## Problem

The current admin panel is built on Filament 3 (PHP/Laravel, server-rendered Livewire). It has no dedicated frontend build pipeline — custom CSS is hand-written in a single `<style>` block inside `AdminPanelProvider.php`. This surfaced when installing `awcodes/filament-curator`.

Root problem (confirmed with user): both performance *and* aesthetics feel wrong ("cơ bản, xấu, cảm giác chậm"), and the deeper motivation is wanting full custom control over the UI instead of being bound by Filament's theming constraints.

## Goal

Build a new, independent admin frontend that talks to the same Laravel API backend (`api.petposture.com`), hosted at `admin.petposture.com`. Filament keeps running in parallel and is migrated away from resource-by-resource — this is a gradual "chuyển nhà," not a big-bang rewrite. This spec covers the **architecture only**; no resource has been implemented yet.

## Scope decomposition

The backend currently exposes ~20 Filament Resources (Product, Order, Customer, Category, Brand, Breed, Collection, Comment, Media, Page, Post, Review, Role, Setting, ShippingMethod, Solution, UserAddress, User, AffiliateNetwork, CollectionGroup, BlogCategory, BlogTag, OrderReturnRequest). Rebuilding all of them is too large for one implementation plan — this spec establishes the shared architecture pattern; each resource migration is its own future implementation cycle.

### Current backend API reality (verified by reading `backend/routes/api.php`)

Mixed state — not a clean "REST API already exists" nor "nothing exists":

- **Has REST API today**, under `Route::prefix('/admin')->middleware(['auth:sanctum', 'role:super_admin|admin|staff'])`:
  - Posts: full CRUD (`PostController`)
  - Blog categories: read (`PostController::categories`)
  - Order refund/return actions (`OrderController::refund/return`)
  - Return requests: list/show/approve/reject/complete (`ReturnRequestController`)
- **No REST API** — the remaining ~15 resources are Filament-only: server-rendered Livewire querying Eloquent models directly, no HTTP endpoint exists. This includes Product, full Order CRUD/list, Customer, Category, Brand, Breed, Collection, Comment, Media, Page, Review, Role, Setting, ShippingMethod, Solution, UserAddress, User.

**Implication:** migrating a resource to the new admin frontend is a two-sided task — write the `Admin\{Resource}Controller` + routes (if missing), then build the frontend feature against it. Posts is the one exception where only frontend work is needed.

## Tech stack

- **Build tool:** Vite (not Next.js) — the admin panel lives entirely behind auth, has no SEO/SSR requirement, and a plain SPA gives faster dev/build loops than Next.js for CRUD/dashboard work.
- **Framework:** React + TypeScript
- **Styling:** Tailwind CSS, using PetPosture's real brand tokens ported from `frontend/tailwind.config.ts` — `primary: #3e4c57`, `secondary: #df8448`, `ink: #1a2128`, font `Hanken Grotesk`. Explicitly **not** a generic dark-dashboard theme — validated visually against mockups during brainstorming (see below).
- **Component primitives:** shadcn/ui — components are copied into the repo (not an installed black-box package), so styling stays fully editable via Tailwind classes, unlike Filament's theming API.
- **Server state / data fetching:** TanStack Query
- **Data tables:** TanStack Table — client-side filter/sort/pagination, addressing the "feels slow" complaint (Filament tables round-trip the server on most interactions).
- **Forms:** React Hook Form + Zod — instant client-side validation instead of submit-to-see-errors.
- **Rich text editor:** TipTap — for Post body editing.

### Visual validation

Two rounds of mockups were shown via the brainstorming visual companion:

1. Generic Filament-style vs generic shadcn/ui dark-dashboard style — user rejected both as not matching the PetPosture brand.
2. On-brand version using actual Tailwind tokens (primary/secondary/ink, Hanken Grotesk) with a dark topbar+sidebar (primary color) and light content area — **approved** ("Nhìn cũng ok phết").

Approved layout shell: dark topbar (brand name + user) + dark sidebar nav (active item highlighted with secondary/orange accent bar) + light content area with horizontal tabs for multi-section forms (e.g. Chi tiết / Hình ảnh / SEO / Biến thể) + a right-hand sidebar card for status/media on edit forms.

## Repository structure & deployment

New Vite app lives in the monorepo at `admin/` (sibling to `backend/` and `frontend/`), deployed independently, served at `admin.petposture.com`.

```
admin/
  src/
    api/            # TanStack Query hooks, one module per resource (useProducts, useOrders, ...)
    components/ui/  # shadcn/ui primitives (owned copies, editable)
    features/        # one directory per resource: products/, posts/, orders/...
    layouts/         # AppShell: topbar + sidebar per approved mockup
    routes/
```

## Auth

Reuse the existing Sanctum SPA cookie-auth already used by `frontend/` — no new auth system.

- Login: existing `POST /login` (`AuthController::login`, throttled)
- Session check: existing `GET /me`
- Logout: existing `POST /logout`
- Backend config changes needed: add `admin.petposture.com` to `SANCTUM_STATEFUL_DOMAINS` (`backend/config/sanctum.php`) and to `FRONTEND_URL` (used by `backend/config/cors.php`, which already supports comma-separated origins).
- Authorization: existing `role:super_admin|admin|staff` middleware on the `/api/admin/*` route group covers admin-only access — same middleware to reuse for every new admin endpoint.

## Backend API pattern for resource migration

Each migrated resource gets a dedicated `Admin\{Resource}Controller`, registered under the existing `/api/admin` prefix group, fully separate from its Filament Resource (which is left untouched and keeps running until the team decides to remove it):

```php
Route::prefix('/admin')
    ->middleware(['auth:sanctum', 'role:super_admin|admin|staff'])
    ->group(function () {
        Route::apiResource('products', Admin\ProductController::class);
        // repeat per resource as it migrates
    });
```

## Rollout order

Build API + frontend together, one resource at a time — not all-API-first, not frontend-only. This keeps risk small and lets each resource ship independently while Filament continues serving everything not yet migrated.

**Pilot resource: Product.** Chosen because it is the most structurally complex (images, variants, price, category relationships) — if the shared architecture (AppShell, auth guard, table pattern, form pattern, image upload pattern) works for Product, it will work for every simpler resource that follows. Product currently has **no REST API** (Filament/Eloquent-only), so the pilot also covers writing the first `Admin\ProductController`.

## Out of scope for this spec

- The actual implementation of the Product pilot (next: `writing-plans`)
- Order for migrating the remaining 14 resources after Product
- Decommissioning Filament (deferred — no timeline decided)
