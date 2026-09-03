# Sales admin parity Round E — Manual Create Order design

**Date:** 2026-09-03  
**Status:** Approved

## Scope and authority

Round E completes the remaining Manual Create Order feature in the approved Commerce React Admin migration scope. It does not migrate or alter Filament areas outside that scope, and it does not change the public `/api/checkout/place-order` route.

Laravel/Lunar remains authoritative for permissions, request validation, stock, price, tax, coupons, shipping, payment preparation, transactions, order events, notifications, and state. React only renders the form, submits validated user input, and displays server results/errors.

## Admin create endpoint

Add `POST /api/admin/orders` inside the existing `/api/admin` group. It must:

1. use the existing admin authentication and permission middleware;
2. require `update_order`, matching the approved role set already able to update orders: core administrators, Order Manager, and Support;
3. add the intentional `create_order` permission to `AdminPermissionMatrix::ORDER` and assign it to the exact same role set as `update_order`; its policy remains meaningful, but the API's effective operation authorization is the existing `update_order` contract;
4. validate the manual-order request shape;
5. convert `items[].variant_id` to `CheckoutService`'s `items[].variantId`, put the submitted email in `shipping.email`, convert USD shipping fee decimal to integer minor units, and omit blank fee override;
6. force `created_by_admin` to true regardless of client input;
7. call `CheckoutService::placeOrder($payload, $request->user()->id, $request->ip())` directly; and
8. return the established API `OrderResource` representation.

The accepted form payload is:

```ts
interface CreateOrderPayload {
  items: Array<{ variant_id: number; quantity: number }>;
  email: string;
  shipping: Address;
  billing_same_as_shipping: boolean;
  billing?: Address;
  payment_method: 'cod' | 'card';
  shipping_method: 'standard' | 'express';
  coupon_code?: string;
  customer_note?: string;
  internal_note?: string;
  shipping_fee_override?: number; // USD decimal, omitted when blank
}

interface Address {
  first_name: string;
  last_name?: string;
  phone?: string;
  line_one: string;
  line_two?: string;
  city: string;
  state?: string;
  postcode?: string;
  country: string;
}
```

Server validation must mirror the existing Filament schema: email, shipping first name, shipping line one, shipping city, at least one item, valid integer variant IDs, and positive integer quantities are required; optional address fields retain Filament limits/default `US`; billing fields are validated when `billing_same_as_shipping` is false; payment/shipping methods accept only the Filament values; `shipping_fee_override` is non-negative decimal USD.

## Shipping fee semantics

The verified `CheckoutService` behavior is binding:

- an omitted/null override uses the Shipping Manifest option when present, otherwise `ShippingService::rateFor(...)` fallback;
- an explicit `0` forces a zero-fee fallback option, even if a manifest rate exists;
- a positive override is the exact converted minor-unit fee.

Frontend helper text is: **“Leave blank to use the server-calculated shipping rate. Enter 0 for free shipping.”** Backend coverage must demonstrate omitted and zero produce distinct shipping totals.

## Variant picker endpoint

Add restricted order-scoped picker endpoints `GET /api/admin/orders/product-picker?search=...` and `GET /api/admin/orders/product-picker/{product}/variants`; do not alter the existing `/api/admin/products` list response. Their `orders/...` path deliberately uses existing `update_order` authorization, making the picker available to precisely the approved manual-create roles (core, Order Manager, Support) without granting general product reads. They return restricted picker records containing at least:

```ts
interface OrderVariantPickerItem {
  id: number;
  sku: string;
  label: string;
  price: number | null;
  formatted_price: string | null;
  stock: number;
  purchasable: string;
}
```

The endpoint provides display data only. Neither it nor React replaces CheckoutService's final stock/pricing validation.

## React form and picker

Add `OrderFormPage` on `/orders/new` before `/orders/:id`, inside the existing sales permission gate. Add a Create Order button to Orders list.

The form sections are Customer, Items, Shipping Address, Billing Address, Order Settings, and Notes. Defaults: billing same as shipping `true`, country `US`, payment `cod`, shipping `standard`, one or more item quantities `1`.

Picker flow is deliberate and not a workaround:

1. Debounced product search calls existing `GET /admin/products?search=...`.
2. Operator selects a product result.
3. UI fetches the selected product's dedicated variants endpoint.
4. `SearchableMultiSelect` filters and selects that product's variants.
5. Selected variant rows, including quantities, persist while the operator searches another product.

`SearchableMultiSelect` receives optional localized string props for its previously hard-coded visible copy. All Round E strings are `orders.*` i18next keys in English and Vietnamese.

`useCreateOrder()` follows existing `fetchJson` and React Query mutation patterns, invalidates `['orders']`, and returns the created Order. On success, navigate to `/orders/{id}`. A 422 response renders server field messages in the established form alert pattern; it is not reduced to a generic toast.

## Required tests and verification

Backend feature tests cover role behavior, validation, forced `created_by_admin`, payment/card state and order fields through CheckoutService, fee omission versus zero, and picker response shape/access.

Admin tests cover full form render, billing visibility toggle, two-step picker plus persistent selected line/quantity, create payload, 422 field messages, successful redirect, route ordering, create button navigation, and shared picker localization props.

Before handoff: relevant backend tests, complete admin test suite, `npx tsc --noEmit`, `npm run build`, route middleware inspection, and `git diff --check` must pass. Work remains uncommitted until Claude reviews the diff.
