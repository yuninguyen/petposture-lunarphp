# Round 4a Commerce Admin Discounts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a core-admin-only Vite/React Discount CRUD surface backed by a strict Laravel/Lunar API, with correct decimal USD to Lunar minor-unit conversion.

**Architecture:** A `DiscountController` exposes an explicit, normalized `data` contract over the Lunar Discount model while keeping the database’s minor-unit values internal. The frontend owns typed list/detail/mutation hooks and dedicated list/form pages; core-only route and sidebar gates reuse the existing `isCoreAdministrator` boundary without changing any existing role policy.

**Tech Stack:** Laravel 11, Sanctum, Spatie Permission, Lunar, PHP feature tests, React 18, React Router, TanStack React Query, i18next, Vitest, Vite.

**Spec:** `docs/superpowers/specs/2026-08-31-commerce-admin-discounts-round4a-design.md`

## Global Constraints

- Work only in `C:\laragon\www\petposture\.worktrees\commerce-admin-migration`; do not touch the dirty main checkout.
- The allowed roles are exactly `super_admin`, `admin`, and `staff`; `Order Manager`, `Support`, and `Product Manager` are forbidden.
- Add no `AdminPermissionMatrix` Discount domain and do not modify `EnforceAdminApiPermission`.
- The only allowed discount type class strings are `Lunar\DiscountTypes\AmountOff`, `Lunar\DiscountTypes\BuyXGetY`, and `App\Lunar\DiscountTypes\FixedAmountOffPerUnit`.
- API and React form money values are decimal USD. Persisted Lunar `data.min_prices.USD` and `data.fixed_values.USD` are integer minor units at factor 100.
- FixedAmountOffPerUnit must always persist `data.fixed_value: true` and must never accept/store percentage configuration.
- The server strips stale type-specific keys even when a client submits hidden form state.
- Do not implement limitations, product/collection conditions, reward products, availability pages, customer groups, channels, checkout changes, vendor edits, data migration, public storefront behavior, or bulk actions.
- Add all visible Discount copy as `discounts.*` keys in both `admin/src/locales/en.json` and `admin/src/locales/vi.json`.
- Follow TDD: write each test first, run and observe its intended RED failure, then make the smallest implementation and run GREEN.
- Before editing existing symbols, run the available GitNexus impact analysis and report any HIGH/CRITICAL result; GitNexus MCP may be unavailable, in which case record that limitation in the task report.
- Do not commit, merge, or push to `main`. Leave all implementation changes for Claude final review.

---

## File map

| File | Responsibility |
|---|---|
| `backend/app/Http/Controllers/Api/Admin/DiscountController.php` | Read/write Discount API, hard type map, validation, decimal/minor conversion, explicit response resources. |
| `backend/routes/api.php` | Nested core-only Discount CRUD route declarations. |
| `backend/tests/Feature/Api/Admin/DiscountControllerTest.php` | Feature-level authorization, CRUD, contract, normalization, conversion, status, and deletion regression coverage. |
| `admin/src/features/discounts/api.ts` | Discount types, data/form payload builder, fetchers and React Query hooks. |
| `admin/src/features/discounts/api.test.ts` | API path/method, response normalization, decimal/UTC/type payload tests. |
| `admin/src/features/discounts/DiscountsListPage.tsx` | Searchable, paginated Discount table and delete orchestration. |
| `admin/src/features/discounts/DiscountsListPage.test.tsx` | List columns, status badge, search/page navigation, row action/delete tests. |
| `admin/src/features/discounts/DiscountRowActions.tsx` | Reusable kebab edit/delete menu for one Discount row. |
| `admin/src/features/discounts/DiscountFormPage.tsx` | Dedicated create/edit form, local-time form state, type sections, client validation and submit navigation. |
| `admin/src/features/discounts/DiscountFormPage.test.tsx` | Form default/handle/date/type visibility/payload/mutation behavior tests. |
| `admin/src/App.tsx` | `canManageDiscounts`, lazy imports, and guarded Discounts routes. |
| `admin/src/App.test.ts` | Discounts role predicate/route/fallback tests while preserving prior route tests. |
| `admin/src/layouts/AppShell.tsx` | Core-only Sales navigation item. |
| `admin/src/layouts/AppShell.test.tsx` | Sidebar Discounts core-only visibility and existing Sales-policy regression tests. |
| `admin/src/locales/en.json` | English `discounts.*` labels and messages. |
| `admin/src/locales/vi.json` | Vietnamese `discounts.*` labels and messages. |

## Shared contracts

### Backend request and response

```php
// POST / PUT / PATCH request shape; decimal values are API values, not database minor units.
[
    'name' => 'Ten percent off',
    'handle' => 'ten-percent-off', // optional only on POST; controller derives it if omitted/blank
    'coupon' => 'SAVE10',
    'type' => Lunar\DiscountTypes\AmountOff::class,
    'starts_at' => '2026-08-31T12:00:00.000Z',
    'ends_at' => null,
    'priority' => 5,
    'stop' => false,
    'max_uses' => 100,
    'max_uses_per_user' => 1,
    'data' => [
        'min_prices' => ['USD' => 25.00],
        'fixed_value' => false,
        'percentage' => 10.0,
    ],
]

// resource data keys, used by list and show
[
    'id' => 1,
    'name' => 'Ten percent off',
    'handle' => 'ten-percent-off',
    'coupon' => 'SAVE10',
    'type' => Lunar\DiscountTypes\AmountOff::class,
    'type_label' => 'Amount off',
    'status' => 'active',
    'starts_at' => '2026-08-31T12:00:00.000Z',
    'ends_at' => null,
    'uses' => 0,
    'max_uses' => 100,
    'max_uses_per_user' => 1,
    'priority' => 5,
    'stop' => false,
    'data' => [
        'min_prices' => ['USD' => 25.00],
        'fixed_value' => false,
        'percentage' => 10.0,
    ],
    'created_at' => '2026-08-31T12:00:00.000Z',
    'updated_at' => '2026-08-31T12:00:00.000Z',
]
```

Pagination envelope is exactly:

```php
[
    'data' => [/* normalized Discount resources */],
    'meta' => ['current_page' => 1, 'last_page' => 1, 'per_page' => 15, 'total' => 1],
]
```

### Frontend API contracts

```ts
export type DiscountType =
  | 'Lunar\\DiscountTypes\\AmountOff'
  | 'Lunar\\DiscountTypes\\BuyXGetY'
  | 'App\\Lunar\\DiscountTypes\\FixedAmountOffPerUnit';
export type DiscountStatus = 'active' | 'expired' | 'pending' | 'scheduled';

export interface DiscountData {
  min_prices: { USD: number | null };
  fixed_value?: boolean;
  percentage?: number | null;
  fixed_values?: { USD: number | null };
  min_qty?: number | null;
  reward_qty?: number | null;
  max_reward_qty?: number | null;
  automatically_add_rewards?: boolean;
}

export interface Discount {
  id: number;
  name: string;
  handle: string;
  coupon: string | null;
  type: DiscountType;
  type_label: string;
  status: DiscountStatus;
  starts_at: string;
  ends_at: string | null;
  uses: number;
  max_uses: number | null;
  max_uses_per_user: number | null;
  priority: number | null;
  stop: boolean;
  data: DiscountData;
  created_at: string;
  updated_at: string;
}

export interface DiscountCreatePayload {
  name: string;
  handle?: string;
  type: DiscountType;
  starts_at: string;
  ends_at: string | null;
  coupon: string | null;
  priority: number | null;
  stop: boolean;
  max_uses: number | null;
  max_uses_per_user: number | null;
  data: DiscountData;
}
export type DiscountUpdatePayload = Required<Pick<DiscountCreatePayload, 'name' | 'handle' | 'type' | 'starts_at' | 'ends_at' | 'coupon' | 'priority' | 'stop' | 'max_uses' | 'max_uses_per_user' | 'data'>>;

export interface DiscountFormValues {
  name: string;
  handle: string;
  type: DiscountType;
  starts_at: string; // browser datetime-local string
  ends_at: string;
  coupon: string;
  priority: string;
  stop: boolean;
  max_uses: string;
  max_uses_per_user: string;
  min_price_usd: string;
  fixed_value: boolean;
  percentage: string;
  fixed_value_usd: string;
  min_qty: string;
  reward_qty: string;
  max_reward_qty: string;
  automatically_add_rewards: boolean;
}

export function buildDiscountPayload(values: DiscountFormValues): DiscountCreatePayload;
export function buildDiscountUpdatePayload(values: DiscountFormValues): DiscountUpdatePayload;
export function toLocalDateTimeValue(iso: string): string;
export function toIsoUtc(value: string): string;
```

## Task 1: Backend Discount API and normalization boundary

**Files:**
- Create: `backend/app/Http/Controllers/Api/Admin/DiscountController.php`
- Create: `backend/tests/Feature/Api/Admin/DiscountControllerTest.php`
- Modify: `backend/routes/api.php:270-283`

**Interfaces:**
- Consumes: Lunar `Discount` model, its status accessor, the three approved type classes, and existing nested core-role route pattern.
- Produces: the request/resource and pagination contracts in Shared contracts, consumed by Tasks 2–4.

- [ ] **Step 1: Write failing feature tests for the route surface, a full AmountOff CRUD flow, and exact response keys.**

```php
public function test_core_admin_creates_lists_shows_updates_and_deletes_a_normalized_amount_off_discount(): void
{
    $this->actingAsCoreAdmin();

    $created = $this->postJson('/api/admin/discounts', [
        'name' => 'Ten percent off',
        'type' => AmountOff::class,
        'starts_at' => '2026-08-31T12:00:00.000Z',
        'priority' => 5,
        'stop' => false,
        'data' => [
            'min_prices' => ['USD' => 25.00],
            'fixed_value' => false,
            'percentage' => 10.0,
        ],
    ])->assertCreated();

    $created->assertJsonPath('data.handle', 'ten-percent-off')
        ->assertJsonPath('data.data.min_prices.USD', 25.0)
        ->assertJsonPath('data.data.percentage', 10.0);
    $this->assertSame(['id', 'name', 'handle', 'coupon', 'type', 'type_label', 'status', 'starts_at', 'ends_at', 'uses', 'max_uses', 'max_uses_per_user', 'priority', 'stop', 'data', 'created_at', 'updated_at'], array_keys($created->json('data')));

    $id = $created->json('data.id');
    $this->getJson('/api/admin/discounts')->assertOk()->assertJsonPath('meta.per_page', 15);
    $this->getJson("/api/admin/discounts/{$id}")->assertOk();
    $this->putJson("/api/admin/discounts/{$id}", $this->amountOffPayload(['name' => 'Renamed', 'handle' => 'manual-handle']))->assertOk()->assertJsonPath('data.handle', 'manual-handle');
    $this->deleteJson("/api/admin/discounts/{$id}")->assertNoContent();
}
```

- [ ] **Step 2: Run the feature test to observe RED.**

Run from `backend`:

```powershell
$env:APP_ENV='testing'; $env:MAIL_MAILER='array'; $env:DB_CONNECTION='sqlite'; $env:DB_DATABASE=':memory:'; $env:APP_KEY='base64:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='; php artisan test tests/Feature/Api/Admin/DiscountControllerTest.php
```

Expected: FAIL because DiscountController and `/api/admin/discounts` routes do not exist.

- [ ] **Step 3: Add the controller, nested route group, hard type map, and minimal resource/pagination implementation.**

```php
private const TYPES = [
    AmountOff::class => 'Amount off',
    BuyXGetY::class => 'Buy X Get Y',
    FixedAmountOffPerUnit::class => 'Fixed amount per unit',
];

private function resource(Discount $discount): array
{
    return [
        'id' => $discount->id,
        'name' => $discount->name,
        'handle' => $discount->handle,
        'coupon' => $discount->coupon,
        'type' => $discount->type,
        'type_label' => self::TYPES[$discount->type],
        'status' => $discount->status,
        'starts_at' => $discount->starts_at?->toISOString(),
        'ends_at' => $discount->ends_at?->toISOString(),
        'uses' => $discount->uses,
        'max_uses' => $discount->max_uses,
        'max_uses_per_user' => $discount->max_uses_per_user,
        'priority' => $discount->priority,
        'stop' => (bool) $discount->stop,
        'data' => $this->dataForResponse($discount),
        'created_at' => $discount->created_at?->toISOString(),
        'updated_at' => $discount->updated_at?->toISOString(),
    ];
}
```

```php
Route::middleware('role:super_admin|admin|staff')->group(function () {
    Route::get('/discounts', [DiscountController::class, 'index']);
    Route::post('/discounts', [DiscountController::class, 'store']);
    Route::get('/discounts/{discount}', [DiscountController::class, 'show']);
    Route::put('/discounts/{discount}', [DiscountController::class, 'update']);
    Route::patch('/discounts/{discount}', [DiscountController::class, 'update']);
    Route::delete('/discounts/{discount}', [DiscountController::class, 'destroy']);
});
```

Use `Discount::query()->latest('created_at')->paginate(15)` and map paginator collection to the explicit resource. In `index`, nest the `name`/`coupon` OR predicates in one closure only when a trimmed search term exists.

- [ ] **Step 4: Add RED-first feature tests for validation, normalization, authorization, status, and search.**

```php
public function test_only_the_three_hard_coded_discount_types_are_accepted(): void
{
    $this->actingAsCoreAdmin();
    $this->postJson('/api/admin/discounts', $this->amountOffPayload([
        'type' => 'App\\Services\\ArbitraryClass',
    ]))->assertUnprocessable()->assertJsonValidationErrors('type');
}

public function test_money_is_converted_between_decimal_api_values_and_lunar_minor_units(): void
{
    $this->actingAsCoreAdmin();
    $response = $this->postJson('/api/admin/discounts', $this->amountOffPayload([
        'data' => ['min_prices' => ['USD' => 12.50], 'fixed_value' => true, 'fixed_values' => ['USD' => 3.25]],
    ]))->assertCreated();

    $discount = Discount::findOrFail($response->json('data.id'));
    $this->assertSame(1250, $discount->data['min_prices']['USD']);
    $this->assertSame(325, $discount->data['fixed_values']['USD']);
    $response->assertJsonPath('data.data.fixed_values.USD', 3.25);
}

public function test_per_unit_forces_fixed_value_and_discards_percentage(): void
{
    $this->actingAsCoreAdmin();
    $response = $this->postJson('/api/admin/discounts', $this->amountOffPayload([
        'type' => FixedAmountOffPerUnit::class,
        'data' => ['fixed_value' => false, 'percentage' => 25, 'fixed_values' => ['USD' => 2.50]],
    ]))->assertCreated();

    $discount = Discount::findOrFail($response->json('data.id'));
    $this->assertTrue($discount->data['fixed_value']);
    $this->assertArrayNotHasKey('percentage', $discount->data);
    $this->assertSame(250, $discount->data['fixed_values']['USD']);
}
```

Also add exact tests for: omitted create handle becomes slug; update after name change retains submitted handle; duplicate handle/coupon; absent or invalid fields; `ends_at` before `starts_at`; numeric values below zero; AmountOff percentage branch strips `fixed_values`; AmountOff fixed branch strips `percentage`; BuyXGetY stores only its four data keys plus `min_prices`; changing an AmountOff record to BuyXGetY strips old amount keys; all three non-core roles get 403 for every endpoint; all three core roles get 200 on index; and delete removes a Discount.

Freeze time with `Carbon::setTestNow('2026-08-31 12:00:00 UTC')` and create Discounts at a past start/no end (active), past end (expired), start exactly now (pending), and future start (scheduled). Assert all four status strings. Create 16 records to prove independent 15-item page 2 metadata/newest-first order. Assert a matching coupon and a matching name are each found by search, while an unmatched term returns no rows.

- [ ] **Step 5: Implement validation and server-side normalization.**

```php
private function normalizedData(array $validated): array
{
    $incoming = $validated['data'] ?? [];
    $data = ['min_prices' => ['USD' => $this->minor($incoming['min_prices']['USD'] ?? null)]];

    return match ($validated['type']) {
        AmountOff::class => ($incoming['fixed_value'] ?? false)
            ? [...$data, 'fixed_value' => true, 'fixed_values' => ['USD' => $this->minor($incoming['fixed_values']['USD'] ?? null)]]
            : [...$data, 'fixed_value' => false, 'percentage' => $incoming['percentage'] ?? null],
        FixedAmountOffPerUnit::class => [...$data, 'fixed_value' => true, 'fixed_values' => ['USD' => $this->minor($incoming['fixed_values']['USD'] ?? null)]],
        BuyXGetY::class => [...$data,
            'min_qty' => $incoming['min_qty'] ?? null,
            'reward_qty' => $incoming['reward_qty'] ?? null,
            'max_reward_qty' => $incoming['max_reward_qty'] ?? null,
            'automatically_add_rewards' => (bool) ($incoming['automatically_add_rewards'] ?? false),
        ],
    };
}
```

Implement `minor(float|int|null $decimal): ?int` with `round($decimal * 100)` and `decimal(int|float|null $minor): ?float` with division by 100. Apply conditional Laravel validation rules after type validation. Run `Str::slug($validated['name'])` before final create validation only if the POST request has no non-empty handle. Scope unique coupon/handle validation to ignore the current model during update.

- [ ] **Step 6: Run backend GREEN and adjacent permission/commerce regressions.**

Run from `backend`:

```powershell
$env:APP_ENV='testing'; $env:MAIL_MAILER='array'; $env:DB_CONNECTION='sqlite'; $env:DB_DATABASE=':memory:'; $env:APP_KEY='base64:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='; php artisan test tests/Feature/Api/Admin/DiscountControllerTest.php tests/Feature/AdminPermissionMatrixTest.php tests/Feature/CheckoutApiTest.php
php -l app/Http/Controllers/Api/Admin/DiscountController.php
php -l routes/api.php
git diff --check
```

Expected: all selected tests pass, both lint commands report no syntax errors, and diff check has no output. Record the exact RED/GREEN counts and known absent-worktree-`.env` warnings in the task report.

## Task 2: Typed Discount API layer

**Files:**
- Create: `admin/src/features/discounts/api.ts`
- Create: `admin/src/features/discounts/api.test.ts`

**Interfaces:**
- Consumes: Task 1 resource/pagination/request contracts.
- Produces: `Discount`, `DiscountData`, `DiscountFormValues`, `buildDiscountPayload`, `buildDiscountUpdatePayload`, `fetchDiscounts`, `fetchDiscount`, `createDiscount`, `updateDiscount`, `deleteDiscount`, `useDiscounts`, `useDiscount`, `useCreateDiscount`, `useUpdateDiscount`, `useDeleteDiscount` for Tasks 3 and 4.

- [ ] **Step 1: Write failing unit tests for contract normalization and payload conversion.**

```ts
it('serializes trimmed list search and positive page', async () => {
  fetchJson.mockResolvedValue({ data: [], meta: { current_page: 2, last_page: 2, per_page: 15, total: 16 } });
  await fetchDiscounts({ search: '  SAVE  ', page: 2 });
  expect(fetchJson).toHaveBeenCalledWith('/admin/discounts?search=SAVE&page=2');
});

it('converts local datetime form values to ISO UTC and emits only AmountOff percentage data', () => {
  expect(buildDiscountPayload({ ...amountValues, starts_at: '2026-08-31T19:00', ends_at: '', fixed_value: false, percentage: '10', fixed_value_usd: '4.50' })).toMatchObject({
    starts_at: new Date('2026-08-31T19:00').toISOString(),
    ends_at: null,
    data: { min_prices: { USD: 25 }, fixed_value: false, percentage: 10 },
  });
  expect(buildDiscountPayload(amountValues).data).not.toHaveProperty('fixed_values');
});
```

- [ ] **Step 2: Run API tests to observe RED.**

Run from `admin`:

```powershell
npm test -- src/features/discounts/api.test.ts
```

Expected: FAIL because the module and exported contracts do not exist.

- [ ] **Step 3: Add the typed API module and minimal React Query hooks.**

```ts
export async function fetchDiscounts(filters: DiscountFilters = {}): Promise<DiscountPage> {
  const params = new URLSearchParams();
  if (filters.search?.trim()) params.set('search', filters.search.trim());
  if (filters.page && filters.page > 0) params.set('page', String(filters.page));
  const suffix = params.size ? `?${params}` : '';
  return fetchJson<DiscountPage>(`/admin/discounts${suffix}`);
}

export async function createDiscount(payload: DiscountCreatePayload): Promise<Discount> {
  const response = await fetchJson<{ data: Discount }>('/admin/discounts', { method: 'POST', body: payload });
  return response.data;
}
```

Use `PUT` for `updateDiscount`. Mutation success invalidates `['discounts']` and `['discount', id]`. Keep date and type/data conversion pure in exported helpers so UI tests do not need to mock React Query.

- [ ] **Step 4: Add tests for all types, request methods, and cache invalidation contract.**

```ts
it('forces per-unit fixed data and omits percentage', () => {
  const payload = buildDiscountPayload({ ...baseValues, type: PER_UNIT_TYPE, fixed_value: false, percentage: '25', fixed_value_usd: '2.50' });
  expect(payload.data).toEqual({ min_prices: { USD: 0 }, fixed_value: true, fixed_values: { USD: 2.5 } });
});

it('emits BuyXGetY data without AmountOff fields', () => {
  expect(buildDiscountPayload({ ...baseValues, type: BUY_X_GET_Y_TYPE, min_qty: '2', reward_qty: '1', max_reward_qty: '3', automatically_add_rewards: true }).data)
    .toEqual({ min_prices: { USD: 0 }, min_qty: 2, reward_qty: 1, max_reward_qty: 3, automatically_add_rewards: true });
});
```

Assert POST, PUT, DELETE calls exactly match `/admin/discounts` and `/admin/discounts/:id`; assert GET detail call has no options and therefore retains the API client default GET.

- [ ] **Step 5: Run API GREEN.**

Run:

```powershell
npm test -- src/features/discounts/api.test.ts
```

Expected: all Discount API tests pass.

## Task 3: Discounts list, delete actions, and core-only navigation

**Files:**
- Create: `admin/src/features/discounts/DiscountsListPage.tsx`
- Create: `admin/src/features/discounts/DiscountsListPage.test.tsx`
- Create: `admin/src/features/discounts/DiscountRowActions.tsx`
- Modify: `admin/src/App.tsx`
- Modify: `admin/src/App.test.ts`
- Modify: `admin/src/layouts/AppShell.tsx`
- Modify: `admin/src/layouts/AppShell.test.tsx`
- Modify: `admin/src/locales/en.json`
- Modify: `admin/src/locales/vi.json`

**Interfaces:**
- Consumes: Task 2 `Discount`, `useDiscounts`, `useDeleteDiscount`, and mutation functions.
- Produces: `DiscountsListPage`, `DiscountRowActions`, `canManageDiscounts`, `/discounts` route and Sales sidebar item; Task 4 consumes `/discounts/new` and `/discounts/:id` route placeholders in App.

- [ ] **Step 1: Write failing list, route, sidebar, and role-policy tests.**

```tsx
it('renders four mapped status badges, search, and edit/delete row actions', () => {
  mocks.useDiscounts.mockReturnValue(pageWith([
    { ...discount, status: 'active' },
    { ...discount, id: 2, status: 'expired' },
    { ...discount, id: 3, status: 'pending' },
    { ...discount, id: 4, status: 'scheduled' },
  ]));
  const { host } = renderPage();
  expect(host.textContent).toContain('discounts.status_active');
  expect(host.querySelector('.bg-emerald-100')).toBeTruthy();
  expect(host.querySelector('.bg-red-100')).toBeTruthy();
  expect(host.querySelector('.bg-slate-100')).toBeTruthy();
  expect(host.querySelector('.bg-blue-100')).toBeTruthy();
});

it.each(['super_admin', 'admin', 'staff'])('permits Discounts for %s', (role) => {
  expect(canManageDiscounts([role])).toBe(true);
});
```

Extend App tests to prove Support, Order Manager, and Product Manager fall back to the existing safe home route at `/discounts`. Extend AppShell tests to prove only every core role sees Discounts while existing Orders/Returns, Reviews, Customers, and Shipping visibility stays unchanged.

- [ ] **Step 2: Run focused frontend tests to observe RED.**

Run:

```powershell
npm test -- src/features/discounts/DiscountsListPage.test.tsx src/App.test.ts src/layouts/AppShell.test.tsx
```

Expected: FAIL because Discount modules, predicate, route, locale keys, and sidebar item do not exist.

- [ ] **Step 3: Implement the list, actions, guarded list route, and sidebar entry.**

```ts
export function canManageDiscounts(userRoles: string[]) {
  return isCoreAdministrator(userRoles);
}
```

```tsx
const statusClasses: Record<DiscountStatus, string> = {
  active: 'bg-emerald-100 text-emerald-700',
  expired: 'bg-red-100 text-red-700',
  pending: 'bg-slate-100 text-slate-600',
  scheduled: 'bg-blue-100 text-blue-700',
};
```

Use the established `ShippingRowActions` behavior as the source pattern: one Dots icon button, fixed-position menu, close on outside click/scroll, Edit callback, Delete callback. Use `DeleteConfirmModal` and `useDeleteDiscount`; on successful delete show `discounts.delete_success` and invalidate list through the hook. Search input resets page synchronously to 1. Add list/page/empty/error/delete labels as `discounts.*` in both locale files.

Add lazy imports for the list now; Task 4 adds the form import/routes but must not weaken this predicate.

- [ ] **Step 4: Run focused GREEN and build.**

Run:

```powershell
npm test -- src/features/discounts/DiscountsListPage.test.tsx src/App.test.ts src/layouts/AppShell.test.tsx
npm run build
git diff --check
```

Expected: focused suite and production build pass; diff check is empty.

## Task 4: Dedicated Discount create/edit form and detail routes

**Files:**
- Create: `admin/src/features/discounts/DiscountFormPage.tsx`
- Create: `admin/src/features/discounts/DiscountFormPage.test.tsx`
- Modify: `admin/src/App.tsx`
- Modify: `admin/src/App.test.ts`
- Modify: `admin/src/locales/en.json`
- Modify: `admin/src/locales/vi.json`

**Interfaces:**
- Consumes: Task 2 form values/payload helpers, `useDiscount`, `useCreateDiscount`, `useUpdateDiscount`, and Task 3 `canManageDiscounts` plus list route.
- Produces: `DiscountFormPage`, working `/discounts/new` and `/discounts/:id` routes, and the end-to-end destination of Task 3 edit navigation.

- [ ] **Step 1: Write failing create/edit form tests.**

```tsx
it('defaults a create start time to the current local minute and auto-fills handle until edited', () => {
  vi.setSystemTime(new Date('2026-08-31T12:34:56Z'));
  const { host } = renderForm('/discounts/new');
  expect((host.querySelector('#discount-starts-at') as HTMLInputElement).value).toMatch(/^2026-08-31T12:34$/);
  change(host.querySelector('#discount-name'), 'Summer Sale');
  expect((host.querySelector('#discount-handle') as HTMLInputElement).value).toBe('summer-sale');
  change(host.querySelector('#discount-handle'), 'manual-code');
  change(host.querySelector('#discount-name'), 'Different Sale');
  expect((host.querySelector('#discount-handle') as HTMLInputElement).value).toBe('manual-code');
});

it('shows per-unit USD only and submits forced fixed semantics', async () => {
  const { host } = renderForm('/discounts/new');
  changeSelect(host.querySelector('#discount-type'), PER_UNIT_TYPE);
  expect(host.querySelector('#discount-percentage')).toBeNull();
  change(host.querySelector('#discount-fixed-value-usd'), '2.50');
  submit(host.querySelector('form'));
  expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ fixed_value: true, fixed_values: { USD: 2.5 } }) }));
});
```

Also write tests for: explicit invalid end date blocks mutation; submit converts known datetime-local value to `new Date(value).toISOString()`; AmountOff toggle switches percentage/fixed input; BuyXGetY shows only four core configuration fields; stale AmountOff state is absent after type switch; edit hydrates server values with `toLocalDateTimeValue`; edit calls update with id; successful mutations navigate `/discounts`; and non-core `/discounts/new`/`/discounts/:id` use existing fallback.

- [ ] **Step 2: Run focused form tests to observe RED.**

Run:

```powershell
npm test -- src/features/discounts/DiscountFormPage.test.tsx src/App.test.ts
```

Expected: FAIL because DiscountFormPage and form routes do not exist.

- [ ] **Step 3: Implement `DiscountFormPage` and guarded form routes.**

```tsx
const emptyValues: DiscountFormValues = {
  name: '', handle: '', type: AMOUNT_OFF_TYPE,
  starts_at: localNowMinute(), ends_at: '', coupon: '', priority: '', stop: false,
  max_uses: '', max_uses_per_user: '', min_price_usd: '', fixed_value: false,
  percentage: '', fixed_value_usd: '', min_qty: '', reward_qty: '', max_reward_qty: '',
  automatically_add_rewards: false,
};
```

Use `useParams<{ id: string }>()` to select create versus edit. In edit mode enable `useDiscount(Number(id))`, hydrate values only after detail data arrives, and never overwrite `handle` when the name changes. Maintain a `handleEdited` state set by direct handle input. Use `localNowMinute()` only for the initial create defaults, not every render.

Render Core, Conditions, and Type Configuration sections. On submitting valid form values call the corresponding Task 2 mutation with an `onSuccess` callback that shows `discounts.create_success` or `discounts.update_success` and navigates to `/discounts`, and an `onError` callback that shows the server message or `discounts.save_error`. Add the two guarded form routes inside `canManageDiscounts`:

```tsx
<Route path="/discounts/new" element={<DiscountFormPage />} />
<Route path="/discounts/:id" element={<DiscountFormPage />} />
```

Do not add any limitations, conditions, availability, reward-product selector, channel, or customer UI.

- [ ] **Step 4: Run focused GREEN and full frontend verification.**

Run:

```powershell
npm test -- src/features/discounts/api.test.ts src/features/discounts/DiscountsListPage.test.tsx src/features/discounts/DiscountFormPage.test.tsx src/App.test.ts src/layouts/AppShell.test.tsx
npm test
npm run build
git diff --check
```

Expected: focused and full frontend test suites pass, production build succeeds, and diff check has no output.

## Task 5: Whole-feature integration verification and Claude review package

**Files:**
- Modify only if test gaps require it: files introduced by Tasks 1–4.
- Create: `.superpowers/sdd/2026-08-31-commerce-admin-discounts-round4a/final-report.md`

**Interfaces:**
- Consumes: all Tasks 1–4 outputs.
- Produces: verification evidence and a review-ready, uncommitted Round 4a worktree for Claude.

- [ ] **Step 1: Create a requirement checklist before running final commands.**

```text
[ ] Five core CRUD methods exist and non-core roles are forbidden.
[ ] Only three approved type classes can persist.
[ ] Decimal USD round-trips to Lunar factor-100 minor units.
[ ] Per-unit cannot persist percentage/no-op data.
[ ] Type change strips stale data.
[ ] Four native statuses and grouped name/coupon search work.
[ ] List/form/sidebar/routes use core-only policy with all existing role policies intact.
[ ] No Round 4b–4d relations, checkout, matrix, middleware, Filament, vendor, or storefront scope changed.
```

- [ ] **Step 2: Run the final backend and route-surface verification.**

Run from `backend`:

```powershell
$env:APP_ENV='testing'; $env:MAIL_MAILER='array'; $env:DB_CONNECTION='sqlite'; $env:DB_DATABASE=':memory:'; $env:APP_KEY='base64:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='; php artisan test tests/Feature/Api/Admin/DiscountControllerTest.php tests/Feature/AdminPermissionMatrixTest.php tests/Feature/CheckoutApiTest.php tests/Feature/Api/Admin/ShippingMethodControllerTest.php tests/Feature/Api/Admin/CustomerControllerTest.php
php artisan route:list --path=api/admin/discounts --json
git diff --check
```

Expected: selected tests pass; the route list has GET|HEAD, POST, GET|HEAD detail, PUT|PATCH detail, and DELETE detail, each with the nested `role:super_admin|admin|staff` middleware; diff check is clean. Treat absent-worktree `.env` file-read warnings as non-failing only when exit code is 0.

- [ ] **Step 3: Run final frontend verification.**

Run from `admin`:

```powershell
npm test
npm run build
git diff --check
```

Expected: all tests and the production build pass; diff check is clean. Record any existing Vite native-config or LF/CRLF warnings separately from failures.

- [ ] **Step 4: Perform an independent whole-branch review.**

Dispatch a reviewer with the spec, this plan, and actual diff. Require it to inspect field minimization, type hardening, money conversion, forced per-unit semantics, core-only routes/sidebar, conditional UI, stale-key stripping, test strength, and prohibited scope. Resolve every Critical or Important valid finding with a regression test before another review pass.

- [ ] **Step 5: Write final review package and leave it for Claude.**

```markdown
# Round 4a final report

## Changed files
Paste the complete fresh `git status --short` output and identify every Round 4a path.

## Backend evidence
Record the exact Task 5 backend command, exit code, test/assertion count, and only warnings printed by that run.

## Admin evidence
Record the exact `npm test` and `npm run build` commands, exit codes, test count, and build result.

## Route surface
Paste the `php artisan route:list --path=api/admin/discounts --json` result and state the observed method/action/core-role middleware for every route.

## Independent review
State the reviewer verdict and every Critical/Important finding that was either resolved with a named regression test or rejected with a documented technical ruling.

## Exceptions
List only fresh failures or warnings observed during final verification; state whether each is in the Round 4a diff.

No commit, merge, or push was performed.
```

Do not commit, merge, push, or change unrelated code. Tell Claude that Round 4a is ready for final review and explicitly call out any verification exception rather than implying a clean full suite.
