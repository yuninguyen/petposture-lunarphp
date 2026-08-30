# Commerce Admin Customers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a core-admin-only, read-only Customers list and three-tab Customer detail surface to the React/Vite admin without migrating any Customer or Login Account mutations.

**Architecture:** A new read-only CustomerController supplies a paginated customer list, a lightweight customer summary, and independently paginated/lazy tab endpoints for order summaries, addresses, and login-account emails. The React feature owns typed API hooks, a list, and a tabbed detail view. It is route- and sidebar-gated by a new core-only Customer predicate; no Customer permissions are added to the existing matrix.

**Tech Stack:** Laravel 11, Eloquent/Lunar, Sanctum, Spatie role middleware, React, TypeScript, React Router, TanStack Query, Vitest, i18next.

**Spec:** `docs/superpowers/specs/2026-08-31-commerce-admin-customers-design.md`

## Global Constraints

- Every Customer route is read-only and nested under `role:super_admin|admin|staff`; do not add Customer permissions or edit `EnforceAdminApiPermission`.
- Do not add Customer POST, PUT, PATCH, DELETE, account mutation, Customer Group, Discount, public storefront, checkout, Shipping, Reviews, or legacy Filament changes.
- Use `contact_email`, not Lunar's incorrect `contact_mail` PHPDoc annotation; migration `2021_07_30_100002_create_addresses_table.php` is authoritative.
- Keep guest Customers Active; derive non-guest status from the first linked User's `is_active` exactly as current Filament behavior does.
- Group `search` OR predicates inside a closure after applying the status filter so search cannot bypass status scope.
- Login Account data must contain only `id` and `email`; it must not contain password/token/activity/status/pivot fields.
- Customer order lists must return summaries only, not the full `OrderResource` and not lines/payment/address/internal-note data.
- Use `customers.*` for all Customer UI copy in both locales.
- Do not commit, push, or merge into `main`; leave the worktree and verification evidence for Claude final review.
- Before editing an existing symbol, run required GitNexus impact analysis when available and report high/critical risk before code changes.

---

## File Structure

| File | Responsibility |
|---|---|
| `backend/app/Http/Controllers/Api/Admin/CustomerController.php` | Read-only list, summary, tab endpoint queries, and explicitly minimized response mappings. |
| `backend/routes/api.php` | Core-only Customer route group under existing admin auth group. |
| `backend/tests/Feature/Api/Admin/CustomerControllerTest.php` | Backend authorization, list/search/status, summary/tab contract, pagination, and no-mutation regression tests. |
| `admin/src/features/customers/api.ts` | Customer types, query builders, fetchers, and React Query hooks. |
| `admin/src/features/customers/api.test.ts` | Query serialization and API method/path contract tests. |
| `admin/src/features/customers/CustomersListPage.tsx` | Read-only filtered/paginated customer list. |
| `admin/src/features/customers/CustomersListPage.test.tsx` | List data/status/Guest/filter/pagination/customer navigation UI tests. |
| `admin/src/features/customers/CustomerDetailPage.tsx` | Summary header and lazy Orders/Address Book/Login Accounts tabs. |
| `admin/src/features/customers/CustomerDetailPage.test.tsx` | Tab lazy-query, order link, PII tab display, and no-mutation UI tests. |
| `admin/src/App.tsx` | Core-only Customer predicate and guarded list/detail routes. |
| `admin/src/App.test.ts` | Actual route eligibility/fallback tests for all non-core commerce roles. |
| `admin/src/layouts/AppShell.tsx` | Core-only Customers Sales sidebar item. |
| `admin/src/layouts/AppShell.test.tsx` | Customers sidebar visibility tests without changing other Sales policies. |
| `admin/src/locales/en.json` | English Customer UI copy. |
| `admin/src/locales/vi.json` | Vietnamese Customer UI copy. |

## Task 1: Customer list API and core-only route boundary

**Files:**
- Create: `backend/app/Http/Controllers/Api/Admin/CustomerController.php`
- Create: `backend/tests/Feature/Api/Admin/CustomerControllerTest.php`
- Modify: `backend/routes/api.php: import section and end of existing core-only Shipping route group`

**Interfaces:**
- Produces `CustomerController::index(Request $request): JsonResponse`.
- Produces `GET /api/admin/customers?search={string}&status={active|inactive}&page={positive integer}`.
- Returns `data` entries with `id`, `name`, `email`, `orders_count`, `orders_sum_total`, `created_at`, `status`, plus Laravel paginator `meta`.
- Consumes Lunar `Customer` relationships `users()` and `orders()`.

- [ ] **Step 1: Write failing list/authorization tests**

Create test fixtures for a core admin, an Order Manager, Support, Product Manager, an active account Customer, an inactive account Customer, and a guest Customer. Add tests with the following behavioral assertions:

```php
public function test_core_admin_lists_customers_with_filament_equivalent_aggregates_and_guest_status(): void
{
    $response = $this->actingAs($this->coreAdmin())->getJson('/api/admin/customers');

    $response->assertOk()
        ->assertJsonPath('data.0.email', null)
        ->assertJsonPath('data.0.status', 'active')
        ->assertJsonStructure(['data' => [[
            'id', 'name', 'email', 'orders_count', 'orders_sum_total', 'created_at', 'status',
        ]], 'meta' => ['current_page', 'last_page', 'per_page', 'total']]);
}

public function test_status_scope_is_not_bypassed_by_a_matching_search_term(): void
{
    $response = $this->actingAs($this->coreAdmin())
        ->getJson('/api/admin/customers?status=active&search=Inactive%20Taylor');

    $response->assertOk()->assertJsonCount(0, 'data');
}

public function test_non_core_roles_cannot_access_customer_list(): void
{
    foreach (['Order Manager', 'Support', 'Product Manager'] as $role) {
        $this->actingAs($this->userWithRole($role))->getJson('/api/admin/customers')->assertForbidden();
    }
}
```

Also assert active/inactive filtering, name search, linked-email search, and no Customer mutation route (`postJson`, `putJson`, `patchJson`, and `deleteJson` each receive 405 or 404).

- [ ] **Step 2: Run the focused test and verify RED**

Run from `backend`:

```powershell
$env:APP_ENV='testing'; $env:MAIL_MAILER='array'; $env:DB_CONNECTION='sqlite'; $env:DB_DATABASE=':memory:'; $env:APP_KEY='base64:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='; php artisan test tests/Feature/Api/Admin/CustomerControllerTest.php
```

Expected: failure because `GET /api/admin/customers` and CustomerController do not exist.

- [ ] **Step 3: Implement the minimum list controller and core-only list route**

Implement a private mapper and grouped list query:

```php
Customer::query()
    ->with('users')
    ->withCount('orders')
    ->withSum('orders', 'total')
    ->when($status === 'active', fn (Builder $query) => $query->whereDoesntHave(
        'users', fn (Builder $users) => $users->where('is_active', false),
    ))
    ->when($status === 'inactive', fn (Builder $query) => $query->whereHas(
        'users', fn (Builder $users) => $users->where('is_active', false),
    ))
    ->when($search !== '', fn (Builder $query) => $query->where(function (Builder $searchQuery) use ($search) {
        $searchQuery->where('first_name', 'like', "%{$search}%")
            ->orWhere('last_name', 'like', "%{$search}%")
            ->orWhereHas('users', fn (Builder $users) => $users->where('email', 'like', "%{$search}%"));
    }))
    ->latest('created_at')
    ->paginate(15);
```

Map status using the first loaded User: `($customer->users->first()?->is_active ?? true) ? 'active' : 'inactive'`. Return a standard paginator response with resource-mapped `data`; do not expose `users` relation objects or customer metadata.

Register the list route in a new nested group exactly like Shipping:

```php
Route::middleware('role:super_admin|admin|staff')->group(function () {
    Route::get('/customers', [CustomerController::class, 'index']);
});
```

- [ ] **Step 4: Run focused GREEN tests and static checks**

Run the Step 2 command. Then run:

```powershell
php -l app/Http/Controllers/Api/Admin/CustomerController.php
php -l routes/api.php
git diff --check
```

Expected: Customer list test passes, non-core roles are 403, no Customer mutations exist, and no whitespace errors.

- [ ] **Step 5: Leave changes uncommitted for review**

Do not commit or merge. Record the exact command result in the task report/ledger for Claude review.

## Task 2: Customer summary and independently paginated read-only tab endpoints

**Files:**
- Modify: `backend/app/Http/Controllers/Api/Admin/CustomerController.php`
- Modify: `backend/routes/api.php: Customer core-only group`
- Modify: `backend/tests/Feature/Api/Admin/CustomerControllerTest.php`

**Interfaces:**
- Produces `show(Customer $customer)`, `orders(Customer $customer, Request $request)`, `addresses(Customer $customer)`, and `loginAccounts(Customer $customer)`.
- Produces routes, ordered before any generic Customer binding conflict:
  - `GET /api/admin/customers/{customer}`
  - `GET /api/admin/customers/{customer}/orders?page={positive integer}`
  - `GET /api/admin/customers/{customer}/addresses`
  - `GET /api/admin/customers/{customer}/login-accounts`
- Consumes Task 1's customer-summary mapper.

- [ ] **Step 1: Add failing tab contract tests**

Add tests that create more than 15 Customer orders, two addresses, and two linked Users. Assert:

```php
$response = $this->actingAs($this->coreAdmin())
    ->getJson("/api/admin/customers/{$customer->id}/orders?page=2");

$response->assertOk()
    ->assertJsonPath('meta.current_page', 2)
    ->assertJsonStructure(['data' => [[
        'id', 'reference', 'status', 'status_label', 'total' => ['formatted', 'decimal', 'currency'], 'created_at',
    ]]]);
```

Assert every order summary has none of `lines`, `payment_method`, `shipping_address`, `billing_address`, `notes`, `internal_note`, or `available_actions`. Assert Address Book items include `contact_email` and defaults, but not `meta`. Assert Login Accounts items are exactly `id` and `email`. Assert each endpoint is forbidden to Order Manager, Support, and Product Manager.

- [ ] **Step 2: Run focused tests and verify RED**

Run the Task 1 backend command targeting `CustomerControllerTest.php`.

Expected: route/controller failures for `show`, `orders`, `addresses`, and `login-accounts`.

- [ ] **Step 3: Implement slim response mappings and endpoints**

Use `Customer` route-model binding. Implement:

```php
public function orders(Customer $customer, Request $request): JsonResponse
{
    $orders = $customer->orders()->with('currency')->latest('created_at')->paginate(15);

    return response()->json($this->paginate($orders, fn (Order $order) => $this->orderSummary($order)));
}
```

`orderSummary` must explicitly construct only id, reference, status, headline status_label, total formatted/decimal/currency, and created_at. Convert Lunar money objects or integer minor values to decimal in a small private helper. Do not instantiate `OrderResource`.

For addresses, select/map only: `id`, `title`, `first_name`, `last_name`, `line_one`, `line_two`, `line_three`, `city`, `state`, `postcode`, `contact_phone`, `contact_email`, `shipping_default`, `billing_default`, `created_at`.

For login accounts, load/select only Users' `id,email` and map exactly those fields. Summary/show uses the same list-style summary mapper with orders aggregate and first User email/status; it must not include tabs in the response.

Add all four routes inside Task 1's same explicit core-only group. Keep no mutation routes.

- [ ] **Step 4: Run focused GREEN and adjacent regression tests**

Run:

```powershell
$env:APP_ENV='testing'; $env:MAIL_MAILER='array'; $env:DB_CONNECTION='sqlite'; $env:DB_DATABASE=':memory:'; $env:APP_KEY='base64:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='; php artisan test tests/Feature/Api/Admin/CustomerControllerTest.php tests/Feature/AdminPermissionMatrixTest.php tests/Feature/CheckoutApiTest.php
```

Expected: all Customer contracts/role tests pass; existing permission and checkout tests remain green.

- [ ] **Step 5: Leave changes uncommitted for review**

Run `git diff --check`. Do not commit, push, or merge.

## Task 3: Typed Customer React API, list, core-only route, and Sales navigation

**Files:**
- Create: `admin/src/features/customers/api.ts`
- Create: `admin/src/features/customers/api.test.ts`
- Create: `admin/src/features/customers/CustomersListPage.tsx`
- Create: `admin/src/features/customers/CustomersListPage.test.tsx`
- Modify: `admin/src/App.tsx`
- Modify: `admin/src/App.test.ts`
- Modify: `admin/src/layouts/AppShell.tsx`
- Modify: `admin/src/layouts/AppShell.test.tsx`
- Modify: `admin/src/locales/en.json`
- Modify: `admin/src/locales/vi.json`

**Interfaces:**
- Produces `Customer`, `CustomerListPage`, `CustomerFilters`, `buildCustomersQuery`, `fetchCustomers`, and `useCustomers` from `api.ts`.
- Produces `canManageCustomers(userRoles: string[]): boolean` that is true only for `super_admin`, `admin`, `staff`.
- Produces a guarded `/customers` route and core-only `/customers` Sales link.
- Consumes Task 1 list endpoint.

- [ ] **Step 1: Write failing API/list/role tests**

Write API tests for exact serialization:

```ts
expect(buildCustomersQuery({ search: 'Taylor Customer', status: 'inactive', page: 2 }))
  .toBe('/admin/customers?search=Taylor+Customer&status=inactive&page=2');
```

Write a list-page test with a Guest row (`email: null`) and an inactive row. Assert translated Guest display, the status badge, minor-unit total display, search/status changes resetting page to 1, and clicking the customer name navigates to `/customers/42`.

Extend App tests to prove `canManageCustomers` is true for every core role and false for Support, Order Manager, and Product Manager. Render `/customers` for every non-core role and assert the existing safe fallback home—not customer content—renders. Extend AppShell tests so Customers appears for core only while existing Shipping/Reviews/Orders/Returns visibility remains unchanged.

- [ ] **Step 2: Run focused frontend tests and verify RED**

Run from `admin`:

```powershell
npm test -- src/features/customers/api.test.ts src/features/customers/CustomersListPage.test.tsx src/App.test.ts src/layouts/AppShell.test.tsx
```

Expected: missing Customer modules, predicate, route, navigation item, and translations cause failure.

- [ ] **Step 3: Implement the typed list API, page, route/sidebar, and translations**

Implement types and API functions following `features/orders/api.ts`:

```ts
export interface CustomerFilters { search?: string; status?: 'active' | 'inactive'; page?: number }

export function buildCustomersQuery(filters: CustomerFilters): string {
  const params = new URLSearchParams();
  if (filters.search?.trim()) params.set('search', filters.search.trim());
  if (filters.status) params.set('status', filters.status);
  if (filters.page) params.set('page', String(filters.page));
  const query = params.toString();
  return `/admin/customers${query ? `?${query}` : ''}`;
}
```

`CustomersListPage` has no action buttons. Customer name uses `useNavigate()` to link to `/customers/${customer.id}`. Render email null as `t('customers.guest')`; format `orders_sum_total / 100` in the same dollar-oriented convention as current Filament list; use `customers.*` for all visible content.

Add a lazy Customer list import, `canManageCustomers`, and core-only `/customers` route without modifying `canManageCommerce`, Shipping, Reviews, Orders, Returns, product access, or home selection. Add a core-only Customers item to the existing Sales group. Add complete English/Vietnamese Customer keys used by the list.

- [ ] **Step 4: Run focused frontend GREEN tests**

Run the Step 2 command.

Expected: list UI, core-only route/sidebar, and all pre-existing Sales role tests pass.

- [ ] **Step 5: Leave changes uncommitted for review**

Run `git diff --check`. Do not commit, push, or merge.

## Task 4: Customer detail summary and lazy read-only tabs

**Files:**
- Create: `admin/src/features/customers/CustomerDetailPage.tsx`
- Create: `admin/src/features/customers/CustomerDetailPage.test.tsx`
- Modify: `admin/src/features/customers/api.ts`
- Modify: `admin/src/features/customers/api.test.ts`
- Modify: `admin/src/App.tsx`
- Modify: `admin/src/App.test.ts`
- Modify: `admin/src/locales/en.json`
- Modify: `admin/src/locales/vi.json`

**Interfaces:**
- Produces `fetchCustomer`, `fetchCustomerOrders`, `fetchCustomerAddresses`, `fetchCustomerLoginAccounts` and tab hooks in `api.ts`.
- Produces `CustomerDetailPage` at `/customers/:id`.
- Consumes Task 2 endpoints and Task 3 Customer types/role predicate.

- [ ] **Step 1: Write failing tab behavior tests**

Mock Customer hooks and write tests proving:

```ts
expect(useCustomer).toHaveBeenCalledWith('42');
expect(useCustomerOrders).toHaveBeenCalledWith('42', 1, true);
expect(useCustomerAddresses).toHaveBeenCalledWith('42', false);
expect(useCustomerLoginAccounts).toHaveBeenCalledWith('42', false);
```

After clicking Address Book, assert the address hook becomes enabled and order/login queries are not newly enabled. After clicking Login Accounts, assert only `id,email` data is displayed and the DOM contains no Edit, Reset Password, password input, email input, checkbox, or mutation button. Assert an Order summary link points to `/orders/100`. Assert no address row has a mutation action. Add the `/customers/:id` core-only route/fallback test.

- [ ] **Step 2: Run focused tab tests and verify RED**

Run from `admin`:

```powershell
npm test -- src/features/customers/api.test.ts src/features/customers/CustomerDetailPage.test.tsx src/App.test.ts
```

Expected: missing detail fetchers, hooks, route, and detail component cause failure.

- [ ] **Step 3: Implement summary and lazy tab queries/UI**

Add explicit fetchers:

```ts
export function useCustomerOrders(id: string | undefined, page: number, enabled: boolean) {
  return useQuery({
    queryKey: ['customers', id, 'orders', page],
    queryFn: () => fetchCustomerOrders(id!, page),
    enabled: Boolean(id) && enabled,
  });
}
```

Mirror this enabled pattern for addresses and login accounts. `CustomerDetailPage` uses local `tab` state, defaulting to `orders`; it loads summary immediately and only enables the currently selected tab.

Orders render reference/status/total/date and React Router `Link` to `/orders/${order.id}` with own pagination. Address Book renders only the Task 2 fields and translated shipping/billing default markers. Login Accounts renders a simple read-only email table/list. Do not create any mutation function, form, row action, kebab menu, or account setting control. Add only required `customers.*` translations and guarded `/customers/:id` route.

- [ ] **Step 4: Run focused frontend GREEN tests**

Run the Step 2 command.

Expected: summary loads, tabs are lazy, order links work, no mutation UI exists, and non-core roles retain safe fallback behavior.

- [ ] **Step 5: Leave changes uncommitted for review**

Run `git diff --check`. Do not commit, push, or merge.

## Task 5: Whole-scope verification and Claude handoff

**Files:**
- Modify only if a test exposes an in-scope defect: files named in Tasks 1–4.
- Do not create customer mutations, permission-matrix entries, Discount code, or unrelated cleanups.

**Interfaces:**
- Consumes the complete API and React surface produced by Tasks 1–4.
- Produces fresh verification evidence and an uncommitted worktree for Claude review.

- [ ] **Step 1: Re-read the spec against changed files**

Create a checklist from `docs/superpowers/specs/2026-08-31-commerce-admin-customers-design.md` and verify every included contract maps to a changed file/test. Verify excluded scopes have no changed file.

- [ ] **Step 2: Run full backend Customer/Commerce verification**

Run from `backend`:

```powershell
$env:APP_ENV='testing'; $env:MAIL_MAILER='array'; $env:DB_CONNECTION='sqlite'; $env:DB_DATABASE=':memory:'; $env:APP_KEY='base64:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='; php artisan test tests/Feature/Api/Admin/CustomerControllerTest.php tests/Feature/Api/Admin/ShippingMethodControllerTest.php tests/Feature/Api/Admin/ReviewControllerTest.php tests/Feature/ReviewLifecycleTest.php tests/Feature/AdminPermissionMatrixTest.php tests/Feature/CheckoutApiTest.php
```

Expected: no failures. If absent-worktree `.env` warnings appear, record them separately from test failures.

- [ ] **Step 3: Run full React verification**

Run from `admin`:

```powershell
npm test
npm run build
```

Expected: all Vitest files/tests pass and TypeScript/Vite build exits 0.

- [ ] **Step 4: Check diff scope and whitespace**

Run from the worktree root:

```powershell
git diff --check
git status --short
git diff --name-only
```

Expected: Customer-specific backend/admin/test/locale files only, plus the approved spec/plan artifacts; no Discounts, matrix, Enforce middleware, public checkout, vendor, or Filament files.

- [ ] **Step 5: Submit for Claude final review without integration**

Report changed files, exact verification results, authorization matrix evidence, excluded security-sensitive Login Account mutations, and any non-failing environment warnings. Do not commit, push, merge, or modify `main`.
