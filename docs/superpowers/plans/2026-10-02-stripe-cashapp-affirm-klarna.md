# Cash App Pay / Affirm / Klarna at Checkout — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Cash App Pay, Affirm and Klarna as selectable methods in the checkout page's Payment list (below Credit card / PayPal), each showing "You'll be redirected to … to complete your purchase", paid through the existing Stripe account.

**Architecture:** All three are Stripe payment methods, so they reuse the existing Stripe PaymentIntent, the existing `payment_intent.*` webhook (`StripePaymentIntentService::handleWebhook`, keyed by `meta.payment_intent_id`) and the existing Stripe refund path (`meta.payment_gateway === 'stripe'`). New work: three thin `PaymentGatewayInterface` implementations, one new "create intent + return URL" endpoint following the existing redirect-gateway pattern (`prepareRedirectSession`), a `stripe` gateway value for `byPaymentSession`, and a frontend submit branch that calls `stripe.confirmAffirmPayment / confirmKlarnaPayment / confirmCashappPayment`.

**Tech Stack:** Laravel 11 + Lunar (backend), Next.js 16 / React 19 / Tailwind v4 (frontend), Stripe.js v3 loaded by script tag (no npm types — Window.Stripe is hand-typed in TWO files, see Task 5).

**Spec:** none separate — the design and decisions live in this document (sections "Decisions" and "Verified Stripe facts").

## Global Constraints

- Surgical diff. Do NOT change the card flow (`/api/checkout/payment-intent`, `confirmCardPayment`, Stripe Elements), PayPal, Express Checkout, or the existing redirect gateways' behavior.
- Backend CI must stay green: Pint (`./vendor/bin/pint`), PHPStan (baseline), `php artisan test`. Frontend: `npx tsc --noEmit`, `npx eslint` on changed files, `npx vitest run`, `npm run build`.
- Read `frontend/AGENTS.md` first (this Next.js has breaking changes; check `node_modules/next/dist/docs/`).
- Work on branch `feature/stripe-cashapp-affirm-klarna`. Do NOT commit to `main`, push, or deploy. The working tree has unrelated uncommitted files (backend/config/cors.php, sanctum.php, AGENTS.md, CLAUDE.md, docs/, artifacts/) — never stage them.
- Never log or put a PaymentIntent client secret in a URL we build. Our return URL carries only our own `STRIPE-XXXX` session token.
- Before using any Stripe API/JS function, confirm it against the official docs URLs listed below (do not rely on memory).

## Decisions (assumptions — override before starting if wrong)

1. **Row labels:** `Cash App Pay`, `Affirm - Pay Over Time`, `Pay with Klarna` (mirrors the Shopify reference and the user's redirect copy). Labels live in one constant per gateway so they are a one-line change.
2. **Redirect copy (exact, per user):**
   - Cash App Pay: `You'll be redirected to Cash App Pay to complete your purchase`
   - Affirm: `You'll be redirected to Affirm - Pay Over Time to complete your purchase`
   - Klarna: `You'll be redirected to Pay with Klarna to complete your purchase`
3. **Order of rows:** Credit card, PayPal, Cash App Pay, Affirm, Klarna.
4. **Ineligible order amount → hide the method** (Shopify behavior), using min/max per method.
5. **Rollout flag:** methods are shown only when listed in env `STRIPE_ALT_PAYMENT_METHODS` (comma list, e.g. `cashapp,affirm,klarna`; default empty = none). Reason: each must also be activated in the Stripe Dashboard (test and live separately); showing an un-activated method just errors at confirm time.
6. **Order timing:** the Lunar order is created (payment pending) BEFORE redirecting, same as the existing redirect gateways; the webhook marks it paid.
7. **Logos:** use neutral text chips for v1 unless the user supplies official SVGs (put them in `frontend/public/assets/payment-badges/`).
8. Out of scope: Canada, other currencies, manual capture, Payment Method Messaging element, an admin UI toggle, Express Checkout placement.

## Verified Stripe facts (from docs, 2026-10-02)

- Sources to re-read: https://docs.stripe.com/payments/affirm/accept-a-payment.md?payment-ui=direct-api , https://docs.stripe.com/payments/klarna/accept-a-payment.md?payment-ui=direct-api , https://docs.stripe.com/payments/cash-app-pay/accept-a-payment.md?payment-ui=direct-api . **Min/max amount tables are NOT verified** — read `https://docs.stripe.com/payments/affirm.md`, `/klarna.md`, `/cash-app-pay.md` (payment options / limits sections) and record the exact US/USD limits in code with a source comment.
- **Affirm:** US (+CA) only. `stripe.confirmAffirmPayment(clientSecret, { payment_method: { billing_details: { email, name, address: { line1, city, state, country, postal_code } } }, shipping: { name, address: { line1, city, state, country, postal_code } }, return_url })`. billing/shipping optional but recommended; if sent, all of line1/city/state/postal_code/country must be valid. PaymentIntent expires if not completed in 12h. High decline rate → keep Card visible.
- **Klarna:** `stripe.confirmKlarnaPayment(clientSecret, { return_url })`. For approval rates the PaymentIntent should be created with `shipping` (name, address.line1, city, country, postal_code) and `payment_method_data[billing_details]` (name, address.line1, city, country, postal_code, email). 3h to complete.
- **Cash App Pay:** USD only. `stripe.confirmCashappPayment(clientSecret, { payment_method: { type: 'cashapp' }, return_url })`. **Mobile browsers are redirected; desktop shows a QR code modal and is NOT redirected** — after the returned promise resolves without error, redirect to the return URL manually. 10 min to act once `requires_action`.
- All three: Stripe appends `payment_intent` and `payment_intent_client_secret` (Cash App also `redirect_pm_type`, `redirect_status`) to `return_url`; our own query params are preserved. Rely on webhooks for final status.
- Test data: Klarna US approve `customer@email.us`, deny `customer+denied@email.us`, DOB 07-10-1970, any 6-digit 2-step code (`999999` fails), amount `3500` exercises all options. Affirm sandbox may ask SSN last-4 `0000`/`5678`; closing the redirect page with X simulates failure. Cash App test page lets you approve/decline.
- Hard prerequisite (user, in Stripe Dashboard → Settings → Payment methods): enable the three methods in test mode (live later, subject to Stripe approval). The console already warns `cashapp … not activated`.

## File Structure

| File | Responsibility |
|---|---|
| `backend/config/services.php` | `stripe.alt_methods` list from env |
| `backend/app/Services/StripePaymentIntentService.php` | `create()` accepts optional shipping / billing / payment_method_types |
| `backend/app/Payments/Gateways/StripeAltMethodGateway.php` (new, abstract) + `CashAppPayGateway.php`, `AffirmGateway.php`, `KlarnaGateway.php` (new) | method definitions + `prepare()` |
| `backend/app/Providers/AppServiceProvider.php` | register the three gateways after PayPal |
| `backend/app/Http/Controllers/Api/CheckoutController.php` + `backend/routes/api.php` | `POST /api/checkout/stripe-alt-session` |
| `backend/app/Http/Controllers/Api/OrderController.php` | `byPaymentSession` accepts `stripe`; `retryPayment` eligibility |
| `backend/app/Support/Orders/AdminOrderPresentation.php` (+ any other label map) | readable labels |
| `frontend/components/CheckoutPage.tsx`, `frontend/components/orders/RetryPaymentPanel.tsx` | types, list, panel, submit branch |
| `frontend/components/CheckoutSuccessPage.tsx` | return handling (verify only, minimal change) |

---

### Task 1: Config flag + PaymentIntent creation options

**Files:** Modify `backend/config/services.php`, `backend/app/Services/StripePaymentIntentService.php`; Test `backend/tests/Feature/` (new `StripeAltPaymentIntentTest.php` or the nearest existing Stripe service test file).

**Interfaces:**
- Produces: `config('services.stripe.alt_methods'): string[]` (lower-cased, trimmed, empty entries dropped).
- Produces: `StripePaymentIntentService::create(array $payload)` additionally honours optional keys `shipping` (`name`, `line1`, `line2`, `city`, `state`, `postal_code`, `country`), `billing` (same + `email`, `phone`), `payment_method_types` (string[]), `metadata` (flat array). When `payment_method_types` is given, send `payment_method_types[]=…` **instead of** `automatic_payment_methods[enabled]`. With none of the new keys the request body must be byte-for-byte what it is today (the card flow depends on it).

- [ ] **Step 1:** Write failing tests with `Http::fake` on `https://api.stripe.com/v1/payment_intents`: (a) card payload unchanged — asserts `automatic_payment_methods[enabled]=true` and no `shipping`/`payment_method_types`; (b) alt payload asserts `payment_method_types[0]=affirm`, `shipping[address][line1]`, `payment_method_data[billing_details][email]`, and the absence of `automatic_payment_methods[enabled]`.
- [ ] **Step 2:** Run them, see them fail. **Step 3:** Implement (use the existing `array_filter` null/'' stripping so empty optional fields are omitted). **Step 4:** Pass. **Step 5:** `./vendor/bin/pint` on touched files + `./vendor/bin/phpstan analyse` on them.
- [ ] **Step 6:** Commit on the feature branch.

### Task 2: The three gateways

**Files:** Create the four gateway files above; Modify `AppServiceProvider.php:~71` (add after `PayPalGateway`); Test `backend/tests/Feature/CheckoutApiTest.php` (extend the payment-methods test) or a new `StripeAltGatewaysTest.php`.

**Interfaces (each subclass supplies):** `method()` = `cashapp` | `affirm` | `klarna`; `label()`; `minAmountMinor()`/`maxAmountMinor()` (from the docs limits, `null` = unbounded); `currency()` = `usd`.

`definition()` must return: `method`, `label`, `gateway => 'stripe'`, `collection => 'redirect'`, `enabled` (= method is in `services.stripe.alt_methods` **and** Stripe key+secret are configured), `mode` (`configured`|`placeholder`, same rule as `StripeCardGateway`), `brands => [method]`, `min_amount_minor`, `max_amount_minor`, `currency`, `publishable_key`. **No `description` key** (copy lives in the frontend). `prepare()` returns `PaymentPreparation` with `gateway: 'stripe'` (this is what routes refunds to Stripe — keep it), `collectionType: 'redirect'`, `paymentStatus: 'pending'`, and meta `payment_provider_mode`, `payment_intent_id` (from `payment_context.intent_id`), `stripe_session_id` (from `payment_context.session_id`).

- [ ] **Step 1:** Failing tests: with env list empty → the three appear in `GET /api/checkout/payment-methods` with `enabled:false`; with `cashapp,affirm` set → those two `enabled:true`, klarna false; `PaymentGatewayManager::forMethod('affirm')` throws when disabled and returns the gateway when enabled; `prepare()` meta contains `payment_intent_id` and `stripe_session_id`.
- [ ] **Step 2–4:** Implement abstract base + 3 subclasses; register; pass. **Step 5:** Pint + PHPStan. **Step 6:** Commit.

### Task 3: Create-intent endpoint, return lookup, retry

**Files:** Modify `CheckoutController.php`, `backend/routes/api.php`, `OrderController.php`; Test `backend/tests/Feature/` (new `StripeAltCheckoutTest.php`).

**Interfaces:**
- `POST /api/checkout/stripe-alt-session` (middleware `throttle:api-write`, same as the sibling checkout routes). Body: `payment_method` in `cashapp,affirm,klarna`; `items[]` (`variantId`,`quantity`), `coupon_code?`, `shipping_method?`, `email`, `shipping{…}` and `billing{…}` — reuse the exact validation/shape the place-order endpoint already accepts for addresses (read `CheckoutController::placeOrder` rules; do not invent a new shape). Reject with **422** and a friendly message when the method is not enabled, or the computed total is outside the method's min/max (`"<Label> isn't available for this order amount."`).
- Response `200`: `{ success: true, session: { client_secret, intent_id, session_id, return_url, amount, currency, mode, publishable_key } }`. `session_id = 'STRIPE-'.Str::upper(Str::random(20))`; `return_url = rtrim(config('app.frontend_url'),'/')."/checkout/success?gateway=stripe&session_id={session_id}"`. Amount comes from `CheckoutService::calculateTotal` exactly like `preparePaymentIntent`. Create the intent with `payment_method_types: [method]`, shipping+billing mapped from the request (Klarna needs billing name/address/email; Affirm benefits from both), `metadata[source]=petposture-checkout`.
- Follow the existing error handling pattern (try/catch → `ErrorCode::PAYMENT_INTENT_ERROR`, `Log::error`).
- `OrderController::byPaymentSession`: add `stripe` to the `in:` list (it already queries `meta->{gateway}_session_id`, so `stripe_session_id` works unchanged).
- `OrderController::retryPayment`: a failed Affirm/Klarna/Cash App order must be retryable with a card. Extend `$retryEligible` to allow these methods. Then **investigate** what `prepareRetryIntent` + the retry confirm path write to the order and make sure a successful card retry does not leave `meta.payment_method` as `affirm` (set it to `card` when the retry intent is prepared, or document why not needed). Add a test.

- [ ] **Step 1:** Failing tests: success shape; 422 disabled method; 422 amount below min / above max (assert no Stripe call is made); `byPaymentSession?gateway=stripe&session_id=…` finds an order whose meta has that id and returns 404 for unknown/old (>24h) ids; webhook `payment_intent.succeeded` for an order with `payment_gateway=stripe`, `payment_method=affirm` sets `payment_status=paid` (use the existing webhook test as the template); retry eligibility for an `affirm` pending order.
- [ ] **Step 2–4:** Implement; pass. **Step 5:** Pint + PHPStan baseline unchanged; run `php artisan test --filter="CheckoutApiTest|PayPalApiTest|StripeAlt"`. **Step 6:** Commit.

### Task 4: Labels everywhere payment methods are enumerated

**Files:** `backend/app/Support/Orders/AdminOrderPresentation.php` and any other place that special-cases `'paypal'`/`'card'` (run `grep -rn "'paypal'" backend/app admin/src frontend --include=*.php --include=*.ts --include=*.tsx` and review each hit).

- [ ] **Step 1:** `AdminOrderPresentation::paymentMethod` currently falls through to `Str::headline($method)` → `"Cashapp"`. Add explicit labels `Cash App Pay`, `Affirm`, `Klarna`; add a unit test. **Step 2:** Apply the same to the React admin order presentation (`admin/src/features/orders/orderPresentation.tsx`) and the customer-facing order payload label if they enumerate methods. **Step 3:** Commit.

### Task 5: Frontend — types, list, panel

**Files:** Modify `frontend/components/CheckoutPage.tsx`, `frontend/components/orders/RetryPaymentPanel.tsx`; Test `frontend/components/` (new unit test for the pure helpers you extract).

- [ ] **Step 1 — types:** `PaymentMethod` union (`CheckoutPage.tsx:~119`) gets `'cashapp' | 'affirm' | 'klarna'`; `PaymentMethodOption` gets `min_amount_minor?: number | null`, `max_amount_minor?: number | null`. `paymentMethodOrder` gets cashapp:2, affirm:3, klarna:4 (cod/others after).
- [ ] **Step 2 — Window.Stripe typing:** add `confirmAffirmPayment`, `confirmKlarnaPayment`, `confirmCashappPayment` to the hand-written `Window.Stripe` declaration. **This declaration exists in both `CheckoutPage.tsx` and `RetryPaymentPanel.tsx` and TypeScript requires them to be identical (error TS2717 otherwise) — change both identically.**
- [ ] **Step 3 — list:** the `availablePaymentMethods` filter (`~line 757`) currently keeps only `card`/`paypal`/`cod`; also keep the three new methods **only when** the API entry is `enabled` and `finalTotal` (in minor units) is within `min/max`. Extract that eligibility check as a small pure function with a unit test (below/at/above bounds, null bounds, disabled).
- [ ] **Step 4 — panel:** in the `{method.method === 'paypal' && form.paymentMethod === 'paypal' && (...)}` area add a sibling block for the three methods rendering a single `<p>` with the exact copy from "Decisions" #2, using the same wrapper classes and the same `paymentRowClasses` square-bottom/rounding rule (extend `expandsDetailsBelow` to include these methods — see the comment above it). No `description` is rendered in the row.
- [ ] **Step 5 — badges:** `renderPaymentBadges` returns a small neutral chip with the brand name for these methods (or the SVG if supplied).
- [ ] **Step 6:** `npx tsc --noEmit`, eslint, build. Commit.

### Task 6: Frontend — submit flow and return

**Files:** Modify `frontend/components/CheckoutPage.tsx` (`handleCheckout`, `~line 1409`); verify `frontend/components/CheckoutSuccessPage.tsx`.

- [ ] **Step 1:** New branch in `handleCheckout` for the three methods, placed **before** the existing `useRedirectFlow` block and not touching it:
  1. `POST /api/checkout/stripe-alt-session` using the same `buildOrderAddresses()` output the place-order call uses (+ `email`, `items`, coupon, shipping method).
  2. `placeOrder({ intent_id, session_id })` — send only `intent_id` and `session_id` in `payment_context` (the backend `prepare()` reads those two; do NOT send the client secret).
  3. Persist `sessionStorage petposture_payment_access:${session_id}` and clear the local cart exactly like the existing redirect branch does.
  4. If `session.mode === 'placeholder'`: skip Stripe, go to success (same as the card placeholder path).
  5. Otherwise call the matching function with `session.client_secret` and `return_url = session.return_url`: Affirm with billing_details + shipping built from the form; Klarna with `{ return_url }`; Cash App with `{ payment_method: { type: 'cashapp' }, return_url }`, and **after the promise resolves with no error, `window.location.href = session.return_url`** (desktop QR flow does not redirect by itself).
  6. On `error`, show it with the existing error surface for non-PayPal methods; the order stays pending (same as a card decline today).
- [ ] **Step 2:** Verify the success page for `?gateway=stripe&session_id=STRIPE-…`: `CheckoutSuccessPage.tsx:~277` is already generic (`gateway && sessionId`) — confirm it works unchanged. Check how it renders `payment_status` pending/failed for the existing redirect gateways. If a returning shopper whose webhook has not landed yet sees a confusing state, add the smallest fix (e.g. when the URL has `redirect_status=succeeded` and the order is still pending, re-fetch up to ~5 times 2s apart, then show a neutral "payment is processing" note). Do not redesign the page.
- [ ] **Step 3:** CSP: open `frontend/lib/content-security-policy.ts`, confirm nothing blocks the Cash App QR modal / Affirm / Klarna (they run via `js.stripe.com` frames or top-level navigation); run `npx vitest run lib/content-security-policy.test.ts` if you touch it.
- [ ] **Step 4:** Unit-test the payload builders you extract (Affirm billing/shipping mapping, Klarna/Cash App argument shapes) with a mocked `window.Stripe`. Run full checks. Commit.

### Task 7: Verification handoff (Claude does this, not Codex)

- [ ] Re-run all backend/frontend checks independently; mutation-check the new tests.
- [ ] After merge + deploy, purge the Cloudflare zone (the `payment-methods` API response is edge-cached — see memory `cloudflare-api-cache-purge-after-deploy`), set `STRIPE_ALT_PAYMENT_METHODS` on the VPS backend env, enable the methods in the Stripe test dashboard.
- [ ] Live browser pass in test mode with chrome-devtools: each method selected → correct copy; order placed pending; Affirm approve + decline; Klarna approve + deny; Cash App desktop QR approve; webhook marks the order paid; failed attempt → retry with card works; admin shows the right label; refund of an Affirm-paid test order succeeds.

## Self-review checklist (done by plan author)

- Spec coverage: three methods listed with exact copy ✔ (Decisions #2); shown under Payment methods ✔ (Task 5); paid/refunded/reconciled ✔ (Architecture, Task 3 webhook test).
- Types consistent: `session_id`/`return_url`/`intent_id` names identical across Tasks 2, 3, 6; method ids `cashapp|affirm|klarna` identical in config, gateways, route validation and the frontend union.
- Open items for the user before Codex starts: Decisions #1, #4, #5, #7 and the Stripe Dashboard activation.
