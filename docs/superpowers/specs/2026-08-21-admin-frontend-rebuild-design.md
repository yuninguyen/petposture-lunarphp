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

Reuse the existing Sanctum auth already used by `frontend/` — no new auth system. Verified by reading `AuthController` and `frontend/lib/fetchApi.ts`: despite `sanctum.php` having a `stateful` domains list, the frontend does **not** use CSRF-cookie SPA auth (no `/sanctum/csrf-cookie` call anywhere). The real mechanism is a **Sanctum personal access token**, returned in the login JSON body and stored client-side:

- Login: `POST /login` (`AuthController::login`, throttled) returns `{ user: UserResource, token: string }` and also sets an httpOnly `petposture_token` cookie (not readable by JS — a secondary mechanism, not what the frontend relies on).
- The frontend stores the plain token itself (`localStorage`, key `petposture_token`) and sends it as `Authorization: Bearer <token>` on every request, alongside `credentials: 'include'`.
- Session check: `GET /me` (requires the Bearer header)
- Logout: `POST /logout` (revokes the current token server-side via `currentAccessToken()->delete()`)
- `UserResource` includes `roles: string[]` (Spatie roles) — the admin frontend uses this to gate access: after `/me`, require the response to include `super_admin`, `admin`, or `staff`; otherwise treat as unauthenticated for admin purposes and show an access-denied state.
- Authorization on the backend: existing `role:super_admin|admin|staff` middleware on the `/api/admin/*` route group — reuse unchanged for every new admin endpoint.
- CORS: `admin.petposture.com` must be added to `FRONTEND_URL` in the backend `.env` (comma-separated, read by `backend/config/cors.php`) so cross-origin requests from the new admin domain are allowed. No `SANCTUM_STATEFUL_DOMAINS` change needed since the admin app won't use cookie-session auth.

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

**Pilot resource: Post** (changed from Product — see below).

Product was the original pilot candidate, but inspecting the codebase revealed it's not a simple CRUD resource: the backend uses **Lunar**, a full e-commerce framework, and Filament's `ProductResource` extends Lunar Admin's base resource with **10 sub-pages** (details, media, pricing, inventory, shipping, variants, identifiers, associations, availability, collections, URLs). Rebuilding all of that as a first pilot would be a large multi-plan effort, not a small architecture-validation pilot. Product migration is deferred to its own future spec, scoped deliberately (likely starting with core fields only — name/description/price/status/main image/category — before tackling variants/inventory/shipping/associations).

Post was chosen instead: it already has a full REST API (`PostController` under `/api/admin`), is a single-entity resource (no sub-pages), and still exercises the core architecture patterns needed — list/table, form with rich text (TipTap), image upload, category assignment — without the Lunar complexity.

## Out of scope for this spec

- The actual implementation of the Product pilot (next: `writing-plans`)
- Order for migrating the remaining 14 resources after Product
- Decommissioning Filament (deferred — no timeline decided)
