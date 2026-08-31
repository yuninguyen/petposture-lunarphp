# Round 4a Commerce Admin Discounts — Design

**Date:** 2026-08-31
**Scope:** Core Discount CRUD only: list, create, read, update, and delete. This is the first of four planned Discounts rounds.

## Goals

Provide a Vite/React admin interface and Laravel API for creating and managing the three discount types registered by this application:

- `Lunar\DiscountTypes\AmountOff`
- `Lunar\DiscountTypes\BuyXGetY`
- `App\Lunar\DiscountTypes\FixedAmountOffPerUnit`

Only core administrators (`super_admin`, `admin`, `staff`) can access this feature. The implementation must preserve Lunar's runtime data requirements while presenting usable decimal USD fields to administrators.

## Non-goals

Round 4a must not add or edit:

- discount limitations for collections, brands, products, variants, or customers;
- product/collection conditions;
- BuyXGetY reward-product selection;
- discount availability pages beyond `starts_at` and `ends_at`;
- customer groups, channels, or relation managers;
- `ApplyCouponService`, checkout logic, Lunar vendor code, or storefront behavior;
- `AdminPermissionMatrix` or `EnforceAdminApiPermission`;
- any migration or data-import script. The audited databases contain no Discounts to migrate.

Future rounds own the limitation/condition/reward relation tables and their behavior.

## Authorization and route surface

`routes/api.php` already has an authenticated admin group that applies the broad admin role middleware and `EnforceAdminApiPermission`. Round 4a adds a nested group:

```php
Route::middleware('role:super_admin|admin|staff')->group(function () {
    // Discount CRUD routes
});
```

Routes use conventional resource methods without a public/storefront route:

| Method | Path | Action |
|---|---|---|
| GET | `/api/admin/discounts` | paginated index |
| POST | `/api/admin/discounts` | create |
| GET | `/api/admin/discounts/{discount}` | show |
| PUT/PATCH | `/api/admin/discounts/{discount}` | update |
| DELETE | `/api/admin/discounts/{discount}` | destroy |

`Order Manager`, `Support`, and `Product Manager` must receive 403 from every route. No new matrix permission is introduced. Deletion is permitted for core administrators and directly deletes the Lunar Discount; used coupon codes are historical string values rather than an order foreign key.

## Backend design

### Controller and resources

Create `App\Http\Controllers\Api\Admin\DiscountController`. It uses `Lunar\Models\Discount` directly, maps outputs explicitly, and never serializes its relations or raw model object.

List items include:

```text
id, name, handle, coupon, type, type_label, status,
starts_at, ends_at, uses, max_uses, max_uses_per_user,
priority, stop, data, created_at, updated_at
```

`type_label` is computed from the hard-coded supported type map, never instantiated from user input. `status` is Lunar's native accessor value (`active`, `expired`, `pending`, or `scheduled`), derived from the model's timestamps at response time.

The request and response `data` object preserves Lunar's field names but represents USD values as decimals at the API boundary:

```text
data.min_prices.USD                    decimal USD or null
data.fixed_value                        boolean (AmountOff/per-unit only)
data.percentage                         decimal or null (AmountOff percentage only)
data.fixed_values.USD                  decimal USD or null (fixed AmountOff/per-unit only)
data.min_qty, data.reward_qty,
data.max_reward_qty                     integers or null (BuyXGetY only)
data.automatically_add_rewards          boolean (BuyXGetY only)
```

The show response uses the same normalized resource contract. It does not fetch or expose limitations, conditions, rewards, customer relations, channels, or activity logs.

### Index behavior

The endpoint accepts optional `search` and `page`. It orders newest first, uses 15-item pagination, and returns an explicit `data` and `meta` envelope. When supplied, search uses a grouped `where` closure over `name` OR `coupon`. It must not become a raw filter over `type`, `handle`, or JSON data.

### Allowed type map

Validation permits exactly the three registered type class strings named in Goals. It never accepts arbitrary class names. The controller maintains one private map for class string to safe admin label.

### Validation and normalization

Common fields:

| Field | Rule / behavior |
|---|---|
| `name` | required string, max 255 |
| `handle` | required string, max 255, unique; create accepts omission and generates `Str::slug(name)` |
| `type` | required, hard whitelist |
| `starts_at` | required valid datetime |
| `ends_at` | nullable valid datetime, after `starts_at` |
| `priority` | nullable integer |
| `stop` | boolean, defaults false on create |
| `coupon` | nullable string, max 255, unique while ignoring the current Discount on update |
| `max_uses`, `max_uses_per_user` | nullable integer, minimum 0 |
| `data.min_prices.USD` | nullable numeric, minimum 0 |

Create auto-generates a handle only when no non-empty handle is submitted. Update always honors the submitted handle and never auto-slugs a changed name.

The API's externally visible money unit is **decimal USD**, e.g. `data.fixed_values.USD: 10.50`. Lunar's persisted `data.min_prices.USD` and `data.fixed_values.USD` are **integer minor units**, e.g. `1050`. The controller converts decimal USD to integer minor units with the audited USD factor of 100 before saving, and divides by 100 in resources. This conversion is required because the application’s custom `FixedAmountOffPerUnit::applyFixedValuePerUnit()` consumes `fixed_values` as minor units.

Type-specific request and response data is normalized; only the selected type's relevant keys persist:

| Type | Normalized `data` in Round 4a |
|---|---|
| AmountOff | `min_prices.USD`, `fixed_value`, then either `percentage` or `fixed_values.USD` |
| FixedAmountOffPerUnit | `min_prices.USD`, `fixed_value: true`, `fixed_values.USD` |
| BuyXGetY | `min_prices.USD`, `min_qty`, `reward_qty`, `max_reward_qty`, `automatically_add_rewards` |

AmountOff accepts percentage only when `fixed_value` is false and fixed USD only when it is true. FixedAmountOffPerUnit always saves `fixed_value: true` and a fixed USD value; it never offers or persists percentage configuration because its runtime ignores it. BuyXGetY only saves its core scalar configuration in this round. It does not create `lunar_discountables` reward records.

When type changes, server normalization discards stale amount or BuyXGetY keys. Client-side visibility is convenience only; server-side normalization is the protection boundary.

## Frontend design

### Routes and authorization

Add and export `canManageDiscounts(userRoles)` in `admin/src/App.tsx`. It delegates only to `isCoreAdministrator`; it must not reuse `canManageCommerce` or the Reviews predicate.

Add lazy-loaded guarded routes:

```text
/discounts       DiscountsListPage
/discounts/new   DiscountFormPage create mode
/discounts/:id   DiscountFormPage edit mode
```

Add a Sales sidebar item only for the same three core roles. Existing Orders/Returns, Reviews, Customers, Shipping, product, and home-route role policies remain unchanged.

### Typed API layer

`admin/src/features/discounts/api.ts` owns all Discount TypeScript contracts, normalized fetchers, payload builders, and React Query hooks. It uses the existing authenticated `fetchJson` client.

- list uses `GET /admin/discounts` with trimmed optional search and positive page;
- show uses `GET /admin/discounts/:id`;
- create, update, and delete use the corresponding core API methods;
- successful mutations invalidate both `['discounts']` and any active detail key.

The payload builder receives form strings and produces ISO UTC timestamps plus decimal values in the normalized nested `data` contract. It does not perform money conversion to minor units; that belongs only to the API server. Empty optional numeric fields become null. Payloads contain only the selected type’s `data` keys.

### Discounts list

The list uses the existing admin table visual language. It includes search, pagination, and columns for Status, Name, Type, Coupon, Starts, Ends, and actions. Status has a badge matching Lunar Filament semantics:

| Status | Visual color |
|---|---|
| active | green |
| expired | red |
| pending | gray |
| scheduled | blue |

Rows use the current kebab-menu action pattern to navigate to edit or open the shared deletion confirmation. A primary header action navigates to `/discounts/new`.

### Create/edit form

`DiscountFormPage` is a dedicated page, not a modal, because the form contains conditional sections and future rounds extend discount detail workflow.

The Core section contains name, handle, type, starts, ends, priority, and stop. On a new form open, starts uses the current browser-local minute. `datetime-local` state converts to ISO UTC immediately before submitting. A manual handle disables automatic name-derived handle changes; edit mode never auto-updates handle.

The Conditions section contains coupon, usage limits, and decimal minimum-cart USD.

The Type configuration section behaves as follows:

- AmountOff shows a fixed-value toggle. Percentage appears only when off; decimal fixed USD appears only when on.
- FixedAmountOffPerUnit shows only decimal per-unit USD and submits fixed semantics. It cannot create a percentage no-op configuration.
- BuyXGetY shows core quantity/automatic-reward fields only. It does not provide reward product selection.

Form validation provides immediate required/numeric/date errors and lets the backend remain authoritative for uniqueness, malformed payloads, and type normalization.

All new visible strings are `discounts.*` entries in English and Vietnamese.

## Testing and verification

TDD is mandatory: every behavior begins with a focused failing test before production implementation.

Backend feature coverage includes:

- all core-role grants and all excluded-role 403s;
- no arbitrary type class accepted;
- create/update validation, auto-handle rules, uniqueness, and time ordering;
- fixed/min-price decimal ↔ minor conversion;
- forced fixed semantics for FixedAmountOffPerUnit;
- BuyXGetY core-only storage and stale-key stripping;
- frozen-clock native Lunar statuses;
- grouped name/coupon search, pagination, explicit response contract, and delete.

Frontend coverage includes:

- typed paths, request methods, pagination/search serialization, and query invalidation;
- list table/status/action/delete behavior;
- form start default, local-to-UTC conversion, handle behavior, validation, conditional fields, and selected-type-only payloads;
- core-only routes/sidebar with non-core safe fallbacks and unchanged Sales policy coverage;
- EN/VI `discounts.*` keys used by the UI.

Final verification runs focused backend/frontend tests, relevant existing Commerce regressions, `npm test`, `npm run build`, route-surface checks, and `git diff --check`. Work remains uncommitted and is handed to Claude for final diff/role-gating review before any merge.
