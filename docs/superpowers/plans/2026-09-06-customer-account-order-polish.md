# Customer Account Order Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align customer account order details with checkout-success presentation and preserve phone continuity for split-billing and legacy orders.

**Architecture:** Make surgical UI changes in the existing account page, send the existing contact phone when a different billing address is built, and expose a billing-phone fallback through the customer-safe resource. Do not change return rules or order calculations.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS 4, Laravel 11, PHPUnit, Node test runner.

**Spec:** `docs/superpowers/specs/2026-09-06-order-email-content-admin-followups-design.md`

## Global Constraints

- Depends on `2026-09-06-customer-order-api-boundary.md`.
- Read the relevant Next.js 16 guides under `frontend/node_modules/next/dist/docs/` before modifying frontend code.
- Final total format is `USD $123.45`; do not prepend a second dollar sign.
- Exact label: `Estimated Taxes`.
- Preserve existing quantity-based `Subtotal · N items`.
- Do not add a separate billing-phone field or change return eligibility, tokens, navigation, tax calculations, or address-book behavior.
- Run GitNexus impact before symbol edits and detect-changes before commits.
- Preserve unrelated working-tree changes.

---

### Task 1: Add Account Source-Contract Tests

**Files:**
- Create: `frontend/app/account/page.test.mjs`

- [ ] Using the existing `node:test` source-contract convention, assert:
  - active return action has border/background plus visible hover feedback—not underline alone;
  - closed state is a disabled `<button>`, not `<p>`;
  - collapsed and expanded totals show `order.currency` before `order.total.formatted`;
  - separate billing payload includes `phone: form.phone`;
  - billing display uses `order.billing_address.phone || order.shipping_address.phone`;
  - exact `Estimated Taxes` copy;
  - existing `Subtotal &middot; {itemCount(order)}` remains.
- [ ] Run RED:

```powershell
cd frontend
node --test app/account/page.test.mjs
```

---

### Task 2: Carry the Contact Phone into Split Billing

**Files:**
- Modify: `frontend/components/CheckoutPage.tsx`
- Modify: `backend/tests/Feature/CheckoutApiTest.php`

- [ ] Add a backend integration test submitting a different billing address and contact phone `5125550101`; assert the billing address stores that phone.
- [ ] Run RED with `php artisan test tests/Feature/CheckoutApiTest.php --filter=different_billing_address`.
- [ ] In the different-billing builder pass exactly `phone: form.phone`; introduce no new state/UI.
- [ ] Run source test, lint, and backend test.
- [ ] Commit:

```powershell
git add frontend/components/CheckoutPage.tsx frontend/app/account/page.test.mjs backend/tests/Feature/CheckoutApiTest.php
git diff --cached
git commit -m "fix(checkout): carry contact phone into split billing" -m "Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 3: Add Legacy Billing-Phone Fallback

**Files:**
- Modify: `backend/app/Http/Resources/Api/CustomerOrderResource.php`
- Modify: `backend/tests/Feature/CheckoutApiTest.php`

- [ ] Add a failing owner-endpoint test with null billing phone and shipping phone `5125550101`; assert `data.billing_address.phone` equals the shipping phone.
- [ ] Implement response-only fallback:

```php
'phone' => $billingAddress?->contact_phone
    ?: $shippingAddress?->contact_phone,
```

- [ ] Do not mutate/backfill database records.
- [ ] Run `php artisan test tests/Feature/CheckoutApiTest.php --filter="billing.*phone|customer_order"`.
- [ ] Commit the resource/test change separately.

---

### Task 4: Polish the Account Order Summary

**Files:**
- Modify: `frontend/app/account/page.tsx`
- Test: `frontend/app/account/page.test.mjs`

- [ ] Keep `handleRequestReturn(order)`, loading copy, and eligibility logic.
- [ ] Replace underline-only appearance with a compact bordered white secondary button using visible `hover:bg-*`, `hover:border-*`, and/or `hover:shadow-*` states.
- [ ] Replace closed-state `<p>` with a disabled button and retain the 30-day explanation beneath it.
- [ ] Render currency first in both locations:

```tsx
<span className="mr-1 text-xs font-medium text-zinc-400">{order.currency}</span>
{order.total.formatted}
```

- [ ] Add UI fallback:

```tsx
{order.billing_address.phone || order.shipping_address.phone}
```

- [ ] Change only `Estimated Tax` to `Estimated Taxes`.
- [ ] Do not rewrite item counting/subtotal.
- [ ] Run:

```powershell
cd frontend
node --test app/account/page.test.mjs
npm run lint -- app/account/page.tsx components/CheckoutPage.tsx
npm test
npm run build
```

- [ ] Commit:

```powershell
git add frontend/app/account/page.tsx frontend/app/account/page.test.mjs
git diff --cached
git commit -m "fix(account): polish order totals and return controls" -m "Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 5: Cross-Layer Verification

- [ ] Run backend regressions:

```powershell
cd backend
php artisan test tests/Feature/CheckoutApiTest.php --filter="billing|customer_order"
php artisan test tests/Feature/OrderPublicResourceTest.php
php artisan test tests/Feature/ReturnRequestApiTest.php
```

- [ ] Manually verify eligible/closed returns, new split billing, legacy null billing phone, multi-quantity order, and free/paid shipping at mobile and desktop widths.
- [ ] Confirm no duplicate `$`, no page overflow, and exact tax copy.
- [ ] Run GitNexus detect-changes and inspect final diff.

## Definition of Done

1. Split billing stores the existing contact phone.
2. Legacy null billing phones display shipping phone without data mutation.
3. Active/closed return controls have visible and semantic button states.
4. Both totals display code before amount.
5. Tax label is exactly `Estimated Taxes`.
6. Quantity-based subtotal remains unchanged.
