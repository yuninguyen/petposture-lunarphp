# Customer Order API Boundary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent authenticated customer order endpoints from exposing the staff-facing order DTO while preserving the account page contract.

**Architecture:** Introduce an allowlist-based `CustomerOrderResource` and route customer index/show handlers through it. Keep `OrderResource` admin-only. Remove the same rich resource from the public PayPal-capture response.

**Tech Stack:** Laravel 11, PHP 8.3, Lunar, Sanctum, PHPUnit.

**Spec:** `docs/superpowers/specs/2026-09-06-order-email-content-admin-followups-design.md`

## Global Constraints

- This is P0 and lands before account-order cosmetic work.
- Customer and admin resources must be separate by construction; do not derive the customer DTO with `Arr::except()`.
- Preserve owner scoping, status filtering, pagination, order images, addresses, totals, shipments/tracking, timestamps, and customer-facing payment/return behavior.
- Never expose internal notes, fraud/network/device fields, gateway identifiers, refund operations, or staff actions to customers.
- Before modifying each function/method/class, run GitNexus upstream impact analysis and report its risk. Warn before HIGH/CRITICAL edits.
- Before each commit, run `gitnexus_detect_changes(scope: "all")`.
- Do not stage unrelated existing working-tree changes.

---

### Task 1: Lock the Customer Contract with Failing Tests

**Files:**
- Modify: `backend/tests/Feature/CheckoutApiTest.php`

**Interfaces:**
- Exercises `GET /api/orders` and `GET /api/orders/{id}`.
- Confirms `GET /api/admin/orders/{id}` remains staff-rich.

- [ ] **Step 1: Add an owner-scoped index test**

Create two authenticated customers and one order for each. Populate the owner order with unmistakable synthetic values for `internal_note`, fraud score/message, IP/device fields, attribution fields, payment intent/event IDs, refund identifiers, and admin action metadata.

Assert the response contains only the owner order and retains:

```text
id, reference, status/status_label
payment_status/payment_status_label
fulfillment_status/fulfillment_status_label
customer_email
payment_method/payment_label/payment_instructions
shipping_label, delivered_at, currency
sub_total, tax_total, shipping_total, discount_total
total.formatted, total.decimal, total.currency
created_at, lines, shipping_address, billing_address, shipments
```

Assert these paths are missing at minimum:

```text
internal_note, notes, customer_note
available_actions, remaining_shippable_quantities, refund_reason_options
order_events
fraud_risk_level, fraud_risk_score, fraud_seller_message
customer_ip, customer_ip_location, customer_ip_isp
customer_user_agent, customer_ip_service_type
attribution_origin, attribution_device_type, attribution_session_page_views
payment_intent_id, payment_intent_status, payment_last_event_type
payment_gateway, payment_collection
refund_id, refund_amount
card_funding, paypal_payer_email
```

Use `assertJsonMissingPath('data.0.internal_note')` and equivalent assertions so null-valued leaks also fail.

- [ ] **Step 2: Add an owner-scoped show test**

Assert the owner receives the safe contract and a different authenticated customer receives the existing generic `404` response for the same ID.

- [ ] **Step 3: Add an admin-preservation assertion**

Assert `/api/admin/orders/{id}` still contains representative staff fields: `internal_note`, `fraud_risk_score`, `customer_ip`, `payment_intent_id`, and `available_actions`.

- [ ] **Step 4: Run RED**

```powershell
cd backend
php artisan test tests/Feature/CheckoutApiTest.php --filter="customer_order|admin_order"
```

Expected: customer missing-path assertions fail because customer and admin routes currently share `OrderResource`.

---

### Task 2: Add the Allowlist-Based Customer Resource

**Files:**
- Create: `backend/app/Http/Resources/Api/CustomerOrderResource.php`
- Reference only: `backend/app/Http/Resources/Api/OrderResource.php`
- Reference only: `backend/app/Http/Resources/Api/OrderTrackingResource.php`

**Interfaces:**
- Produces `CustomerOrderResource::toArray(Request $request): array`.
- Consumes a Lunar `Order` with lines, addresses, and shipments eager-loaded.

- [ ] Run upstream impact analysis for `OrderResource::toArray` and controller methods to be edited; record callers, processes, and risk.
- [ ] Implement an explicit return array with only the customer contract. Reuse needed behavior for money conversion, labels, images, shipping-line fallback, addresses, and customer-safe shipments.
- [ ] Do not instantiate `OrderOperationsService`, expose raw meta, or include staff action/refund/fraud fields.
- [ ] Do not subclass/call `OrderResource` or maintain a denylist.
- [ ] Run:

```powershell
cd backend
php artisan test tests/Feature/CheckoutApiTest.php --filter=customer_order
```

Expected: route tests still fail until Task 3, but the new resource loads cleanly.

---

### Task 3: Separate Customer Route Handlers

**Files:**
- Modify: `backend/app/Http/Controllers/Api/OrderController.php`
- Modify: `backend/routes/api.php`

**Interfaces:**
- Add `customerIndex(Request $request)`.
- Add `customerShow(Request $request, $id)`.
- Existing `index()` and `show()` remain admin-facing.

- [ ] Add `customerIndex()` beginning with `Order::query()->where('user_id', $request->user()->id)`, then apply current validated status filtering, eager loads, latest-first ordering, and pagination by 10.
- [ ] Return `CustomerOrderResource::collection($orders)`.
- [ ] Add `customerShow()` through the same owner scope, eager loads, and generic not-found response; return `new CustomerOrderResource($order)`.
- [ ] Repoint only protected customer routes to these methods. Leave admin routes and mutation responses on `OrderResource`.
- [ ] Run GREEN:

```powershell
cd backend
php artisan test tests/Feature/CheckoutApiTest.php --filter="customer_order|admin_order"
```

- [ ] Run GitNexus detect-changes and commit:

```powershell
git add backend/app/Http/Resources/Api/CustomerOrderResource.php backend/app/Http/Controllers/Api/OrderController.php backend/routes/api.php backend/tests/Feature/CheckoutApiTest.php
git diff --cached
git commit -m "fix(api): isolate customer order responses from admin metadata" -m "Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 4: Remove the Rich Resource from PayPal Capture

**Files:**
- Modify: `backend/app/Http/Controllers/Api/CheckoutController.php`
- Modify: `backend/tests/Feature/PayPalApiTest.php`

- [ ] Extend capture tests with populated staff metadata and missing-path assertions.
- [ ] Confirm checkout success does not consume `captureData.order`. If it does, retain only exactly consumed safe fields in a purpose-built minimal resource.
- [ ] Prefer the same minimal shape in new and already-captured branches:

```json
{"success":true,"capture":{"status":"COMPLETED"}}
```

- [ ] Never serialize `OrderResource` from this endpoint.
- [ ] Run tests and commit:

```powershell
cd backend
php artisan test tests/Feature/PayPalApiTest.php --filter=paypal_order
cd ..
git add backend/app/Http/Controllers/Api/CheckoutController.php backend/tests/Feature/PayPalApiTest.php
git commit -m "fix(api): minimize PayPal capture responses" -m "Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 5: Security Verification

- [ ] Run:

```powershell
cd backend
php artisan test tests/Feature/CheckoutApiTest.php
php artisan test tests/Feature/OrderPublicResourceTest.php
php artisan test tests/Feature/PayPalApiTest.php
php artisan test tests/Feature/ReturnRequestApiTest.php
php artisan test tests/Feature/AdminPermissionMatrixTest.php
vendor/bin/pint --test app/Http/Resources/Api/CustomerOrderResource.php app/Http/Controllers/Api/OrderController.php app/Http/Controllers/Api/CheckoutController.php tests/Feature/CheckoutApiTest.php tests/Feature/PayPalApiTest.php
vendor/bin/phpstan analyse --no-progress
php artisan test
```

- [ ] Run `gitnexus_detect_changes(scope: "all")`; confirm only expected customer/order/capture flows.
- [ ] Inspect final diff for raw meta, denylist serialization, sensitive IDs, or unrelated edits.

## Definition of Done

1. Customer index/show never instantiate `OrderResource`.
2. Staff-only fields remain absent even when populated.
3. Account behavior, owner scoping, filtering, pagination, lines, addresses, and shipments remain intact.
4. Admin endpoints retain the rich DTO.
5. PayPal capture no longer returns the admin resource.
6. Focused and full backend verification passes.
