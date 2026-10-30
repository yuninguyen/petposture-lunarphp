# Admin Orders and Legacy Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align React Orders and legacy Filament order presentation for customer identity, payment funding, item quantity, shipping labels, taxes, and currency.

**Architecture:** Extend only the staff order DTO with safe presentation metadata, create tested React presentation helpers, and reuse a small PHP formatter for legacy Filament. Keep the customer-safe API boundary intact and avoid BIN/provider lookups.

**Tech Stack:** Laravel 11, Lunar, Filament, React, TypeScript, Vite, i18next, PHPUnit, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-06-order-email-content-admin-followups-design.md`

## Global Constraints

- Depends on the P0 customer order API boundary.
- Orders-list heading stays `Customer`: name primary, email secondary; email alone when no name.
- Generic method is `Card`; funding-specific copy comes only from `card_funding`.
- No BIN lookup. Expose at most funding, brand, last four, and PayPal payer email to staff.
- Never expose PAN, CVC, BIN, client secret, capture ID, or raw payment metadata.
- Total format: `USD $123.45`; tax label: `Estimated Taxes`; item count excludes shipping.
- Add all changed admin strings to EN and VI.
- Legacy `ViewOrder.php` already has phone, funding-aware card details, shipping method, tracking, and action group; do not redo them.
- Run GitNexus impact before every symbol edit and detect-changes before commits.
- Preserve unrelated locale/mail/docs changes.

---

### Task 1: Extend the Staff Order Contract Safely

**Files:**
- Modify: `backend/app/Http/Resources/Api/OrderResource.php`
- Modify: `backend/app/Payments/Gateways/StripeCardGateway.php`
- Modify: `backend/app/Services/CheckoutService.php`
- Modify: `backend/tests/Feature/CheckoutApiTest.php`

- [x] Add failing admin endpoint assertions for `card_funding` and `paypal_payer_email`.
- [x] Add a customer-resource regression assertion proving both are absent from customer endpoints.
- [x] Add failing tests that supported checkout methods and manually-created card orders use generic label `Card`.
- [x] Add configured shipping-name coverage where recorded name differs from title-cased code.
- [x] Run RED.
- [x] Add only these staff fields beside brand/last4:

```php
'card_funding' => $meta['card_funding'] ?? null,
'paypal_payer_email' => $meta['paypal_payer_email'] ?? null,
```

- [x] Resolve shipping label from loaded shipping line description first, then existing shipping-name service fallback; avoid list N+1 queries.
- [x] Change generic Stripe and manual order labels to `Card`. Keep explicit `Credit Card` only for `card_funding === 'credit'`.
- [x] Run focused API/security tests and commit `fix(orders): expose safe admin payment details`.

---

### Task 2: Build React Order Presentation Helpers

**Files:**
- Create: `admin/src/features/orders/orderPresentation.tsx`
- Create: `admin/src/features/orders/orderPresentation.test.tsx`
- Modify: `admin/src/features/orders/api.ts`
- Modify: `admin/src/components/ui/icons.tsx`

**Interfaces:**

```ts
export type CardFunding = 'credit' | 'debit' | 'prepaid' | 'unknown';
export function getOrderCustomerName(order): string | null;
export function getOrderItemQuantity(lines): number;
export function formatOrderAmount(value, currency): string;
export function getOrderPaymentPresentation(order): PaymentPresentation;
export function OrderPaymentDisplay(props): React.ReactElement;
```

- [x] Extend `Order` with `payment_method`, `card_funding`, and `paypal_payer_email`; do not add sensitive identifiers.
- [x] Test customer full/partial/missing names.
- [x] Test item quantities 2+3 with shipping quantity 1 result in 5.
- [x] Test `USD $123.45`, non-USD symbol/code, null, and zero using `Intl.NumberFormat`.
- [x] Test credit/debit/prepaid/unknown/null funding, brand-only, last4-only, both, and metadata-race fallback.
- [x] Test PayPal with/without payer email.
- [x] Add local decorative `CardIcon` and `PayPalIcon` with `aria-hidden` and visible text labels; no provider request.
- [x] Implement minimal helpers; never infer funding from brand/last4.
- [x] Run tests and commit `feat(admin): add order presentation helpers`.

---

### Task 3: Update React Orders List

**Files:**
- Modify: `admin/src/features/orders/OrdersListPage.tsx`
- Modify: `admin/src/features/orders/OrdersListPage.test.tsx`
- Review/update if needed: `admin/src/features/orders/OrdersListPage.test.ts`

- [x] Add failing test: Customer cell shows `Jane Doe` primary and `buyer@example.com` secondary under existing Customer heading.
- [x] Add no-name fallback test: email appears exactly once and no empty primary row.
- [x] Add debit Mastercard/4444 and `USD $12.99` assertions; generic Credit Card must not appear.
- [x] Replace direct `payment_label` with `OrderPaymentDisplay` and direct formatted total with `formatOrderAmount(total.decimal, total.currency)`.
- [x] Keep table column count/state-row `colSpan` consistent; do not add a new column.
- [x] Run list/helper tests and commit `fix(admin): improve order list customer and payment cells`.

---

### Task 4: Update React Order Detail

**Files:**
- Modify: `admin/src/features/orders/OrderDetailPage.tsx`
- Modify: `admin/src/features/orders/OrderDetailPage.test.ts`
- Modify: `admin/src/locales/en.json`
- Modify: `admin/src/locales/vi.json`

- [x] Add integrated debit and PayPal detail tests.
- [x] Add exact assertions for `Items Subtotal · 5 items`, `Shipping - Priority Express`, `Estimated Taxes`, and code-first amounts.
- [x] Add bilingual keys for Card/Credit/Debit/Prepaid/PayPal, item count, estimated taxes, and shipping-with-method.
- [x] Change the local `Detail` value type from string to `React.ReactNode`; do not use unsafe HTML.
- [x] Remove local payment formatter and render `OrderPaymentDisplay` with payer email enabled.
- [x] Use shared amount formatting for summary, unit prices, line subtotals, discount, shipping, taxes, and total. Convert `refund_amount` from minor units explicitly before formatting.
- [x] Compute quantity from product lines and use configured shipping label.
- [x] Stage locale hunks carefully, run all order tests/build, and commit `fix(admin): align order detail payment and totals`.

---

### Task 5: Add a Testable Legacy Presentation Helper

**Files:**
- Create: `backend/app/Support/Orders/AdminOrderPresentation.php`
- Create: `backend/tests/Unit/Support/Orders/AdminOrderPresentationTest.php`

**Interfaces:**

```php
final class AdminOrderPresentation
{
    public static function paymentMethod(array $meta): string;
    public static function money(mixed $amount, ?string $currencyCode): string;
    public static function productQuantity(iterable $lines): int;
}
```

- [x] Test credit/debit/prepaid/generic card, PayPal payer email/no email, COD, and unknown methods.
- [x] Test USD fallback and explicit non-USD code-first money.
- [x] Test quantity excludes shipping.
- [x] Implement escaped-text-ready strings; views remain responsible for escaping and must not call `->html()`.
- [x] Run unit tests and commit `refactor(orders): centralize legacy order formatting`.

---

### Task 6: Apply Legacy View/List Parity

**Files:**
- Modify: `backend/app/Filament/Resources/OrderResource/Pages/ViewOrder.php`
- Modify: `backend/app/Filament/Resources/OrderResource.php`
- Test: `backend/tests/Unit/Support/Orders/AdminOrderPresentationTest.php`
- Optional: `backend/tests/Feature/Filament/OrderResourcePresentationTest.php`

- [x] Add failing render/config assertions for quantity, code-first totals, configured shipping label, exact tax label, and PayPal payer email.
- [x] Replace inline payment closure with the helper, preserving escaped TextEntry and existing funding behavior.
- [x] Update Items Subtotal to `Items Subtotal · N items`.
- [x] Use helper money formatting for line and summary amounts; preserve signed discount output.
- [x] Change `Tax` to `Estimated Taxes`; keep configured shipping method.
- [x] Change only legacy list generic card mapping to `Card`.
- [x] Do not alter phone/tracking/action-group behavior.
- [x] Run legacy unit/Filament/permission tests, Pint changed files, and commit `fix(orders): align legacy order summary presentation`.

---

### Task 7: Cross-Surface Verification

- [x] Run all admin tests/build.
- [x] Run backend Checkout, PayPal, customer-resource, permission, and legacy presentation tests plus static analysis.
- [x] Search for stale generic `Credit card` usage; retain only explicit credit-funding wording.
- [x] Search admin order contract for forbidden sensitive identifiers.
- [x] Manually inspect credit, debit, prepaid, unknown funding, metadata race, PayPal with/without email, COD, missing customer name, multi-quantity, and custom shipping name.
- [x] Run GitNexus detect-changes and final diff review.

## Definition of Done

1. Customer heading/design is correct without an extra email column.
2. Funding-specific labels are accurate; unknown is Card.
3. PayPal account displays only to staff when present.
4. Item quantity, shipping, taxes, and money are consistent across React and legacy admin.
5. Customer-safe responses remain free of added staff metadata.
6. No BIN lookup or sensitive payment identifier is introduced.
