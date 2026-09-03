# Sales admin parity Round E — Manual Create Order Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `subagent-driven-development` (recommended) or `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the remaining Commerce-scope Manual Create Order flow: a secured Laravel adapter over CheckoutService, product-specific variant picker API, and a React create-order form.

**Architecture:** `OrderController::store` remains a thin authenticated/authorized request adapter, converting presentation input to the already-authoritative `CheckoutService::placeOrder` payload and forcing manual-order provenance. A dedicated product variants endpoint avoids breaking list response consumers. The React page owns only UI state, translated copy, client validation, API calls, and navigation; server outcomes remain authoritative.

**Tech Stack:** Laravel 11, Lunar, Sanctum, Spatie Permission, PHPUnit; React, TypeScript, React Router, TanStack React Query, Vitest, react-i18next.

**Spec:** `docs/superpowers/specs/2026-09-03-sales-admin-parity-round-e-create-order-design.md`

## Global Constraints

- Work only in `C:\laragon\www\petposture\.worktrees\commerce-admin-migration`; do not touch the dirty main checkout.
- Before editing each existing symbol, run GitNexus impact analysis and report HIGH/CRITICAL findings before proceeding.
- Do not modify public `/api/checkout/place-order`, CheckoutService, payment/state/shipping business logic, migrations, vendor, or out-of-scope Filament areas.
- Adding `create_order` to `AdminPermissionMatrix::ORDER` is explicitly approved; it must be granted to exactly the existing `update_order` role set: core roles, Order Manager, and Support.
- The POST endpoint's effective authorization remains existing `update_order`; it must preserve the admin group’s `auth:sanctum`, role middleware, and `admin.permission` behavior.
- Server forces `created_by_admin: true`; never trust client provenance, totals, price, stock, tax, discount, shipping, or payment state.
- Omitted fee override uses server-calculated shipping; explicit USD `0` becomes integer minor `0` and forces free shipping.
- Keep all new UI copy in `orders.*` locale keys in English and Vietnamese.
- Do not stage, commit, merge, push, publish, or deploy. Claude reviews the uncommitted diff after final verification.

---

## Files and responsibilities

| File | Responsibility |
|---|---|
| `backend/app/Security/AdminPermissionMatrix.php` | Provision explicit `create_order` exactly where update_order is provisioned. |
| `backend/app/Http/Middleware/EnforceAdminApiPermission.php` | Existing generic POST-order mapping is verified to enforce `update_order`; it is not changed. |
| `backend/app/Http/Controllers/Api/OrderController.php` | Validate/normalize manual-order request, force provenance, delegate to CheckoutService, serialize response. |
| `backend/routes/api.php` | Mount `POST /admin/orders` before parameterized order routes; preserve inherited middleware. |
| `backend/app/Http/Controllers/Api/Admin/ProductController.php` | Serve a flat, product-scoped variant picker response. |
| `backend/tests/Feature/CheckoutApiTest.php` | Exercise manual-order HTTP contract and CheckoutService-observable outcomes. |
| `backend/tests/Feature/AdminPermissionMatrixTest.php` | Pin correct roles and denials for create-order permission/endpoint. |
| `backend/tests/Feature/AdminProductApiTest.php` | New focused admin product variant picker endpoint coverage. |
| `admin/src/components/ui/SearchableMultiSelect.tsx` | Accept optional translated visible labels while retaining existing behavior/callers. |
| `admin/src/features/orders/api.ts` | Types/functions/hooks for create order, product search reuse, and product-scoped variants. |
| `admin/src/features/orders/OrderFormPage.tsx` | Create-order form, two-step picker, server validation feedback, redirect. |
| `admin/src/features/orders/OrdersListPage.tsx` | Create Order entry point. |
| `admin/src/App.tsx` | Lazy import and route ordering for `/orders/new`. |
| `admin/src/locales/en.json`, `admin/src/locales/vi.json` | All new orders/picker/form copy. |
| `admin/src/features/orders/OrderFormPage.test.tsx` | Form/picker/payload/error/redirect behavior. |
| `admin/src/features/orders/api.test.ts` | Exact request paths/bodies for create and variants helper. |
| `admin/src/App.test.ts` | `/orders/new` route precedence. |
| `admin/src/features/orders/OrdersListPage.test.tsx` | Create button navigation. |
| `admin/src/components/ui/SearchableMultiSelect.test.tsx` | Localized text-prop regression. |

## Task 1: Permission parity and Manual Create Order API

**Files:**
- Modify: `backend/app/Security/AdminPermissionMatrix.php`
- Modify: `backend/app/Http/Controllers/Api/OrderController.php`
- Modify: `backend/routes/api.php`
- Modify: `backend/tests/Feature/CheckoutApiTest.php`
- Modify: `backend/tests/Feature/AdminPermissionMatrixTest.php`

**Interfaces:**
- Consumes: `CheckoutService::placeOrder(array $payload, ?int $userId, ?string $customerIp): Order`; `OrderResource` response shape; existing `/api/admin` middleware group.
- Produces: `POST /api/admin/orders` accepting `CreateOrderPayload` and returning `{ data: Order }`/the established `OrderResource` envelope.

- [ ] **Step 1: Run impact analysis before touching symbols**

Run:
```powershell
npx gitnexus impact OrderController --repo commerce-admin-migration --direction upstream --include-tests
npx gitnexus impact AdminPermissionMatrix --repo commerce-admin-migration --direction upstream --include-tests

# Also inspect the existing mapping; it must stay `update_order`.
npx gitnexus context EnforceAdminApiPermission --repo commerce-admin-migration
```

Record direct callers/processes/risk in the Round E progress report. Stop and obtain user acknowledgement if any result is HIGH or CRITICAL.

- [ ] **Step 2: Add failing feature/permission tests**

Add tests that establish all of these behaviors before production edits:

```php
Sanctum::actingAs($this->userWithRole('Order Manager'));
$this->postJson('/api/admin/orders', validManualOrderPayload(['payment_method' => 'card', 'created_by_admin' => false]))
    ->assertCreated()
    ->assertJsonPath('data.status', 'payment-received');

Sanctum::actingAs($this->userWithRole('Support'));
$this->postJson('/api/admin/orders', validManualOrderPayload())->assertCreated();

Sanctum::actingAs($this->userWithRole('Product Manager'));
$this->postJson('/api/admin/orders', validManualOrderPayload())->assertForbidden();
```

Also prove: missing `items`, shipping email/first name/line_one/city, invalid method, zero/negative quantity, and invalid `billing_same_as_shipping=false` billing fields reject with 422; a client `created_by_admin: false` cannot suppress manual provenance, evidenced by the existing manual-card `payment-received` state/capture and manual order-created event detail; omitted fee uses a configured nonzero server rate while explicit `shipping_fee_override: 0` results in `shipping_total: 0`; a positive USD amount is converted to its exact minor value.

- [ ] **Step 3: Run focused tests RED**

Run:
```powershell
$env:APP_ENV='testing'; $env:MAIL_MAILER='array'; $env:DB_CONNECTION='sqlite'; $env:DB_DATABASE=':memory:'; $env:APP_KEY='base64:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='; php artisan test tests/Feature/CheckoutApiTest.php tests/Feature/AdminPermissionMatrixTest.php --filter='(manual|order_manager|support)'
```

Expected: POST route/permission behavior fails before implementation.

- [ ] **Step 4: Implement the narrow server adapter**

- Add `'create_order'` next to the existing order permission constants. Because the role arrays consume `self::ORDER`, core admins and Order Manager receive it; explicitly add it to Support’s existing explicit list so its final set equals the current `update_order` role set.
- Keep POST `/admin/orders` in the current admin group, before `/orders/{id}`-style routes.
- Have `store(Request $request)` check `update_order`, validate only presentation fields, and build this exact service payload:

```php
$payload = [
    'items' => collect($validated['items'])->map(fn (array $item) => [
        'variantId' => (int) $item['variant_id'],
        'quantity' => (int) $item['quantity'],
    ])->all(),
    'shipping' => ['email' => $validated['email'], ...$validated['shipping']],
    'billing_same_as_shipping' => $validated['billing_same_as_shipping'],
    'billing' => $validated['billing_same_as_shipping'] ? null : $validated['billing'],
    'payment_method' => $validated['payment_method'],
    'shipping_method' => $validated['shipping_method'],
    'coupon_code' => $validated['coupon_code'] ?? null,
    'customer_note' => $validated['customer_note'] ?? null,
    'internal_note' => $validated['internal_note'] ?? null,
    'shipping_fee_override' => array_key_exists('shipping_fee_override', $validated)
        ? (int) round(((float) $validated['shipping_fee_override']) * 100)
        : null,
    'created_by_admin' => true,
];
```

Pass authenticated user ID and request IP to `placeOrder`, and return `new OrderResource($order)` using the existing show endpoint convention. Do not reimplement the service’s stock, financial, or state logic.

- [ ] **Step 5: Run focused tests GREEN**

Run the Step 3 command plus:

```powershell
php artisan test tests/Feature/CheckoutApiTest.php tests/Feature/AdminPermissionMatrixTest.php
php artisan route:list --path=api/admin/orders --json
```

Expected: all pass; route output confirms inherited `auth:sanctum`, allowed roles, and `admin.permission` middleware.

- [ ] **Step 6: Record task evidence**

Append RED/GREEN command results, role truth table, fee-semantic evidence, and no-service-change statement to `.superpowers/sdd/2026-09-03-sales-admin-parity-round-e-create-order/task-1-report.md`. Do not commit.

## Task 2: Product-scoped variant picker endpoint

**Files:**
- Modify: `backend/app/Http/Controllers/Api/Admin/ProductController.php`
- Modify: `backend/routes/api.php`
- Create: `backend/tests/Feature/AdminProductApiTest.php`

**Interfaces:**
- Consumes: bound `Lunar\Models\Product`, product variants/values/prices relations, default currency, inherited admin middleware.
- Produces: `GET /api/admin/products/{product}/variants` returning `data: OrderVariantPickerItem[]` with `{ id, sku, label, price, formatted_price, stock, purchasable }`.

- [ ] **Step 1: Run impact analysis**

Run:
```powershell
npx gitnexus impact ProductController --repo commerce-admin-migration --direction upstream --include-tests
```

Record risk; do not change existing index response contract.

- [ ] **Step 2: Write failing endpoint tests**

Create `AdminProductApiTest` coverage that creates a product with option values/prices and asserts:

```php
$this->getJson("/api/admin/products/{$product->id}/variants")
    ->assertOk()
    ->assertJsonPath('data.0.id', $variant->id)
    ->assertJsonPath('data.0.sku', 'HARNESS-M')
    ->assertJsonPath('data.0.stock', 8)
    ->assertJsonStructure(['data' => [['id', 'sku', 'label', 'price', 'formatted_price', 'stock', 'purchasable']]]);
```

Add unauthenticated 401, Product Manager allowed product API response, and Support forbidden response tests. Assert the existing `/api/admin/products?search=` response does not gain a `variants` field.

- [ ] **Step 3: Run test RED**

Run:
```powershell
$env:APP_ENV='testing'; $env:MAIL_MAILER='array'; $env:DB_CONNECTION='sqlite'; $env:DB_DATABASE=':memory:'; $env:APP_KEY='base64:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='; php artisan test tests/Feature/AdminProductApiTest.php
```

Expected: missing route/method failure.

- [ ] **Step 4: Implement dedicated serialization**

Add `ProductController::variants(Product $product): JsonResponse`, eager load exactly product/variant data required for option label and default-currency base price, and return a flat `data` array. Build `label` as localized product display name plus nonempty option-value labels and SKU; return a decimal `price` and current `formatted_price`, `stock`, `purchasable`. Add the GET route before generic product routes. Do not use `ProductResource`, alter `index`, or put business eligibility in the endpoint.

- [ ] **Step 5: Run endpoint tests GREEN**

Run the Step 3 command and then:

```powershell
php artisan test tests/Feature/AdminProductApiTest.php tests/Feature/AdminPermissionMatrixTest.php
```

Expected: all tests pass with the requested access boundaries.

- [ ] **Step 6: Record task evidence**

Append contract, auth, unchanged-index, RED/GREEN, and `git diff --check` evidence to `.superpowers/sdd/2026-09-03-sales-admin-parity-round-e-create-order/task-2-report.md`. Do not commit.

## Task 3: Order data layer and localized shared picker control

**Files:**
- Modify: `admin/src/components/ui/SearchableMultiSelect.tsx`
- Create: `admin/src/components/ui/SearchableMultiSelect.test.tsx`
- Modify: `admin/src/features/orders/api.ts`
- Modify: `admin/src/features/orders/api.test.ts`

**Interfaces:**
- Consumes: `fetchJson`, `useMutation`, `useQueryClient`, existing orders product-list query contract.
- Produces:

```ts
export interface CreateOrderPayload { /* exact spec payload */ }
export interface OrderVariantPickerItem { id: number; sku: string; label: string; price: number; formatted_price: string | null; stock: number; purchasable: string }
export async function createOrder(payload: CreateOrderPayload): Promise<Order>
export async function fetchOrderProductVariants(productId: number): Promise<OrderVariantPickerItem[]>
export function useCreateOrder(): UseMutationResult<Order, Error, CreateOrderPayload>
```

- [ ] **Step 1: Run impact analysis**

Run:
```powershell
npx gitnexus impact SearchableMultiSelect --repo commerce-admin-migration --direction upstream --include-tests
npx gitnexus impact useOrders --repo commerce-admin-migration --direction upstream --include-tests
```

- [ ] **Step 2: Write failing API/control tests**

Add tests asserting:

```ts
await createOrder(validPayload);
expect(fetchJson).toHaveBeenCalledWith('/admin/orders', { method: 'POST', body: validPayload });

await fetchOrderProductVariants(17);
expect(fetchJson).toHaveBeenCalledWith('/admin/products/17/variants');
```

Render `SearchableMultiSelect` with localized `placeholder`, `noResultsText`, `selectedCountText: (count) => string`, and `clearAllText` props; assert those exact strings appear instead of English component literals and existing selection/clear semantics are unchanged.

- [ ] **Step 3: Run tests RED**

Run:
```powershell
npm test -- --run src/features/orders/api.test.ts src/components/ui/SearchableMultiSelect.test.tsx
```

Expected: helpers/translated props are missing.

- [ ] **Step 4: Implement minimal data/control additions**

Add typed `createOrder` and `fetchOrderProductVariants` helpers. `useCreateOrder` must invalidate `{ queryKey: ['orders'] }` and cache returned detail exactly like existing order mutations. Add optional text props to `SearchableMultiSelect`, preserving defaults so unrelated callers remain compatible; remove no existing behavior.

- [ ] **Step 5: Run tests GREEN**

Run the Step 3 command and:

```powershell
npx tsc --noEmit
```

Expected: helpers transmit exact paths/bodies, translated visible strings render, and TypeScript passes.

- [ ] **Step 6: Record task evidence**

Append interfaces, tests, impact results, and commands to `.superpowers/sdd/2026-09-03-sales-admin-parity-round-e-create-order/task-3-report.md`. Do not commit.

## Task 4: React Order Form, route, entry point, and translations

**Files:**
- Create: `admin/src/features/orders/OrderFormPage.tsx`
- Create: `admin/src/features/orders/OrderFormPage.test.tsx`
- Modify: `admin/src/features/orders/OrdersListPage.tsx`
- Create: `admin/src/features/orders/OrdersListPage.test.tsx`
- Modify: `admin/src/App.tsx`
- Modify: `admin/src/App.test.ts`
- Modify: `admin/src/locales/en.json`
- Modify: `admin/src/locales/vi.json`

**Interfaces:**
- Consumes: `useCreateOrder`, `useProducts({ search, per_page })`, `fetchOrderProductVariants`/query hook, `SearchableMultiSelect`, `OrderVariantPickerItem`.
- Produces: `OrderFormPage` at `/orders/new`, submitted `CreateOrderPayload`, and an Orders-list navigation action.

- [ ] **Step 1: Run impact analysis**

Run:
```powershell
npx gitnexus impact OrdersListPage --repo commerce-admin-migration --direction upstream --include-tests
npx gitnexus impact AppRoutes --repo commerce-admin-migration --direction upstream --include-tests
```

- [ ] **Step 2: Write failing UI/route tests**

Write tests that prove:

```tsx
// Route precedence
renderAppAt('/orders/new');
expect(screen.getByRole('heading', { name: 'orders.create_title' })).toBeTruthy();
expect(screen.queryByText('orders.detail_title')).toBeNull();

// Two-step picker persists prior choices
selectProduct(productA);
await selectVariant(variantA);
selectProduct(productB);
await selectVariant(variantB);
expect(selectedLineIds()).toEqual([variantA.id, variantB.id]);

// Submission
expect(createMutation).toHaveBeenCalledWith(expect.objectContaining({
  items: [{ variant_id: variantA.id, quantity: 2 }],
  billing_same_as_shipping: false,
  shipping_fee_override: 0,
}));
expect(navigate).toHaveBeenCalledWith(`/orders/${created.id}`);
```

Also cover full required sections, default methods/countries, billing block show/hide, local pre-submit errors, 422 field-message alert, fee blank omission, list Create Order button routing, and all required orders locale keys in both locale JSON files.

- [ ] **Step 3: Run tests RED**

Run:
```powershell
npm test -- --run src/features/orders/OrderFormPage.test.tsx src/features/orders/OrdersListPage.test.tsx src/App.test.ts
```

Expected: missing page/route/create control failures.

- [ ] **Step 4: Implement UI without domain calculations**

- Create form values with `billing_same_as_shipping: true`, `country: 'US'`, `payment_method: 'cod'`, and `shipping_method: 'standard'`.
- Debounce product-query input. Selecting a product clears only the currently offered variants, fetches its variants, and retains selected-line state keyed by variant ID.
- Bind `SearchableMultiSelect` to current product variants; derive item rows from selected variant metadata plus user-entered quantity. Never calculate totals or use display price/stock for final authorization.
- Render conditionally visible billing fields only while same-as-shipping is false.
- On submit, validate minimum UI invariants, omit blank optional strings and blank fee override, call `useCreateOrder`, and navigate using returned `id` only after successful server response.
- Display server 422 messages in an alert and any non-422 failure via existing error/toast convention. Use `t('orders.*')` for every newly visible string.
- Add `/orders/new` lazy import/route before `/orders/:id`, both under `canManageSales`, and add a translated list-header Create Order button.

- [ ] **Step 5: Run UI tests GREEN**

Run:
```powershell
npm test -- --run src/features/orders/OrderFormPage.test.tsx src/features/orders/OrdersListPage.test.tsx src/features/orders/api.test.ts src/components/ui/SearchableMultiSelect.test.tsx src/App.test.ts
npx tsc --noEmit
npm run build
```

Expected: tests, type-check, and production build pass.

- [ ] **Step 6: Record task evidence**

Append UX contract, payload proofs, translations, RED/GREEN, and command outputs to `.superpowers/sdd/2026-09-03-sales-admin-parity-round-e-create-order/task-4-report.md`. Do not commit.

## Task 5: Integration review and final verification handoff

**Files:**
- Create: `.superpowers/sdd/2026-09-03-sales-admin-parity-round-e-create-order/final-verification.md`
- Modify: `.superpowers/sdd/2026-09-03-sales-admin-parity-round-e-create-order/progress.md`

- [ ] **Step 1: Perform fresh read-only cross-layer review**

Check endpoint/picker names and payload field naming match end-to-end; create roles are precisely core/Order Manager/Support; POST routes retain admin middleware; price/stock/shipping authority remains CheckoutService; omitted/zero fee tests demonstrate their different outcomes; public checkout remains unchanged; and `/orders/new` is before parameter route.

- [ ] **Step 2: Run final verification**

Run:
```powershell
# backend
$env:APP_ENV='testing'; $env:MAIL_MAILER='array'; $env:DB_CONNECTION='sqlite'; $env:DB_DATABASE=':memory:'; $env:APP_KEY='base64:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='; php artisan test tests/Feature/CheckoutApiTest.php tests/Feature/AdminProductApiTest.php tests/Feature/AdminPermissionMatrixTest.php tests/Feature/AdminAuthTest.php
php artisan route:list --path=api/admin/orders --json
php artisan route:list --path=api/admin/products --json

# admin
npm test
npx tsc --noEmit
npm run build

# repository scope
git diff --check
```

- [ ] **Step 3: Write final handoff evidence**

Record passing output counts, known non-failing warnings, changed files, explicit role/middleware proof, shipping omission/zero proof, final review verdict, and the instruction that Claude must review the uncommitted worktree diff before any merge.

## Plan self-review

- Spec coverage: Task 1 covers authority, normalization, roles, fees, and public-route containment; Task 2 covers isolated picker contract; Task 3 covers API/shared component i18n; Task 4 covers two-step UI/route/locales/errors; Task 5 covers integration and handoff.
- Placeholder scan: no unresolved placeholders or unspecified validation/test steps; all interfaces, payload fields, commands, and expected outcomes are explicit.
- Type consistency: backend uses `variant_id` externally and `variantId` only in CheckoutService payload; frontend uses `OrderVariantPickerItem`, `CreateOrderPayload`, `/admin/orders`, and `/admin/products/{id}/variants` consistently.
