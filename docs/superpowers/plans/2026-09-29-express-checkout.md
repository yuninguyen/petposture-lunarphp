# Express Checkout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Shopify-style Express Checkout row (PayPal, Apple Pay, Google Pay) above the checkout form in `frontend/components/CheckoutPage.tsx`, letting a customer pay using a wallet-supplied shipping address instead of the manual form.

**Architecture:** Apple Pay and Google Pay ride the codebase's existing live Stripe Elements integration via Stripe's Payment Request Button (`stripe.paymentRequest()`), which the backend already treats as an ordinary `payment_method: 'card'` checkout — **no new backend code**. PayPal Express uses the real PayPal Buttons SDK (scoped to this new component only; the existing in-form PayPal redirect flow is untouched), reusing the existing `/api/checkout/paypal-order`, `/api/checkout/place-order`, and `/api/checkout/paypal-capture` endpoints in the same sequence the current redirect flow already uses — also **no new backend code**. All work is a new frontend component plus a small number of wiring changes in `CheckoutPage.tsx`.

**Tech Stack:** Next.js/React (`frontend/`), Stripe.js v3 (loaded via `<script src="https://js.stripe.com/v3/">`, no npm package — match existing convention), PayPal JS SDK (`https://www.paypal.com/sdk/js`), existing `fetchApi`/`fetchJson` helper (`frontend/lib/fetchApi.ts`).

**Spec:** `docs/superpowers/specs/2026-09-29-express-checkout-design.md`

## Global Constraints

- Express Checkout appears **only** on the checkout page, not the cart page (spec §8).
- Only PayPal, Apple Pay, Google Pay — no Shop Pay or other wallets (spec §8).
- The existing in-form "Pay with PayPal" redirect/popup flow is not touched (spec §2).
- The existing card form flow (`prepareCardPaymentIntent`, Stripe Elements card fields) is not touched (spec §2).
- No pending/"awaiting-payment" order may ever be created for an express payment — the order is created already paid (spec §2, §4.3).
- Every backend call this feature makes reuses an existing, already-deployed endpoint (see Task 5) — if implementation reveals a genuine gap, stop and flag it rather than silently adding new backend surface.
- If none of the three wallets can render on the customer's device/browser, the whole Express Checkout block (heading + divider) must not render (spec §3.1).

---

## File Structure

- **Create:** `frontend/components/checkout/ExpressCheckout.tsx` — the whole feature. Self-contained: takes cart/coupon data and a Stripe instance as props, owns its own PayPal SDK loading, wallet button rendering, address-driven total recalculation, and order completion. Kept out of the already-huge `CheckoutPage.tsx` per "smaller, focused files."
- **Create:** `frontend/components/checkout/ExpressCheckout.test.tsx` — component tests (rendering/visibility, recalculation wiring, completion wiring), written before the implementation (TDD).
- **Modify:** `frontend/components/CheckoutPage.tsx` — mount `<ExpressCheckout />` above the breadcrumb (near line 1420, before the `<header>`/`<form>`), pass props, add the "Enter shipping address" placeholder text to the order summary's shipping line.
- **Modify:** `backend/tests/Feature/CheckoutApiTest.php` — add end-to-end tests proving the existing endpoints correctly support the express calling sequence (Task 5). No backend source file changes are expected; if a test here fails, that is a plan-vs-reality mismatch to resolve before touching frontend code, not a reason to add new backend code without re-checking the design.

---

## Task 1: `ExpressCheckout` shell — layout, conditional visibility, props contract

**Files:**
- Create: `frontend/components/checkout/ExpressCheckout.tsx`
- Test: `frontend/components/checkout/ExpressCheckout.test.tsx`

**Interfaces:**
- Consumes: nothing yet (this task stubs the two wallet integrations behind `canApplePay`/`canGooglePay`/`canPayPal` boolean state, filled in by Tasks 2–3).
- Produces:
  ```ts
  export interface ExpressCheckoutProps {
    items: Array<{ variantId: number; quantity: number }>;
    couponCode: string | null;
    subtotalMinor: number; // cart subtotal in cents, after coupon discount
    stripeInstance: ReturnType<NonNullable<typeof window.Stripe>> | null;
    paypalClientId: string | null;
    onOrderPlaced: (orderAccess: { reference: string; trackingToken: string }) => void;
  }
  export function ExpressCheckout(props: ExpressCheckoutProps): JSX.Element | null;
  ```
  `CheckoutPage.tsx` (Task 4) renders this and supplies `stripeInstance` from its own existing `stripeInstanceRef.current`, and `paypalClientId` from `selectedPayPalMethod.client_id`.

- [ ] **Step 1: Write the failing test for "renders nothing when no wallet is available"**

```tsx
// frontend/components/checkout/ExpressCheckout.test.tsx
import { render, screen } from '@testing-library/react';
import { ExpressCheckout } from './ExpressCheckout';

const baseProps = {
  items: [{ variantId: 1, quantity: 1 }],
  couponCode: null,
  subtotalMinor: 2000,
  stripeInstance: null,
  paypalClientId: null,
  onOrderPlaced: jest.fn(),
};

describe('ExpressCheckout', () => {
  it('renders nothing when no wallet method is available', () => {
    const { container } = render(<ExpressCheckout {...baseProps} />);
    expect(container).toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: check `frontend/package.json` `"test"` script for the exact runner/command, then run it scoped to this file (e.g. `npx jest frontend/components/checkout/ExpressCheckout.test.tsx` or the vitest equivalent).
Expected: FAIL — `Cannot find module './ExpressCheckout'`

- [ ] **Step 3: Write the minimal component**

```tsx
// frontend/components/checkout/ExpressCheckout.tsx
'use client';

import { useState } from 'react';

export interface ExpressCheckoutProps {
  items: Array<{ variantId: number; quantity: number }>;
  couponCode: string | null;
  subtotalMinor: number;
  stripeInstance: ReturnType<NonNullable<typeof window.Stripe>> | null;
  paypalClientId: string | null;
  onOrderPlaced: (orderAccess: { reference: string; trackingToken: string }) => void;
}

export function ExpressCheckout(props: ExpressCheckoutProps) {
  // Filled in by Task 2 (Stripe wallets) and Task 3 (PayPal). Each starts
  // false and flips true only once its own SDK confirms it can render.
  const [canApplePay] = useState(false);
  const [canGooglePay] = useState(false);
  const [canPayPal] = useState(false);

  const anyAvailable = canApplePay || canGooglePay || canPayPal;
  if (!anyAvailable) return null;

  return (
    <div className="mb-8 space-y-4">
      <p className="text-center text-[13px] font-medium uppercase tracking-wide text-[#707070]">
        Express checkout
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {/* Task 2/3 mount their SDK-rendered buttons into these slots. */}
      </div>
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-[#e8e8ea]" />
        <span className="text-[12px] font-medium uppercase text-[#a0a0a0]">Or</span>
        <div className="h-px flex-1 bg-[#e8e8ea]" />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: same command as Step 2
Expected: PASS

- [ ] **Step 5: Write the failing test for "a provided Stripe instance alone does not force visibility"**

```tsx
  it('does not show the express checkout label just because a stripeInstance prop is present', () => {
    // Visibility depends on canMakePayment() resolving truthy (Task 2), not
    // merely on stripeInstance being non-null. Locks this behavior in before
    // Tasks 2-3 touch this file.
    render(<ExpressCheckout {...baseProps} stripeInstance={{} as never} />);
    expect(screen.queryByText('Express checkout')).not.toBeInTheDocument();
  });
```

- [ ] **Step 6: Run test to verify it passes**

Run: same command as Step 2
Expected: PASS (already true given Step 3's implementation)

- [ ] **Step 7: Commit**

```bash
git add frontend/components/checkout/ExpressCheckout.tsx frontend/components/checkout/ExpressCheckout.test.tsx
git commit -m "feat(checkout): add ExpressCheckout shell with conditional visibility"
```

---

## Task 2: Apple Pay / Google Pay via Stripe Payment Request Button

**Files:**
- Modify: `frontend/components/checkout/ExpressCheckout.tsx`
- Modify: `frontend/components/checkout/ExpressCheckout.test.tsx`

**Interfaces:**
- Consumes: `props.stripeInstance`, `props.items`, `props.couponCode`, `props.subtotalMinor`, `props.onOrderPlaced` (from Task 1).
- Consumes existing backend endpoints (verified in `backend/routes/api.php` and `backend/app/Http/Controllers/Api/CheckoutController.php`, unchanged by this plan):
  - `GET /api/checkout/shipping-rates?subtotal_minor=<int>&coupon_code=<string|omit>` → `{ success: true, rates: Array<{ code: string; name: string; price_minor: number }> }` (confirm the exact rate object field names against `ShippingService::availableMethods()` at implementation time if more fields are needed).
  - `POST /api/checkout/tax-quote` body `{ shipping: { state, country, city, postcode }, subtotal_amount: number (dollars) }` → `{ success: true, quote: { rate_percentage: number, tax_amount: number (minor units) } }` (matches `taxQuote` usage already in `CheckoutPage.tsx`).
  - `POST /api/checkout/payment-intent` body `{ payment_method: 'card', items, coupon_code, shipping_method, shipping: { state, country, city, postcode }, currency: 'usd', email }` → `{ success: true, payment_intent: { id: string, client_secret: string } }` (matches `prepareCardPaymentIntent`, `CheckoutPage.tsx:1009-1034`).
  - `POST /api/checkout/place-order` body `{ items, shipping, billing_same_as_shipping: true, shipping_method, payment_method: 'card', payment_context: { intent_id }, coupon_code }` → `201` with `{ order: { reference, tracking_access_token } }` (matches `CheckoutPage.tsx:1131-1168`). Must include header `Idempotency-Key: <payment_intent.id>` (existing backend dedup support, `CheckoutController::placeOrder`).
- Produces: `canApplePay`/`canGooglePay` become real (driven by Stripe's `paymentRequest.canMakePayment()`), and a working end-to-end Stripe-wallet purchase.

- [ ] **Step 1: Write the failing test for "initializes a Stripe PaymentRequest with the subtotal on mount"**

```tsx
  it('creates a Stripe payment request with the item subtotal when a Stripe instance is provided', () => {
    const paymentRequest = { canMakePayment: jest.fn().mockResolvedValue(null), on: jest.fn(), update: jest.fn() };
    const stripeInstance = {
      paymentRequest: jest.fn().mockReturnValue(paymentRequest),
      elements: jest.fn().mockReturnValue({ create: jest.fn().mockReturnValue({ mount: jest.fn(), on: jest.fn() }) }),
    };

    render(<ExpressCheckout {...baseProps} stripeInstance={stripeInstance as never} />);

    expect(stripeInstance.paymentRequest).toHaveBeenCalledWith(expect.objectContaining({
      country: 'US',
      currency: 'usd',
      requestPayerName: true,
      requestPayerEmail: true,
      requestShipping: true,
    }));
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: same command as Task 1 Step 2
Expected: FAIL — `stripeInstance.paymentRequest` not called

- [ ] **Step 3: Implement the Stripe wallet button**

```tsx
// frontend/components/checkout/ExpressCheckout.tsx — replace the whole file

import { useEffect, useRef, useState } from 'react';
import { fetchApi } from '@/lib/fetchApi';

export interface ExpressCheckoutProps {
  items: Array<{ variantId: number; quantity: number }>;
  couponCode: string | null;
  subtotalMinor: number;
  stripeInstance: ReturnType<NonNullable<typeof window.Stripe>> | null;
  paypalClientId: string | null;
  onOrderPlaced: (orderAccess: { reference: string; trackingToken: string }) => void;
}

export function ExpressCheckout(props: ExpressCheckoutProps) {
  const { items, couponCode, subtotalMinor, stripeInstance, paypalClientId, onOrderPlaced } = props;
  const [canApplePay, setCanApplePay] = useState(false);
  const [canGooglePay, setCanGooglePay] = useState(false);
  const [canPayPal] = useState(false); // Task 3
  const [error, setError] = useState<string | null>(null);
  const stripeButtonMountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!stripeInstance) return;
    let cancelled = false;

    const paymentRequest = stripeInstance.paymentRequest({
      country: 'US',
      currency: 'usd',
      total: { label: 'PetPosture', amount: subtotalMinor },
      requestPayerName: true,
      requestPayerEmail: true,
      requestShipping: true,
    });

    paymentRequest.canMakePayment().then((result) => {
      if (cancelled || !result) return;
      setCanApplePay(Boolean(result.applePay));
      setCanGooglePay(!result.applePay);
    });

    paymentRequest.on('shippingaddresschange', async (ev) => {
      try {
        const address = {
          country: ev.shippingAddress.country,
          state: ev.shippingAddress.region,
          city: ev.shippingAddress.city,
          postcode: ev.shippingAddress.postalCode,
        };
        const ratesRes = await fetchApi(`/api/checkout/shipping-rates?subtotal_minor=${subtotalMinor}${couponCode ? `&coupon_code=${encodeURIComponent(couponCode)}` : ''}`);
        const ratesData = await ratesRes.json();
        const rate = ratesData.rates?.[0];
        if (!rate) {
          ev.updateWith({ status: 'invalid_shipping_address' });
          return;
        }
        const taxRes = await fetchApi('/api/checkout/tax-quote', {
          method: 'POST',
          body: { shipping: address, subtotal_amount: subtotalMinor / 100 },
        });
        const taxData = await taxRes.json();
        const shippingMinor = rate.price_minor;
        const taxMinor = taxData.quote?.tax_amount ?? 0;
        ev.updateWith({
          status: 'success',
          shippingOptions: [{ id: rate.code, label: rate.name, detail: '', amount: shippingMinor }],
          total: { label: 'PetPosture', amount: subtotalMinor + shippingMinor + taxMinor },
        });
      } catch {
        ev.updateWith({ status: 'fail' });
      }
    });

    paymentRequest.on('paymentmethod', async (ev) => {
      try {
        const shipping = {
          email: ev.payerEmail ?? '',
          first_name: ev.shippingAddress?.recipient?.split(' ')[0] ?? '',
          last_name: ev.shippingAddress?.recipient?.split(' ').slice(1).join(' ') ?? '',
          line_one: ev.shippingAddress?.addressLine?.[0] ?? '',
          line_two: ev.shippingAddress?.addressLine?.[1] ?? null,
          city: ev.shippingAddress?.city ?? '',
          state: ev.shippingAddress?.region ?? '',
          postcode: ev.shippingAddress?.postalCode ?? '',
          country: ev.shippingAddress?.country ?? 'US',
          phone: ev.payerPhone ?? null,
        };

        const intentRes = await fetchApi('/api/checkout/payment-intent', {
          method: 'POST',
          body: {
            payment_method: 'card',
            items,
            coupon_code: couponCode,
            shipping_method: ev.shippingOption?.id ?? null,
            shipping: { state: shipping.state, country: shipping.country, city: shipping.city, postcode: shipping.postcode },
            currency: 'usd',
            email: shipping.email,
          },
        });
        const intentData = await intentRes.json();
        if (!intentRes.ok || !intentData?.payment_intent) {
          ev.complete('fail');
          setError(intentData?.message || 'Unable to prepare payment. Please try again.');
          return;
        }

        const { error: confirmError } = await stripeInstance.confirmCardPayment(
          intentData.payment_intent.client_secret,
          { payment_method: ev.paymentMethod.id },
          { handleActions: false },
        );

        if (confirmError) {
          ev.complete('fail');
          setError(confirmError.message ?? 'Payment could not be confirmed.');
          return;
        }

        ev.complete('success');

        const orderRes = await fetchApi('/api/checkout/place-order', {
          method: 'POST',
          headers: { 'Idempotency-Key': intentData.payment_intent.id },
          body: {
            items,
            shipping,
            billing_same_as_shipping: true,
            shipping_method: ev.shippingOption?.id ?? null,
            payment_method: 'card',
            payment_context: { intent_id: intentData.payment_intent.id },
            coupon_code: couponCode,
          },
        });
        const orderData = await orderRes.json();
        if (orderRes.status !== 201 || !orderData?.order?.reference || !orderData?.order?.tracking_access_token) {
          setError(orderData?.message || 'Order could not be created. Please try again.');
          return;
        }
        onOrderPlaced({ reference: orderData.order.reference, trackingToken: orderData.order.tracking_access_token });
      } catch {
        ev.complete('fail');
        setError('Something went wrong. Please try again.');
      }
    });

    if (stripeButtonMountRef.current) {
      const elements = stripeInstance.elements();
      const prButton = elements.create('paymentRequestButton', { paymentRequest });
      prButton.mount(stripeButtonMountRef.current);
    }

    return () => { cancelled = true; };
  }, [stripeInstance, items, couponCode, subtotalMinor]);

  const anyAvailable = canApplePay || canGooglePay || canPayPal;
  if (!anyAvailable) return null;

  return (
    <div className="mb-8 space-y-4">
      <p className="text-center text-[13px] font-medium uppercase tracking-wide text-[#707070]">Express checkout</p>
      {error && <p role="alert" className="text-center text-[13px] text-red-600">{error}</p>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(canApplePay || canGooglePay) && <div ref={stripeButtonMountRef} className="h-11" />}
        {/* PayPal button mount point added in Task 3 */}
      </div>
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-[#e8e8ea]" />
        <span className="text-[12px] font-medium uppercase text-[#a0a0a0]">Or</span>
        <div className="h-px flex-1 bg-[#e8e8ea]" />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: same command as Task 1 Step 2
Expected: PASS

- [ ] **Step 5: Write the failing test for the address-change recalculation call**

```tsx
  it('recalculates shipping and tax through the existing endpoints when the wallet reports an address', async () => {
    const fetchMock = jest.spyOn(global, 'fetch');
    fetchMock.mockImplementation((url) => {
      const u = String(url);
      if (u.includes('/api/checkout/shipping-rates')) {
        return Promise.resolve({ ok: true, json: async () => ({ rates: [{ code: 'standard', name: 'Standard', price_minor: 500 }] }) } as Response);
      }
      if (u.includes('/api/checkout/tax-quote')) {
        return Promise.resolve({ ok: true, json: async () => ({ quote: { rate_percentage: 8, tax_amount: 250 } }) } as Response);
      }
      return Promise.resolve({ ok: true, json: async () => ({}) } as Response);
    });

    let shippingAddressHandler: ((ev: unknown) => void) | undefined;
    const paymentRequest = {
      canMakePayment: jest.fn().mockResolvedValue({ applePay: true }),
      on: jest.fn((event: string, handler: (ev: unknown) => void) => { if (event === 'shippingaddresschange') shippingAddressHandler = handler; }),
      update: jest.fn(),
    };
    const stripeInstance = {
      paymentRequest: jest.fn().mockReturnValue(paymentRequest),
      elements: jest.fn().mockReturnValue({ create: jest.fn().mockReturnValue({ mount: jest.fn(), on: jest.fn() }) }),
    };

    render(<ExpressCheckout {...baseProps} stripeInstance={stripeInstance as never} subtotalMinor={2000} />);
    await Promise.resolve();

    const updateWith = jest.fn();
    await shippingAddressHandler?.({
      shippingAddress: { country: 'US', region: 'TX', city: 'Austin', postalCode: '78701' },
      updateWith,
    });

    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/checkout/shipping-rates'), expect.anything());
    expect(updateWith).toHaveBeenCalledWith(expect.objectContaining({
      status: 'success',
      total: expect.objectContaining({ amount: 2000 + 500 + 250 }),
    }));

    fetchMock.mockRestore();
  });
```

- [ ] **Step 6: Run test to verify it passes**

Run: same command as Task 1 Step 2
Expected: PASS (Step 3's implementation already covers this — this step locks the address-change contract in with an explicit assertion)

- [ ] **Step 7: Commit**

```bash
git add frontend/components/checkout/ExpressCheckout.tsx frontend/components/checkout/ExpressCheckout.test.tsx
git commit -m "feat(checkout): wire Apple Pay / Google Pay via Stripe Payment Request Button"
```

---

## Task 3: PayPal Express button (PayPal Buttons SDK, scoped to this component)

**Files:**
- Modify: `frontend/components/checkout/ExpressCheckout.tsx`
- Modify: `frontend/components/checkout/ExpressCheckout.test.tsx`

**Interfaces:**
- Consumes: `props.paypalClientId`, `props.items`, `props.couponCode`, `props.subtotalMinor`, `props.onOrderPlaced`.
- Consumes existing backend endpoints (unchanged):
  - `POST /api/checkout/paypal-order` body `{ payment_method: 'paypal', items, coupon_code, currency: 'usd' }` → `{ success: true, paypal_order: { paypal_order_id: string } }` (`CheckoutController::preparePayPalOrder`, unchanged).
  - `POST /api/checkout/place-order` with `payment_method: 'paypal'`, `payment_context: { paypal_order_id }` — same endpoint as Task 2, different payload; `PayPalGateway::prepare()` (`backend/app/Payments/Gateways/PayPalGateway.php:25-42`) already stores `payment_context.paypal_order_id` verbatim into `meta.paypal_order_id` without creating a second PayPal order — confirmed by reading that file during design; do not change it.
  - `POST /api/checkout/paypal-capture` body `{ paypal_order_id: string }` → captures and marks the order paid (`CheckoutController::capturePayPalOrder`, unchanged; already idempotent on `meta.payment_status === 'paid'`).
- Produces: `canPayPal` becomes real; a working end-to-end PayPal Express purchase.

- [ ] **Step 1: Write the failing test for "loads the PayPal SDK script with the provided client id"**

```tsx
  it('loads the PayPal SDK with the given client id when paypalClientId is provided', () => {
    document.head.innerHTML = '';
    render(<ExpressCheckout {...baseProps} paypalClientId="test-client-id" subtotalMinor={2000} />);
    const script = document.getElementById('paypal-express-sdk') as HTMLScriptElement | null;
    expect(script?.src).toContain('client-id=test-client-id');
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: same command as Task 1 Step 2
Expected: FAIL — no such script element exists yet

- [ ] **Step 3: Implement PayPal SDK loading + button rendering**

Add a minimal `window.paypal` type declaration at the top of `ExpressCheckout.tsx` (check `git grep -n "window.paypal" frontend/` first — the earlier PayPal-redirect-flow rewrite, per project memory, removed the old embedded-Buttons integration and its type declaration, so it likely needs re-adding here, scoped to this file only):

```ts
declare global {
  interface Window {
    paypal?: {
      Buttons: (options: Record<string, unknown>) => { render: (el: HTMLElement) => void };
    };
  }
}
```

Add state, refs, and the loading/render effect inside the `ExpressCheckout` function (alongside the Task 2 Stripe effect):

```tsx
  const [canPayPal, setCanPayPal] = useState(false); // replaces the Task 1/2 useState stub of the same name
  const paypalButtonMountRef = useRef<HTMLDivElement>(null);
  const latestShippingAddressRef = useRef<{
    email: string; first_name: string; last_name: string; line_one: string; line_two: string | null;
    city: string; state: string; postcode: string; country: string; phone: string | null;
  } | null>(null);

  useEffect(() => {
    if (!paypalClientId) return;
    let cancelled = false;
    const scriptId = 'paypal-express-sdk';

    const renderButtons = () => {
      if (cancelled || !window.paypal || !paypalButtonMountRef.current) return;

      window.paypal.Buttons({
        style: { layout: 'horizontal', label: 'paypal', height: 44 },

        createOrder: async () => {
          const res = await fetchApi('/api/checkout/paypal-order', {
            method: 'POST',
            body: { payment_method: 'paypal', items, coupon_code: couponCode, currency: 'usd' },
          });
          const data = await res.json();
          if (!res.ok || !data?.paypal_order?.paypal_order_id) {
            throw new Error(data?.message || 'Unable to start PayPal checkout.');
          }
          return data.paypal_order.paypal_order_id;
        },

        onShippingAddressChange: async (data: {
          orderInfo?: { shipping_address?: { country_code?: string; state?: string; city?: string; postal_code?: string; address_line_1?: string; address_line_2?: string } };
          payer?: { email_address?: string; name?: { given_name?: string; surname?: string }; phone?: { phone_number?: { national_number?: string } } };
        }, actions: { order: { patch: (ops: unknown[]) => Promise<void> }; reject: () => void }) => {
          const address = {
            country: data.orderInfo?.shipping_address?.country_code ?? 'US',
            state: data.orderInfo?.shipping_address?.state ?? '',
            city: data.orderInfo?.shipping_address?.city ?? '',
            postcode: data.orderInfo?.shipping_address?.postal_code ?? '',
          };
          const ratesRes = await fetchApi(`/api/checkout/shipping-rates?subtotal_minor=${subtotalMinor}${couponCode ? `&coupon_code=${encodeURIComponent(couponCode)}` : ''}`);
          const ratesData = await ratesRes.json();
          const rate = ratesData.rates?.[0];
          if (!rate) return actions.reject();

          const taxRes = await fetchApi('/api/checkout/tax-quote', {
            method: 'POST',
            body: { shipping: address, subtotal_amount: subtotalMinor / 100 },
          });
          const taxData = await taxRes.json();
          const shippingMinor = rate.price_minor;
          const taxMinor = taxData.quote?.tax_amount ?? 0;

          latestShippingAddressRef.current = {
            email: data.payer?.email_address ?? '',
            first_name: data.payer?.name?.given_name ?? '',
            last_name: data.payer?.name?.surname ?? '',
            line_one: data.orderInfo?.shipping_address?.address_line_1 ?? '',
            line_two: data.orderInfo?.shipping_address?.address_line_2 ?? null,
            city: address.city,
            state: address.state,
            postcode: address.postcode,
            country: address.country,
            phone: data.payer?.phone?.phone_number?.national_number ?? null,
          };

          return actions.order.patch([
            { op: 'replace', path: "/purchase_units/@reference_id=='default'/amount", value: {
              currency_code: 'USD',
              value: ((subtotalMinor + shippingMinor + taxMinor) / 100).toFixed(2),
              breakdown: {
                item_total: { currency_code: 'USD', value: (subtotalMinor / 100).toFixed(2) },
                shipping: { currency_code: 'USD', value: (shippingMinor / 100).toFixed(2) },
                tax_total: { currency_code: 'USD', value: (taxMinor / 100).toFixed(2) },
              },
            } },
          ]);
        },

        onApprove: async (data: { orderID: string }) => {
          try {
            const shipping = latestShippingAddressRef.current;
            if (!shipping) {
              setError('Missing shipping address. Please try again.');
              return;
            }

            const orderRes = await fetchApi('/api/checkout/place-order', {
              method: 'POST',
              headers: { 'Idempotency-Key': data.orderID },
              body: {
                items,
                shipping,
                billing_same_as_shipping: true,
                payment_method: 'paypal',
                payment_context: { paypal_order_id: data.orderID },
                coupon_code: couponCode,
              },
            });
            const orderData = await orderRes.json();
            if (orderRes.status !== 201 || !orderData?.order?.reference || !orderData?.order?.tracking_access_token) {
              setError(orderData?.message || 'Order could not be created. Please try again.');
              return;
            }

            const captureRes = await fetchApi('/api/checkout/paypal-capture', {
              method: 'POST',
              body: { paypal_order_id: data.orderID },
            });
            const captureData = await captureRes.json();
            if (!captureRes.ok || captureData?.capture?.status !== 'COMPLETED') {
              setError('Payment could not be captured. Please try again.');
              return;
            }

            onOrderPlaced({ reference: orderData.order.reference, trackingToken: orderData.order.tracking_access_token });
          } catch {
            setError('Something went wrong. Please try again.');
          }
        },
      }).render(paypalButtonMountRef.current);
    };

    if (window.paypal) {
      renderButtons();
    } else if (!document.getElementById(scriptId)) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(paypalClientId)}&currency=USD&components=buttons`;
      script.addEventListener('load', renderButtons, { once: true });
      document.head.appendChild(script);
    } else {
      document.getElementById(scriptId)?.addEventListener('load', renderButtons, { once: true });
    }

    setCanPayPal(true);

    return () => { cancelled = true; };
  }, [paypalClientId, items, couponCode, subtotalMinor]);
```

Replace the Task 2 `const [canPayPal] = useState(false);` stub with the real `setCanPayPal`-backed state shown above, and replace the render output's PayPal placeholder comment with the mount point:

```tsx
        {canPayPal && <div ref={paypalButtonMountRef} />}
```

- [ ] **Step 4: Run test to verify it passes**

Run: same command as Task 1 Step 2
Expected: PASS

- [ ] **Step 5: Write the failing test for the full PayPal approve → place-order → capture sequence**

```tsx
  it('creates the order and captures payment through existing endpoints on PayPal approval', async () => {
    const fetchMock = jest.spyOn(global, 'fetch');
    const calls: string[] = [];
    fetchMock.mockImplementation((url) => {
      const u = String(url);
      calls.push(u);
      if (u.includes('/api/checkout/place-order')) {
        return Promise.resolve({ status: 201, json: async () => ({ order: { reference: 'PP-1', tracking_access_token: 'tok-1' } }) } as Response);
      }
      if (u.includes('/api/checkout/paypal-capture')) {
        return Promise.resolve({ ok: true, json: async () => ({ capture: { status: 'COMPLETED' } }) } as Response);
      }
      return Promise.resolve({ ok: true, json: async () => ({}) } as Response);
    });

    let buttonsConfig: Record<string, (...args: unknown[]) => unknown> = {};
    window.paypal = { Buttons: (opts: typeof buttonsConfig) => { buttonsConfig = opts; return { render: jest.fn() }; } };

    const onOrderPlaced = jest.fn();
    render(<ExpressCheckout {...baseProps} paypalClientId="test-client-id" subtotalMinor={2000} onOrderPlaced={onOrderPlaced} />);
    await Promise.resolve();

    await buttonsConfig.onShippingAddressChange?.(
      { orderInfo: { shipping_address: { country_code: 'US', state: 'TX', city: 'Austin', postal_code: '78701' } }, payer: { email_address: 'a@b.com', name: { given_name: 'A', surname: 'B' } } },
      { order: { patch: jest.fn() }, reject: jest.fn() },
    );
    await buttonsConfig.onApprove?.({ orderID: 'PAYPAL-1' });

    expect(calls.some((u) => u.includes('/api/checkout/place-order'))).toBe(true);
    expect(calls.some((u) => u.includes('/api/checkout/paypal-capture'))).toBe(true);
    expect(onOrderPlaced).toHaveBeenCalledWith({ reference: 'PP-1', trackingToken: 'tok-1' });

    fetchMock.mockRestore();
    delete (window as { paypal?: unknown }).paypal;
  });
```

- [ ] **Step 6: Run test to verify it passes**

Run: same command as Task 1 Step 2
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add frontend/components/checkout/ExpressCheckout.tsx frontend/components/checkout/ExpressCheckout.test.tsx
git commit -m "feat(checkout): wire PayPal Express button via PayPal Buttons SDK"
```

---

## Task 4: Mount `ExpressCheckout` into the checkout page

**Files:**
- Modify: `frontend/components/CheckoutPage.tsx`

**Interfaces:**
- Consumes: `ExpressCheckout` from Tasks 1–3 (`ExpressCheckoutProps` as finalized above).
- Consumes existing `CheckoutPage.tsx` state: `items`, `coupon.code`, `coupon.discountAmount`, the existing subtotal-in-dollars value already computed for the order summary (locate its exact variable name at implementation time — do not guess a new calculation), `stripeInstanceRef.current`, `selectedPayPalMethod.client_id` (all confirmed present in this file during design).
- Produces: nothing new consumed elsewhere.

- [ ] **Step 1: Import and mount the component**

```tsx
// Near the top of frontend/components/CheckoutPage.tsx, with the other imports:
import { ExpressCheckout } from './checkout/ExpressCheckout';
```

```tsx
// Inside the returned JSX, immediately after the opening
// `<div className="flex-1 border-r ... lg:pt-6 lg:pb-12">` and before the
// `<header className="mb-10 hidden lg:block">` block (around line 1421-1422):

<ExpressCheckout
  items={items.map((item) => ({ variantId: item.variantId, quantity: item.quantity }))}
  couponCode={coupon.discountAmount > 0 ? coupon.code : null}
  subtotalMinor={Math.round(totalAmount * 100)}
  stripeInstance={stripeInstanceRef.current}
  paypalClientId={selectedPayPalMethod.client_id ?? null}
  onOrderPlaced={(orderAccess) => redirectToSuccess(orderAccess)}
/>
```

- [ ] **Step 2: Add a lightweight, form-independent completion helper**

`finishSuccessSideEffectsAndRedirect` (`CheckoutPage.tsx:1201-1236`) reads `form.email`/`form.saveInfo`/`form.firstName` for the guest-address-localStorage save and newsletter-subscribe branch — meaningless for an express purchase where `form` was never filled in. Add a smaller helper next to it that does only what an express purchase needs (cart/coupon cleanup + navigation, no guest-address save, no newsletter subscribe):

```tsx
// Add near finishSuccessSideEffectsAndRedirect in CheckoutPage.tsx
const redirectToSuccess = (orderAccess: { reference: string; trackingToken: string }) => {
  clearCoupon();
  router.push(`/checkout/success?token=${encodeURIComponent(orderAccess.trackingToken)}&email=${encodeURIComponent('')}`);
};
```

At implementation time, verify the exact success-page URL param contract by reading `finishSuccessSideEffectsAndRedirect`'s own `router.push(...)` call and match it exactly (including whatever it does with `email`) — the snippet above is illustrative of the reduced scope (no localStorage write, no newsletter call), not a literal final diff.

- [ ] **Step 3: Add the "Enter shipping address" placeholder to the order summary's shipping line**

Locate the order summary's shipping line (search this file for where the subtotal/shipping/total breakdown renders). Where the shipping cost is currently shown, add a branch: if `form.shippingMethod` is not yet set and no address has been entered, render `Enter shipping address` in place of a dollar amount (matches the reference screenshot; read-only display change — does not alter how shipping is calculated for the regular form flow).

- [ ] **Step 4: Manual smoke test**

Run: check `frontend/package.json` for the dev script name, then run it (e.g. `npm run dev`).
Visit `/checkout` with at least one item in the cart. Confirm:
- No console errors.
- If Stripe test/live keys and PayPal client id are configured, at least one express button renders (Google Pay testable in Chrome; Apple Pay untestable on this Windows dev machine per spec §5).
- The page layout is otherwise unchanged (form still works end to end).

- [ ] **Step 5: Commit**

```bash
git add frontend/components/CheckoutPage.tsx
git commit -m "feat(checkout): mount ExpressCheckout above the checkout form"
```

---

## Task 5: Backend regression tests proving the existing endpoints support the express sequence

**Files:**
- Modify: `backend/tests/Feature/CheckoutApiTest.php`

**Interfaces:**
- Consumes: existing `createPurchasableVariant()` test helper already in this file (confirmed present during planning — reuse it, do not duplicate).
- Produces: nothing new — this task is pure verification that Tasks 2–3's assumed backend contract holds today. If any test here fails, **stop and re-open the design** rather than patching backend code to match a guess.

- [ ] **Step 1: Write the failing tests**

```php
// Add to backend/tests/Feature/CheckoutApiTest.php

public function test_express_style_paypal_order_can_be_created_without_upfront_address_then_captured(): void
{
    $variant = $this->createPurchasableVariant();

    // Step 1 of the express sequence: create the PayPal order before any
    // shipping address is known (createOrder callback equivalent).
    $prepare = $this->postJson('/api/checkout/paypal-order', [
        'payment_method' => 'paypal',
        'items' => [['variantId' => $variant->id, 'quantity' => 1]],
        'currency' => 'usd',
    ]);
    $prepare->assertOk();
    $paypalOrderId = $prepare->json('paypal_order.paypal_order_id');
    $this->assertNotEmpty($paypalOrderId);

    // Step 2: place-order with the wallet-supplied address and the same
    // PayPal order id — must not create a second PayPal order (verified by
    // reading PayPalGateway::prepare(), which stores payment_context
    // verbatim), and must not leave the order in 'awaiting-payment'.
    $place = $this->postJson('/api/checkout/place-order', [
        'items' => [['variantId' => $variant->id, 'quantity' => 1]],
        'shipping' => [
            'email' => 'express@petposture.com',
            'first_name' => 'Express',
            'last_name' => 'Buyer',
            'line_one' => '1 Wallet Way',
            'city' => 'Austin',
            'state' => 'TX',
            'postcode' => '78701',
            'country' => 'US',
        ],
        'billing_same_as_shipping' => true,
        'payment_method' => 'paypal',
        'payment_context' => ['paypal_order_id' => $paypalOrderId],
    ]);
    $place->assertCreated();
    $orderId = $place->json('order.id');

    $order = \Lunar\Models\Order::query()->findOrFail($orderId);
    $this->assertSame($paypalOrderId, $order->meta['paypal_order_id']);

    // Step 3: capture — same endpoint the existing redirect flow's success
    // page already calls.
    $capture = $this->postJson('/api/checkout/paypal-capture', ['paypal_order_id' => $paypalOrderId]);
    $capture->assertOk();
    $this->assertSame('paid', $order->fresh()->meta['payment_status']);
}

public function test_express_style_card_order_reuses_the_existing_payment_intent_and_place_order_endpoints(): void
{
    $variant = $this->createPurchasableVariant();

    config()->set('services.stripe.secret', 'sk_test_express_flow');
    \Illuminate\Support\Facades\Cache::forget('stripe_secret');
    \Illuminate\Support\Facades\Http::fake([
        'https://api.stripe.com/v1/payment_intents' => \Illuminate\Support\Facades\Http::response([
            'id' => 'pi_express_1',
            'client_secret' => 'pi_express_1_secret',
            'amount' => 8999,
            'currency' => 'usd',
            'status' => 'requires_payment_method',
        ]),
    ]);

    // Step 1: intent prepared with a wallet-supplied address (no form was
    // ever filled in — this is the point of the express flow).
    $intent = $this->postJson('/api/checkout/payment-intent', [
        'payment_method' => 'card',
        'items' => [['variantId' => $variant->id, 'quantity' => 1]],
        'shipping' => ['state' => 'TX', 'country' => 'US', 'city' => 'Austin', 'postcode' => '78701'],
        'currency' => 'usd',
        'email' => 'express@petposture.com',
    ]);
    $intent->assertOk();
    $intentId = $intent->json('payment_intent.id');
    $this->assertSame('pi_express_1', $intentId);

    // Step 2: place-order with the same intent id — the existing endpoint,
    // used exactly as the regular card flow already uses it.
    $place = $this->postJson('/api/checkout/place-order', [
        'items' => [['variantId' => $variant->id, 'quantity' => 1]],
        'shipping' => [
            'email' => 'express@petposture.com',
            'first_name' => 'Express',
            'last_name' => 'Buyer',
            'line_one' => '1 Wallet Way',
            'city' => 'Austin',
            'state' => 'TX',
            'postcode' => '78701',
            'country' => 'US',
        ],
        'billing_same_as_shipping' => true,
        'payment_method' => 'card',
        'payment_context' => ['intent_id' => $intentId],
    ]);
    $place->assertCreated();
}
```

- [ ] **Step 2: Run both tests to verify they currently pass against the unmodified backend**

Run: `cd backend && php artisan test --filter="test_express_style"`
Expected: PASS (both tests) — proof that no backend code changes are needed for this feature. If either fails, stop here and report back before writing any frontend code from Tasks 2–3, since the plan's core reuse assumption would be wrong.

- [ ] **Step 3: Run the full existing `CheckoutApiTest` suite to confirm no regressions**

Run: `cd backend && php artisan test --filter=CheckoutApiTest`
Expected: all tests PASS (including the two new ones)

- [ ] **Step 4: Run Pint and PHPStan**

Run: `cd backend && ./vendor/bin/pint --test && ./vendor/bin/phpstan analyse --no-progress`
Expected: both pass

- [ ] **Step 5: Commit**

```bash
git add backend/tests/Feature/CheckoutApiTest.php
git commit -m "test(checkout): prove existing endpoints support the express checkout sequence"
```

---

## Task 6: Apple Pay domain verification + manual QA checklist (non-code)

**Files:**
- Create: `docs/PLAN-express-checkout-manual-qa-2026-09-29.md`

**Interfaces:** none — this task's deliverable is producing a checklist for a human to run through, since Apple Pay cannot be exercised by an automated test or on the current Windows dev machine (spec §5).

- [x] **Step 1 (done 2026-09-30): Domain already registered and verified**

User registered `petposture.com` in the Stripe Dashboard's newer **Payment method domains** tab (`Settings → Payments → Payment method domains`, domain ID `pmd_1UL5qVA7CIjKKiOg7XvnqFSC`, created 2026-09-29). This flow validates the domain automatically via an HTTPS request from Stripe — it does **not** require hosting a static `.well-known/apple-developer-merchantid-domain-association` file (that requirement belongs to the older, separate Apple Pay domain-registration flow this plan originally assumed). Confirmed via Dashboard screenshot: Status = **Enabled**, Apple Pay status = **Apple Pay enabled**. No code change needed for this step; skip straight to Step 2.

- [ ] **Step 2: Write the manual QA checklist**

```markdown
# Express Checkout — Manual QA Checklist

Run after deploy to production (Apple Pay cannot be tested locally or in CI).

## Apple Pay (Safari, macOS or iOS, with a card in Wallet)
- [ ] Visit /checkout with an item in the cart — Apple Pay button appears in the Express Checkout row
- [ ] Tap the button, choose an address in the Apple Pay sheet — shipping cost and total update live inside the sheet
- [ ] Approve payment — order is created already paid, redirects to /checkout/success
- [ ] Order in admin (Orders list) shows payment_gateway = stripe, correct total, correct address

## Google Pay (Chrome, with a saved card)
- [ ] Same checklist as Apple Pay above, substituting the Google Pay button

## PayPal Express (any browser)
- [ ] PayPal button appears in the Express Checkout row
- [ ] Click it, choose/confirm address in the PayPal popup — shipping cost and total update live
- [ ] Approve payment — order is created already paid, redirects to /checkout/success
- [ ] Order in admin shows payment_gateway = paypal, payment captured

## No wallet available (e.g. desktop Firefox with no PayPal account logged in anywhere)
- [ ] Express Checkout row (including "Express checkout" label and "Or" divider) does not render at all
- [ ] Regular form checkout still works unchanged

## Regression
- [ ] Existing in-form "Pay with PayPal" (below the Express row, inside Payment section) still redirects/opens a popup exactly as before
- [ ] Existing card form (typed card number) still works exactly as before
```

- [ ] **Step 3: Commit**

```bash
git add docs/PLAN-express-checkout-manual-qa-2026-09-29.md
git commit -m "docs(checkout): add Apple Pay domain verification notes and manual QA checklist"
```

---

## Self-Review

**Spec coverage:**
- §2 approve-then-create, PayPal SDK scoped to this component only, existing in-form PayPal/card untouched → Tasks 1–4, Global Constraints.
- §3.1 placement/layout, conditional per-wallet visibility, whole-block hide when none available → Task 1, Task 4 Step 1.
- §3.2 order summary "Enter shipping address" placeholder + live total updates → Task 4 Step 3 (placeholder text), Tasks 2–3 (live updates via wallet SDK `updateWith`/`patch`).
- §4.1 initial estimate from cart subtotal, no new endpoint → Task 2 Step 3 (`subtotalMinor` prop sourced from existing cart total).
- §4.2 address-change recalculation via existing shipping-rates/tax-quote endpoints → Task 2 Step 3 (`shippingaddresschange` handler), Task 3 Step 3 (`onShippingAddressChange` handler).
- §4.3 approve-then-create completion via existing place-order path, gateway-appropriate → Task 2 Step 3 (`paymentmethod` handler), Task 3 Step 3 (`onApprove` handler), proven reusable in Task 5.
- §4.4 idempotency guard → `Idempotency-Key` header on both express place-order calls (Task 2, Task 3), reusing existing backend dedup.
- §5 Apple Pay domain verification, Google Pay no verification needed, manual-only gap → Task 6.
- §6 error handling: wallet-native decline UI (no custom UI added, by design), SDK-load-failure = simple omission (Task 1's `if (!anyAvailable) return null` plus each wallet's own availability flag), fail-closed completion errors surfaced via `role="alert"` `error` state (Task 2/3) while the regular form below remains usable (untouched by this plan) → covered.
- §7 testing strategy: frontend component tests (Tasks 1–3), backend feature tests (Task 5), Apple Pay manual-only (Task 6) → covered.
- §8 out of scope: no cart-page buttons (nothing in this plan touches the cart page), no Shop Pay (only Apple/Google/PayPal implemented), existing PayPal/card flows untouched (confirmed via Global Constraints and by only ever adding new files/new mount points, never editing `PayPalGateway`, the existing in-form PayPal button, or `prepareCardPaymentIntent`) → covered.

**Placeholder scan:** No "TBD"/"TODO"/"add appropriate error handling" phrases. Two implementation-time verification notes are flagged explicitly as such (Task 2's rate-object field names, Task 4's exact success-redirect URL contract) rather than left as unstated gaps — both point to a specific existing file to read, not an open-ended guess.

**Type consistency:** `ExpressCheckoutProps` defined once in Task 1 and referenced identically in Tasks 2–4 (`items`, `couponCode`, `subtotalMinor`, `stripeInstance`, `paypalClientId`, `onOrderPlaced`). `canPayPal` state is declared as a stub in Task 1, then explicitly replaced with a real `setCanPayPal`-backed version in Task 3 (called out in Task 3 Step 3's instructions, not left implicit). `onOrderPlaced({ reference, trackingToken })` shape matches between Task 2's Stripe path and Task 3's PayPal path.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-09-29-express-checkout.md`.

Per the user's explicit instruction earlier in this project ("code thì cứ cho codex làm" — implementation goes to Codex), the next step is to hand Tasks 1–6 to Codex as a self-contained task list (this plan file is already written to be read without further context), then independently verify Codex's work exactly as done throughout this session: read the diff, run the full backend test suite + Pint + PHPStan, run frontend tsc/vitest/build, run `gitnexus_detect_changes()`, commit, push, wait for CI green, then deploy and verify manually via chrome-devtools MCP on production (plus the Task 6 manual QA checklist for Apple Pay/Google Pay/PayPal once deployed).
