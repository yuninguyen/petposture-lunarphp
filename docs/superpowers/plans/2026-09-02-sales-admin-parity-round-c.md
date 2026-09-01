# Sales Admin Parity Round C Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add safe Order actions/shipment/refund controls and Return Request tracking, low-value waiver, and approval-preview operations to the React admin.

**Architecture:** Existing OrderOperationsService and ReturnRequestService remain business authorities. Controllers add narrowly validated/authorized orchestration and resources publish only UI eligibility/operation contracts. React uses those contracts, existing confirmation/modal/toast patterns, and invalidates/refetches after mutations.

**Tech Stack:** Laravel 11, Sanctum, Spatie roles, Lunar, React, TypeScript, TanStack React Query, Vitest, i18next, PHPUnit.

**Spec:** `docs/superpowers/specs/2026-09-02-sales-admin-parity-round-c-design.md`

## Global Constraints

- Leave all work uncommitted; Claude reviews the worktree diff before merge.
- Do not modify permission matrix/middleware, Lunar vendor code, migrations, payment settlement logic, or state-machine/service implementation.
- Use existing `OrderOperationsService` and `ReturnRequestService` for all business transitions/calculations.
- Existing Return Request role set remains `super_admin`, `admin`, `staff`, `Order Manager`, `Support`.
- Generic Order UI actions must exclude `markShipped`; shipment workflow owns it.
- Never browser-rollback a successfully completed markShipped transition after shipment creation fails; refetch and show server truth.
- No client-side calculation of shipment eligibility or final refund amounts.
- Routes/payloads use lowercase carriers only: `manual`, `ups`, `usps`, `fedex`, `dhl`.
- New visible copy is translated in both `admin/src/locales/en.json` and `admin/src/locales/vi.json`.

---

## File structure

| File | Responsibility |
|---|---|
| `backend/app/Http/Resources/Api/OrderResource.php` | Publish remaining quantities and authoritative refund reason options. |
| `backend/app/Http/Controllers/Api/OrderController.php` | Validate shipment items/refund reason and pass them to existing service. |
| `backend/tests/Feature/CheckoutApiTest.php` | Regression test Order API/controller orchestration. |
| `admin/src/features/orders/api.ts` | Order operation types and mutation helpers. |
| `admin/src/features/orders/OrderDetailPage.tsx` | Action, shipment, and refund reason UI. |
| `admin/src/features/orders/OrderDetailPage.test.ts` | Order UI behavior regressions. |
| `backend/app/Http/Resources/Api/OrderReturnRequestResource.php` | Publish tracking and waiver eligibility. |
| `backend/app/Http/Controllers/Api/ReturnRequestController.php` | Admin tracking, waiver, preview endpoints. |
| `backend/routes/api.php` | Register three Return Request admin routes. |
| `backend/tests/Feature/ReturnRequestApiTest.php` | Authorization/status/eligibility/preview endpoint regressions. |
| `admin/src/features/return-requests/api.ts` | Return request contracts and mutations. |
| `admin/src/features/return-requests/ReturnRequestDetailPage.tsx` | Tracking, waiver, and preview UI. |
| `admin/src/features/return-requests/ReturnRequestDetailPage.test.tsx` | Return Request UI behavior regressions. |
| `admin/src/locales/en.json`, `admin/src/locales/vi.json` | User-facing translated operation labels/errors. |

---

### Task 1: Publish and validate Order operation contracts

**Files:**
- Modify: `backend/app/Http/Resources/Api/OrderResource.php`
- Modify: `backend/app/Http/Controllers/Api/OrderController.php`
- Modify: `backend/tests/Feature/CheckoutApiTest.php`

**Interfaces:**
- Consumes: `OrderOperationsService::remainingShippableQuantities(Order): array<int,int>`, `REFUND_REASON_LABELS`, `recordShipment(Order,array)`, `refundOrder(Order,?int,?string)`.
- Produces: `OrderResource.remaining_shippable_quantities: array<string,int>`, `refund_reason_options: array<{value:string,label:string}>`; shipment request body `{tracking_number:string, shipment_carrier?:'manual'|'ups'|'usps'|'fedex'|'dhl', items?:Array<{order_line_id:number,quantity:number}>}`; refund body `{amount?:number, reason:string}`.

- [ ] **Step 1: Write failing backend contract tests**

```php
$response = $this->actingAs($admin, 'sanctum')->getJson("/api/orders/{$order->id}");
$response->assertOk()
    ->assertJsonPath('data.remaining_shippable_quantities.'.$line->id, 2)
    ->assertJsonPath('data.refund_reason_options.0.value', 'return_approved')
    ->assertJsonPath('data.refund_reason_options.0.label', 'Approved Return Request');

$this->actingAs($admin, 'sanctum')
    ->postJson("/api/orders/{$order->id}/shipments", [
        'tracking_number' => '1ZTEST',
        'shipment_carrier' => 'ups',
        'items' => [['order_line_id' => $line->id, 'quantity' => 1]],
    ])->assertOk();

$this->actingAs($admin, 'sanctum')
    ->postJson("/api/admin/orders/{$order->id}/refund", ['reason' => 'not-real'])
    ->assertUnprocessable()->assertJsonValidationErrors('reason');
```

- [ ] **Step 2: Run focused backend tests and observe RED**

Run:
```powershell
$env:APP_ENV='testing'; $env:MAIL_MAILER='array'; $env:DB_CONNECTION='sqlite'; $env:DB_DATABASE=':memory:'; $env:APP_KEY='base64:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='; php artisan test tests/Feature/CheckoutApiTest.php --filter="shipment|refund|admin can"
```

Expected: failures because resource fields, shipment item validation forwarding, and required reason validation are absent.

- [ ] **Step 3: Add minimal resource/controller contract implementation**

```php
// OrderResource::toArray
'remaining_shippable_quantities' => collect(app(OrderOperationsService::class)
    ->remainingShippableQuantities($this->resource))
    ->mapWithKeys(fn (int $quantity, int $lineId) => [(string) $lineId => $quantity])
    ->all(),
'refund_reason_options' => collect(OrderOperationsService::REFUND_REASON_LABELS)
    ->map(fn (string $label, string $value) => ['value' => $value, 'label' => $label])
    ->values()
    ->all(),

// OrderController::createShipment validation
'items' => ['nullable', 'array'],
'items.*.order_line_id' => ['required_with:items', 'integer'],
'items.*.quantity' => ['required_with:items', 'integer', 'min:1'],

// OrderController::refund validation and service call
'reason' => ['required', 'string', Rule::in(array_keys(OrderOperationsService::REFUND_REASON_LABELS))],
return new OrderResource($this->orderOperationsService->refundOrder($order, $amountMinor, $validated['reason']));
```

Add `use Illuminate\Validation\Rule;`. Preserve all existing authorization and minor-unit conversion.

- [ ] **Step 4: Run focused backend tests and verify GREEN**

Run the Step 2 command.

Expected: all selected tests pass; valid selected shipment produces only requested shipment items; malformed reason returns 422 and does not call refund business action.

- [ ] **Step 5: Run resource/operation regression suite**

Run:
```powershell
$env:APP_ENV='testing'; $env:MAIL_MAILER='array'; $env:DB_CONNECTION='sqlite'; $env:DB_DATABASE=':memory:'; $env:APP_KEY='base64:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='; php artisan test tests/Feature/CheckoutApiTest.php
```

Expected: exit 0. Do not commit.

---

### Task 2: Add Order Detail action, shipment, and refund-reason UI

**Files:**
- Modify: `admin/src/features/orders/api.ts`
- Modify: `admin/src/features/orders/OrderDetailPage.tsx`
- Modify: `admin/src/features/orders/OrderDetailPage.test.ts`
- Modify: `admin/src/locales/en.json`
- Modify: `admin/src/locales/vi.json`

**Interfaces:**
- Consumes Task 1 Order fields: `available_actions`, `remaining_shippable_quantities`, `refund_reason_options`.
- Produces mutation helpers: `performOrderAction(id, action)`, `createOrderShipment(id, payload)`, `refundOrder(id, {amount?,reason})`; all update/refetch `['orders', id]` after success.

- [ ] **Step 1: Write failing frontend tests**

```tsx
renderOrder({
  status: 'processing',
  available_actions: [{ action: 'markShipped', label: 'Mark Shipped' }, { action: 'cancelOrder', label: 'Cancel Order' }],
  remaining_shippable_quantities: { '17': 2 },
  refund_reason_options: [{ value: 'defective', label: 'Defective / Damaged Item' }],
});
expect(screen.queryByRole('button', { name: 'Mark Shipped' })).not.toBeInTheDocument();
expect(screen.getByRole('button', { name: 'Cancel Order' })).toHaveClass('bg-red');
expect(screen.getByRole('button', { name: /mark shipped/i })).toBeInTheDocument();

await user.click(screen.getByRole('button', { name: /mark shipped/i }));
expect(screen.getByLabelText(/tracking number/i)).toBeRequired();
expect(screen.getByLabelText(/quantity.*line/i)).toHaveValue(2);

await user.click(screen.getByRole('button', { name: /refund/i }));
expect(screen.getByLabelText(/reason/i)).toBeRequired();
```

Mock `fetchJson` and assert successful initial shipment calls `/orders/:id/actions/markShipped` before `/orders/:id/shipments`; assert shipment failure after the first call surfaces error and refetches rather than issuing compensating action.

- [ ] **Step 2: Run Order Detail tests and observe RED**

Run:
```powershell
npm test -- --run admin/src/features/orders/OrderDetailPage.test.ts
```

Expected: test failures because types/mutations/modals and fields do not exist.

- [ ] **Step 3: Implement minimal typed mutations and modal flows**

```ts
export interface OrderAction { action: string; label: string }
export interface RefundReasonOption { value: string; label: string }
export interface ShipmentItemPayload { order_line_id: number; quantity: number }
export interface CreateShipmentPayload {
  tracking_number: string;
  shipment_carrier: 'manual' | 'ups' | 'usps' | 'fedex' | 'dhl';
  items: ShipmentItemPayload[];
}

export async function performOrderAction(id: string, action: string): Promise<Order> {
  return unwrap(await fetchJson(`/orders/${id}/actions/${action}`, { method: 'POST' }));
}
```

In detail UI, use a dedicated shipment modal. Prefill quantities from `remaining_shippable_quantities` for non-shipping lines. Filter `markShipped` from generic action list. Generic actions use existing ConfirmModal. Shipment submit executes `markShipped` first only for `processing`, awaits it, then submits shipment. On any success/error, invalidate/refetch detail; never send reverse action. Add translated labels for all new visible text.

- [ ] **Step 4: Run Order Detail tests and verify GREEN**

Run the Step 2 command.

Expected: actions, confirmation, shipment payload/order, refund reason validation/payload, and no-rollback behavior all pass.

- [ ] **Step 5: Typecheck and build order UI**

Run:
```powershell
npx tsc --noEmit
npm run build
```

Expected: both exit 0. Do not commit.

---

### Task 3: Add secure Return Request tracking, waiver, and preview APIs

**Files:**
- Modify: `backend/app/Http/Controllers/Api/ReturnRequestController.php`
- Modify: `backend/app/Http/Resources/Api/OrderReturnRequestResource.php`
- Modify: `backend/routes/api.php`
- Modify: `backend/tests/Feature/ReturnRequestApiTest.php`

**Interfaces:**
- Consumes: `ReturnRequestService::addTracking(OrderReturnRequest,string,?string)`, `approveLowValueWaiver(OrderReturnRequest,?string)`, `calculateRefundEstimate(OrderReturnRequest,bool)`.
- Produces:
  - `POST /admin/return-requests/{id}/tracking` `{tracking_number:string,carrier?:Carrier}`.
  - `POST /admin/return-requests/{id}/approve-low-value-waiver` `{admin_note?:string}`.
  - `POST /admin/return-requests/{id}/preview` `{fee_waived?:boolean}`.
  - Resource fields `return_tracking_number`, `return_carrier`, `return_tracking_url`, `low_value_auto_waive_eligible`.

- [ ] **Step 1: Write failing endpoint/resource tests**

```php
$this->actingAs($orderManager, 'sanctum')
    ->postJson("/api/admin/return-requests/{$approved->id}/tracking", [
        'tracking_number' => '9400TEST', 'carrier' => 'usps',
    ])->assertOk()
      ->assertJsonPath('data.return_tracking_number', '9400TEST');

$this->actingAs($orderManager, 'sanctum')
    ->postJson("/api/admin/return-requests/{$requested->id}/tracking", [
        'tracking_number' => '9400TEST', 'carrier' => 'usps',
    ])->assertUnprocessable();

$this->actingAs($support, 'sanctum')
    ->postJson("/api/admin/return-requests/{$ineligible->id}/approve-low-value-waiver")
    ->assertUnprocessable();

$this->actingAs($staff, 'sanctum')
    ->postJson("/api/admin/return-requests/{$eligible->id}/preview", ['fee_waived' => true])
    ->assertOk()->assertJsonStructure(['item_subtotal', 'tax', 'restocking_fee', 'estimated_refund']);
```

Also assert non-admin users receive 403 and repeated tracking is rejected without replacing the stored number; assert resource eligibility is strict true only.

- [ ] **Step 2: Run Return Request tests and observe RED**

Run:
```powershell
$env:APP_ENV='testing'; $env:MAIL_MAILER='array'; $env:DB_CONNECTION='sqlite'; $env:DB_DATABASE=':memory:'; $env:APP_KEY='base64:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='; php artisan test tests/Feature/ReturnRequestApiTest.php
```

Expected: new endpoint/resource assertions fail because routes/controller methods do not exist.

- [ ] **Step 3: Implement minimal authorized controller/resource/route layer**

```php
// Resource
'return_tracking_number' => $this->return_tracking_number,
'return_carrier' => $this->return_carrier,
'return_tracking_url' => $this->return_tracking_url,
'low_value_auto_waive_eligible' => ($this->meta['low_value_auto_waive_eligible'] ?? false) === true,

// Controller guard before service call
if ($returnRequest->status !== OrderReturnRequest::STATUS_APPROVED || filled($returnRequest->return_tracking_number)) {
    throw ValidationException::withMessages(['tracking_number' => ['Return tracking cannot be added to this request.']]);
}
```

Each new controller method first applies `canManageOrders`, loads `order` and `items.orderLine`, validates scalar payloads, and either returns a resource or decimal estimate JSON. Add routes inside current `/admin` group adjacent to existing Return Request routes. For waiver require `status === STATUS_REQUESTED` and strict boolean meta eligibility before invoking service. Do not edit the public guest preview endpoint.

- [ ] **Step 4: Run Return Request tests and verify GREEN**

Run the Step 2 command.

Expected: all role/status/eligibility/duplicate tracking/preview tests pass. Rejected requests perform no service side effect.

- [ ] **Step 5: Inspect admin routes and run PHP lint**

Run:
```powershell
php artisan route:list --path=api/admin/return-requests --json
php -l app/Http/Controllers/Api/ReturnRequestController.php
php -l app/Http/Resources/Api/OrderReturnRequestResource.php
```

Expected: all three POST routes are protected by the existing admin group and lint exits 0. Do not commit.

---

### Task 4: Add Return Request operational UI and live preview

**Files:**
- Modify: `admin/src/features/return-requests/api.ts`
- Modify: `admin/src/features/return-requests/ReturnRequestDetailPage.tsx`
- Modify: `admin/src/features/return-requests/ReturnRequestDetailPage.test.tsx`
- Modify: `admin/src/locales/en.json`
- Modify: `admin/src/locales/vi.json`

**Interfaces:**
- Consumes Task 3 resource fields and endpoints.
- Produces `addReturnRequestTracking`, `approveLowValueWaiver`, `previewReturnRequest`; query invalidation updates `['return-requests', id]` and list keys after successful mutations.

- [ ] **Step 1: Write failing frontend interaction tests**

```tsx
renderReturnRequest({ status: 'approved', return_tracking_number: null, low_value_auto_waive_eligible: false });
expect(screen.getByRole('button', { name: /add return tracking/i })).toBeInTheDocument();

renderReturnRequest({ status: 'requested', low_value_auto_waive_eligible: true });
expect(screen.getByRole('button', { name: /refund, no return required/i })).toBeInTheDocument();

await user.click(screen.getByRole('button', { name: /approve/i }));
await waitFor(() => expect(fetchJson).toHaveBeenCalledWith(
  '/admin/return-requests/42/preview',
  expect.objectContaining({ method: 'POST', body: { fee_waived: false } }),
));
await user.click(screen.getByLabelText(/fee waived/i));
await waitFor(() => expect(fetchJson).toHaveBeenCalledWith(
  '/admin/return-requests/42/preview',
  expect.objectContaining({ method: 'POST', body: { fee_waived: true } }),
));
```

Assert tracking/waiver buttons are absent for ineligible states, tracking submit requires number, and a preview rejection still leaves Approve confirm enabled.

- [ ] **Step 2: Run Return Request detail tests and observe RED**

Run:
```powershell
npm test -- --run admin/src/features/return-requests/ReturnRequestDetailPage.test.tsx
```

Expected: tests fail because types/mutations/buttons/preview UI are absent.

- [ ] **Step 3: Implement typed API hooks and UI**

```ts
export interface ReturnRefundEstimate {
  item_subtotal: number;
  tax: number;
  restocking_fee: number;
  estimated_refund: number;
}

export async function previewReturnRequest(id: string, feeWaived: boolean): Promise<ReturnRefundEstimate> {
  return fetchJson(`/admin/return-requests/${id}/preview`, { method: 'POST', body: { fee_waived: feeWaived } });
}
```

Add distinct tracking and waiver modal action states without weakening existing approve/reject/complete flow. When Approve modal opens or `feeWaived` changes, request preview. Render Item value, Restocking fee, Estimated refund when available; show a small translated informational error if unavailable while leaving confirm enabled. Use `displayMoney`; no client calculation. Add both locale sets.

- [ ] **Step 4: Run Return Request detail tests and verify GREEN**

Run the Step 2 command.

Expected: status/eligibility visibility, payloads, preview initial/toggle calls, estimate rendering, and nonblocking preview failure all pass.

- [ ] **Step 5: Run full admin verification**

Run:
```powershell
npm test
npx tsc --noEmit
npm run build
git diff --check
```

Expected: all commands exit 0. Do not commit.

---

### Task 5: Final scope and regression verification

**Files:**
- Modify only Round C report artifacts under `.superpowers/sdd/2026-09-02-sales-admin-parity-round-c/`.

**Interfaces:**
- Consumes all Task 1–4 changes.
- Produces a Claude-review handoff with exact test evidence and known environment warnings.

- [ ] **Step 1: Run full relevant backend suites**

Run:
```powershell
$env:APP_ENV='testing'; $env:MAIL_MAILER='array'; $env:DB_CONNECTION='sqlite'; $env:DB_DATABASE=':memory:'; $env:APP_KEY='base64:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='; php artisan test tests/Feature/CheckoutApiTest.php tests/Feature/ReturnRequestApiTest.php tests/Feature/AdminPermissionMatrixTest.php tests/Feature/AdminAuthTest.php
```

Expected: exit 0. Record assertion count and distinguish known absent-worktree-`.env` warnings from failures.

- [ ] **Step 2: Audit route gates and changed scope**

Run:
```powershell
php artisan route:list --path=api/admin/return-requests --json
git diff --check
git diff -- backend/app/Services/OrderOperationsService.php backend/app/Services/ReturnRequestService.php backend/app/Security/AdminPermissionMatrix.php backend/app/Http/Middleware/EnforceAdminApiPermission.php
```

Expected: new Return Request routes stay in admin group; whitespace check passes; protected service/matrix/middleware diff is empty.

- [ ] **Step 3: Conduct independent final review**

Review the brief, design, plan, exact Round C diff and test evidence. Reject any accidental checkout/state-machine/service/vendor/migration/permission changes. Confirm UI only derives actions/eligibility from server contracts and controller preconditions independently prevent invalid calls.

- [ ] **Step 4: Write Claude handoff**

Create `.superpowers/sdd/2026-09-02-sales-admin-parity-round-c/final-verification.md` recording tasks, reviewer verdicts, endpoint contracts, scope rulings, exact fresh test/build outputs, known warnings, and explicit statement that no commit/merge/push occurred.

- [ ] **Step 5: Preserve worktree for review**

Do not stage, commit, merge, push, deploy, or delete worktree files. Report the handoff path to Claude.
