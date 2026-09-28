# Express Checkout (PayPal / Apple Pay / Google Pay) — Design

**Status:** Approved by user, pending spec review before implementation planning.
**Owner intent:** Shopify-style express checkout row at the top of the checkout page (`frontend/components/CheckoutPage.tsx`), working across desktop/tablet/mobile.

## 1. Goal

Let a customer complete checkout using PayPal, Apple Pay, or Google Pay **without first filling in the shipping form** — the wallet supplies the shipping address, matching Shopify's express checkout pattern (see reference screenshot: Society6, Shopify-powered store).

## 2. Scope decisions (already made with the user)

- **Full express UX, not just prominent buttons.** Buttons appear before any form field is filled; the wallet provides the address. This requires recalculating shipping/tax without an upfront address, which the existing regular checkout does not need to do.
- **PayPal uses the real PayPal Buttons SDK** for this row specifically (rendered branded button, not a styled link that opens a redirect popup). This reintroduces the PayPal JS SDK that was previously removed (`project_paypal_redirect_flow_2026-09-02`) — but only for this new express slot. The prior bug was a stale closure over in-progress form state inside a `useEffect`; an express button never reads form state (there is no form yet when it renders), so that failure mode does not apply here. **The existing "Pay with PayPal" option inside the regular form keeps its current redirect/popup flow unchanged.**
- **Apple Pay / Google Pay via Stripe's Payment Request Button** (`stripe.paymentRequest()` + `PaymentRequestButtonElement`), which the codebase can adopt cleanly because Stripe Elements is already live for the card flow (`CheckoutPage.tsx` already calls `stripeInstanceRef.current.elements()`). Apple Pay and Google Pay are **not separate payment gateways** in this codebase's architecture (`PaymentGatewayManager`) — both produce a Stripe `PaymentMethod`/confirmed PaymentIntent that is a same-shape "card" charge from the backend's point of view. No new `PaymentGatewayInterface` implementation is needed for them.
- **Order creation approach: "approve-then-create."** The order is only created once the wallet has returned a final address and proof of payment (a confirmed Stripe PaymentMethod, or an approved-but-uncaptured PayPal order id). No pending/"awaiting-payment" order is created while the customer is still inside the wallet sheet. This avoids orphaned pending orders if the customer cancels mid-flow, and avoids showing a wrong total (shipping/tax are unknown until the wallet supplies an address).
- Rejected alternative: create a pending order immediately on button click, attach payment after. Rejected because it produces ghost orders on cancel and gains nothing (totals still can't be computed without an address).
- Rejected alternative: redirect to each provider's own hosted checkout page. Rejected because it breaks the on-page, Shopify-style look the user explicitly asked for.

## 3. Frontend

### 3.1 Placement and layout

- New `<ExpressCheckout>` section rendered at the very top of the existing left column in `CheckoutPage.tsx`, **above** the current breadcrumb (Cart / Information / Shipping / Payment) and above the `<form onSubmit={handleCheckout}>`.
- Small "Express checkout" label above the buttons, an "— OR —" divider below, then the existing form continues completely unchanged.
- Full-width of the left column on all breakpoints (matches the reference screenshot). Buttons lay out in a responsive grid: side-by-side where 2–3 buttons fit comfortably, stacking to one column on narrow mobile widths if all three are present, so no button is squeezed below a usable tap-target size.
- Each button's own SDK decides whether it can render (Apple Pay: Safari + card in Wallet; Google Pay: Chrome + saved card; PayPal: always, given the SDK loads). If a button can't render, it is simply omitted — never shown greyed-out or broken.
- **If none of the three are available** (e.g., desktop Firefox with no PayPal), the entire Express Checkout block — including the label and divider — does not render. The page looks exactly like it does today.

### 3.2 Order summary integration

- While no address has been chosen yet, the order summary shows the subtotal-only total with "Enter shipping address" in place of a shipping line (matches the reference screenshot exactly — this text already likely exists or needs a small addition next to the existing shipping line in the summary component).
- Once the wallet reports an address (see §4.2), the shipping/tax lines and total update live, mirroring what the wallet's own payment sheet shows.

## 4. Backend / data flow

### 4.1 Initial estimate

On page load, the express buttons are initialized with the cart's current subtotal (and any already-applied coupon discount) as the payment amount — no shipping, no tax. This reuses existing cart/coupon read paths; no new endpoint.

### 4.2 Address-change recalculation

When the customer picks/confirms a shipping address inside the wallet sheet (Stripe Payment Request `shippingaddresschange` event; PayPal Buttons `onShippingAddressChange`), the frontend calls the **existing** `calculateTotals`-backed endpoint (already used by the regular form to compute shipping + tax) with the address the wallet provided, and pushes the recalculated shipping fee, tax, and total back into the wallet's own UI via that SDK's update API. No new backend logic — this is an existing capability driven by a new caller.

### 4.3 Completing the order

Once the customer approves payment inside the wallet, the frontend has: a final shipping address, and proof of payment —

- **Apple Pay / Google Pay (Stripe):** a confirmed Stripe PaymentMethod/PaymentIntent, obtained the same way the existing card flow already obtains one.
- **PayPal:** a PayPal order id the customer has approved (not yet captured).

The frontend then calls the **existing order-placement path** (`CheckoutService::placeOrder()`, reached today via `/checkout/place-order` with `payment_method: 'card'`) for the Stripe-wallet case, and the equivalent PayPal path for the PayPal case, passing the wallet-derived address and payment proof instead of form-entered values. Whether this reuses the current endpoints as-is or needs a small dedicated wrapper endpoint (e.g. because the PayPal Buttons SDK's `createOrder` callback needs a bare PayPal order id back, not the existing redirect flow's `approve_url` shape) is an implementation-planning decision, not a design-level one — the requirement is: **one gateway-appropriate call completes the order in an already-paid state**, with no pending/awaiting-payment order ever created for the express path.

### 4.4 Duplicate submission guard

The completion call must be idempotent: a double-click or a retried request for the same wallet payment proof must return the already-created order, not create a second one. This mirrors the existing idempotency guard on `capturePayPalOrder()` (`meta.payment_status === 'paid'` short-circuits a repeat capture).

## 5. Non-code requirements

- **Apple Pay domain verification (Stripe Dashboard, production account):** register `petposture.com` as an Apple Pay domain, and serve a static file Stripe provides at `/.well-known/apple-developer-merchantid-domain-association` on that exact domain. This cannot be done on `localhost`; Apple Pay will not appear at all until this is complete. Needs explicit confirmation from the user on who performs this Stripe Dashboard step.
- **Google Pay** needs no separate domain verification — it works once the Stripe account has Google Pay enabled (typically on by default).
- **Manual verification gap:** Apple Pay can only be exercised on real Apple hardware in Safari with a card in Wallet — this cannot be automated in CI or verified on the current Windows dev machine. Google Pay and PayPal are testable with Stripe/PayPal sandbox tooling in more environments.

## 6. Error handling

- A payment decline inside the wallet sheet is surfaced by the browser/wallet's own native UI; the customer can retry with a different card without leaving the sheet. No custom error UI needed for this case.
- If a wallet SDK fails to load (blocked script, network issue), its button is simply omitted, same as the "not available on this device" case (§3.1) — never a broken/disabled button.
- The order-completion call must fail closed with a clear, user-facing error and leave the customer able to fall back to the regular form below if anything on the backend goes wrong (no dead end).

## 7. Testing strategy

- Backend: unit/feature tests for the recalculation call with a wallet-supplied address, and for the order-completion path per gateway (Stripe wallet, PayPal), including the duplicate-submission guard. Existing `CheckoutApiTest`/`PayPalApiTest` patterns apply.
- Frontend: component tests for conditional rendering (all-available, none-available, one-unavailable cases) and for the address-change → total-update wiring, following this codebase's existing `CheckoutPage`-adjacent test conventions.
- Apple Pay itself: manual verification only, on real hardware, after domain verification is complete (§5) — out of scope for automated tests.

## 8. Explicitly out of scope for this feature

- Express checkout buttons on the cart page (Shopify shows these there too; user asked for the checkout page only).
- Shop Pay or any other wallet beyond the three requested.
- Changing the existing in-form "Pay with PayPal" redirect/popup flow, or the existing card flow.
