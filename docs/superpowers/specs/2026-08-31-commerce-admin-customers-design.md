# Commerce Admin Customers — Round 3 Design

## Purpose
Migrate the read-only Customer administration surface from Filament into the React/Vite admin. This round provides customer discovery and read-only detail tabs only. It deliberately does not migrate account-management actions or Discounts.

## Scope

### Included
- Core-admin-only Customer list, search, status filter, and pagination.
- Core-admin-only Customer detail summary with independently loaded Orders, Address Book, and Login Accounts tabs.
- Read-only order summaries linking to the existing React order detail route.
- Read-only address records using the actual Lunar schema field `contact_email`.
- Read-only login-account records exposing only `id` and `email`.
- English and Vietnamese translations, React route/sidebar integration, backend and frontend regression coverage.

### Excluded
- Customer create, edit, delete, bulk delete, Customer Groups, profile changes, email changes, password resets, account activation changes, and any account mutation endpoint/UI.
- Changes to legacy Filament CustomerResource or its account actions.
- Changes to `AdminPermissionMatrix`, `EnforceAdminApiPermission`, checkout, public storefront APIs, Shipping, Reviews, Orders/Returns policy, Discounts, or Lunar vendor code.

## Source and Security Findings
- `CustomerResource` already derives list status from the first linked User's `is_active`; guests without a linked User are Active.
- Its legacy bulk-delete control is intentionally not migrated even though the Round 3 UI/API is read-only.
- Lunar's Address PHPDoc incorrectly calls the email field `contact_mail`; the authoritative Lunar migration `2021_07_30_100002_create_addresses_table.php` creates `contact_email`. This API/UI uses `contact_email`.
- Login Accounts legacy UI can mutate email/password. Round 3 intentionally exposes only the account identifier and email, without mutation methods or controls.

## Authorization
All Customer routes are nested under the existing `/api/admin` auth group and an additional route middleware group:

```php
Route::middleware('role:super_admin|admin|staff')->group(function () {
    // Customer read-only routes
});
```

No Customer ability is added to the permission matrix, and `EnforceAdminApiPermission` remains unchanged. The explicit nested role middleware provides the only Customer authorization in this round:

| Role | Customer API / React route / Sales link |
|---|---|
| super_admin, admin, staff | Allowed |
| Order Manager | Denied / fallback home |
| Support | Denied / fallback home |
| Product Manager | Denied / fallback home |

## API Contract

### `GET /api/admin/customers`
Query parameters: `search`, `status` (`active` or `inactive`), `page`.

Response is a Laravel paginator shape:

```json
{
  "data": [{
    "id": 42,
    "name": "Taylor Customer",
    "email": "taylor@example.com",
    "orders_count": 3,
    "orders_sum_total": 12999,
    "created_at": "2026-08-31T10:00:00+00:00",
    "status": "active"
  }],
  "meta": { "current_page": 1, "last_page": 1, "per_page": 15, "total": 1 }
}
```

- `orders_count` and `orders_sum_total` use `withCount('orders')` and `withSum('orders', 'total')`; the aggregate remains minor currency units to match Lunar/Filament aggregate semantics.
- `email` is the first linked user's email or `null`; React renders `Guest` from translation.
- `status` is `active` when first user is active or no user exists; otherwise `inactive`.
- Status predicate is applied before a grouped search predicate. Search may match first/last name or a linked user's email, but its `OR` clauses must be grouped so they cannot bypass status filtering.

### `GET /api/admin/customers/{customer}`
Returns a read-only summary including id, name, email, orders_count, orders_sum_total, created_at, and derived status. It does not eager-load tabs or expose account security fields.

### `GET /api/admin/customers/{customer}/orders`
Returns a paginated, newest-first array of minimum order summaries:

```json
{
  "data": [{
    "id": "100",
    "reference": "ORD-100",
    "status": "shipped",
    "status_label": "Shipped",
    "total": { "formatted": "$129.99 USD", "decimal": 129.99, "currency": "USD" },
    "created_at": "2026-08-31 10:00:00"
  }],
  "meta": { "current_page": 1, "last_page": 1, "per_page": 15, "total": 1 }
}
```

It must not reuse the full OrderResource or include lines, payment metadata, shipping/billing address, internal notes, or mutation affordances.

### `GET /api/admin/customers/{customer}/addresses`
Returns only read-only address fields needed by the Address Book table: id, title, first_name, last_name, line_one, line_two, line_three, city, state, postcode, contact_phone, contact_email, shipping_default, billing_default, created_at.

### `GET /api/admin/customers/{customer}/login-accounts`
Returns only `id` and `email` for linked users. Password, token, activity, account status, and pivot metadata are omitted.

There are no Customer POST, PUT, PATCH, or DELETE routes.

## React Design

### Data layer
`admin/src/features/customers/api.ts` owns the Customer types, query-string builders, fetchers, and React Query hooks. It normalizes the existing `{ data: ... }` API convention and keeps per-tab queries disabled until their tab is selected.

### List
`CustomersListPage.tsx` holds `search`, `status`, and `page` state. It presents a read-only customer table with a name link to `/customers/:id`, translated Guest display for `email: null`, aggregate total formatted from minor units, joined date, and status badge.

### Detail
`CustomerDetailPage.tsx` reads `id` from React Router and loads the summary immediately. Its local selected tab starts as Orders. The tab endpoint query is the only endpoint enabled for the selected tab:
- Orders renders pagination and links each order to `/orders/{id}`.
- Address Book renders the prescribed fields/default flags with no row actions.
- Login Accounts renders emails only with no edit/reset/password controls.

### Navigation
`canManageCustomers(userRoles)` is core-only. `/customers` and `/customers/:id` exist only under that predicate. AppShell adds Customers inside Sales only for core roles. Existing Shipping, Reviews, Orders, Return Requests, product routes, and fallback home selection are not altered.

### Translations
All visible Customer UI copy is through `customers.*` keys in `admin/src/locales/en.json` and `admin/src/locales/vi.json`, including the established `Address Book` and `Login Accounts` tab concepts.

## Verification Requirements
1. Backend TDD proves role denial, no mutation route, exact slim data contracts, guest status, status/search grouping, customer summary, orders pagination/order link summary, authoritative `contact_email`, and login account field minimization.
2. Frontend TDD proves query serialization, list state, tab lazy loading, order navigation, absence of account/address mutations, core-only route access, and Sales sidebar visibility.
3. Run focused backend tests with the established in-memory SQLite environment, full admin Vitest suite, admin production build, and `git diff --check`.
4. Changes remain uncommitted and unmerged until Claude reviews the final diff and verification evidence.
