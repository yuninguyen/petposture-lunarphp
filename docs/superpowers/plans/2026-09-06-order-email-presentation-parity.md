# Order Email Presentation Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the five named order emails into consistent parity for payment details, address phones, item counts, shipping labels, taxes, and currency formatting without changing delivery behavior.

**Architecture:** Keep Mailables/jobs unchanged. Add three narrow Blade partials for payment, address, and summary rows, then adopt only where a template is missing behavior. Preserve already-correct confirmation sections.

**Tech Stack:** Laravel 11, Blade, Lunar, PHPUnit, Resend-compatible HTML email.

**Spec:** `docs/superpowers/specs/2026-09-06-order-email-content-admin-followups-design.md`

## Global Constraints

- Affected views: `cancelled-order-admin`, `new-order-admin`, `order-delivered`, `order-confirmation`, `order-cancelled`.
- Total format: actual currency code then amount, e.g. `USD $123.45`; USD only as fallback.
- Exact tax label: `Estimated Taxes`; quantity excludes shipping lines.
- Generic payment copy: `Card`; no BIN lookup or invented metadata.
- PayPal may show payer email; never capture IDs.
- No CID embedding or `$message->embed`.
- Do not change Mailables, queue jobs, webhook persistence, subjects, or transport.
- Preserve unrelated working-tree changes.
- Run GitNexus impact before edits and detect-changes before commits.

---

### Task 1: Characterize All Five Views

**Files:**
- Create: `backend/tests/Feature/OrderEmailPresentationTest.php`

- [ ] Add `makeOrder(array $meta = [], string $currencyCode = 'USD'): Order` and a renderer keyed by `confirmation`, `new-admin`, `cancelled-admin`, `cancelled`, `delivered`.
- [ ] Use two product lines with quantities 1 and 2, a shipping line, distinct synthetic phones, known totals, shipping method, and currency.
- [ ] Assert all five render. Lock existing confirmation behavior: both phones, `Subtotal · 3 items`, shipping method, currency.
- [ ] Run `php artisan test tests/Feature/OrderEmailPresentationTest.php`.
- [ ] Commit the test scaffold.

---

### Task 2: Centralize Payment Presentation

**Files:**
- Create: `backend/resources/views/mail/partials/payment-method.blade.php`
- Modify: `backend/resources/views/mail/order-confirmation.blade.php`
- Modify: `backend/resources/views/mail/new-order-admin.blade.php`
- Modify: `backend/resources/views/mail/cancelled-order-admin.blade.php`
- Modify: `backend/resources/views/mail/order-cancelled.blade.php`
- Test: `backend/tests/Feature/OrderEmailPresentationTest.php`

**Interface:**

```blade
@include('mail.partials.payment-method', ['order' => $order, 'amount' => $total])
```

- [ ] Add failing tests for Visa/4242, PayPal payer email with forbidden capture ID, and card webhook-race fallback.
- [ ] Implement safely cast metadata and reuse existing HTTPS card icon mapping with meaningful visible fallback text.
- [ ] Use funding-specific wording only for explicit `credit`, `debit`, or `prepaid`. Unknown/missing funding is `Card`.
- [ ] Append brand/last4 only when present; never fabricate or render gateway identifiers.
- [ ] Integrate minimally; leave confirmation phones/subtotal/shipping/total intact.
- [ ] Run focused GREEN tests and commit `feat(mail): make order payment details resilient`.

---

### Task 3: Add Shared Address Rendering

**Files:**
- Create: `backend/resources/views/mail/partials/order-address.blade.php`
- Modify: `backend/resources/views/mail/new-order-admin.blade.php`
- Modify: `backend/resources/views/mail/cancelled-order-admin.blade.php`
- Modify: `backend/resources/views/mail/order-delivered.blade.php`
- Test: `backend/tests/Feature/OrderEmailPresentationTest.php`

- [ ] Add failing assertions: admin templates contain both phones; delivered contains shipping phone; confirmation still contains both.
- [ ] Implement null-tolerant escaped address lines, optional line two, city/state/postcode, country fallback, and optional `contact_phone`.
- [ ] Do not implement cross-address phone fallback in mail presentation.
- [ ] Replace only duplicated bodies in missing templates; preserve layout/headings.
- [ ] Run focused tests and commit `feat(mail): include phones in order emails`.

---

### Task 4: Normalize Summary Rows

**Files:**
- Create: `backend/resources/views/mail/partials/order-summary-rows.blade.php`
- Modify: `backend/resources/views/mail/new-order-admin.blade.php`
- Modify: `backend/resources/views/mail/cancelled-order-admin.blade.php`
- Modify: `backend/resources/views/mail/order-cancelled.blade.php`
- Test: `backend/tests/Feature/OrderEmailPresentationTest.php`

**Interface:** parent passes precomputed `itemCount`, subtotal, discount/coupon, shipping total/label, and tax total. The partial performs no query.

- [ ] Add failing assertions for `Subtotal · 3 items`, configured shipping label, `Estimated Taxes`, and `USD $118.25`.
- [ ] Add CAD coverage proving currency is dynamic.
- [ ] Resolve shipping from recorded shipping line description first, then existing service/model fallback without N+1 queries.
- [ ] Render subtotal, optional discount, shipping/free state, and taxes in the partial.
- [ ] Keep grand total in parent and change it to actual currency code before amount.
- [ ] Do not add totals to delivered email or rewrite confirmation’s correct summary.
- [ ] Run tests and commit `feat(mail): normalize order email summaries`.

---

### Task 5: Complete Regression Verification

- [ ] Add minimal-meta coverage proving all five views render without undefined-index output.
- [ ] Run:

```powershell
cd backend
php artisan test tests/Feature/OrderEmailPresentationTest.php
php artisan test tests/Feature/OrderDeliveryReliabilityTest.php
php artisan test tests/Feature/PayPalApiTest.php
php artisan test tests/Feature/CheckoutApiTest.php
vendor/bin/pint --test
vendor/bin/phpstan analyse --no-progress
php artisan test
```

- [ ] Preview card, metadata-race, PayPal, and non-USD emails.
- [ ] Confirm no Mailable/job/webhook/transport file changed, no CID use exists, and no gateway identifier renders.
- [ ] Run GitNexus detect-changes and inspect final diff.

## Definition of Done

1. Required phones appear in previously missing templates.
2. Payment-bearing templates safely handle card, PayPal, and metadata races.
3. Summaries show quantity, shipping method, exact tax label, and actual currency code first.
4. Confirmation’s correct behavior remains intact.
5. Delivery/queue/webhook/Resend behavior is unchanged.
