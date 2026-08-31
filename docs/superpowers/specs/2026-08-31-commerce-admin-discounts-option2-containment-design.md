# Discounts Option 2 Safe-Containment Remediation Design

**Date:** 2026-08-31  
**Status:** Approved for implementation  
**Scope:** Correct the unsafe Round 4a Discount CRUD surface without implementing an automatic-promotion engine, BuyXGetY product relations, or per-unit checkout behavior.

## Decision

The Discount admin surface supports only coupon-required cart-level `Lunar\DiscountTypes\AmountOff` discounts. A user may choose either percentage or fixed-cart USD configuration.

The following remain intentionally out of scope:

- `App\Lunar\DiscountTypes\FixedAmountOffPerUnit` creation, update, or configuration.
- `Lunar\DiscountTypes\BuyXGetY` creation, update, conditions, reward-product relations, or configuration.
- Coupon-less/automatic promotion evaluation.
- Changes to `ApplyCouponService`, `CheckoutService`, Lunar vendor code, migrations, or storefront behavior.

This containment prevents the admin from creating discounts that the existing checkout cannot correctly consume. Production currently has zero Discount records; no data migration is needed.

## Backend contract

### Supported mutation type

`POST /api/admin/discounts` and `PUT/PATCH /api/admin/discounts/{discount}` accept only:

```text
Lunar\DiscountTypes\AmountOff
```

The request must include a non-blank coupon. The server remains authoritative and rejects requests that supply the previously exposed per-unit or BuyXGetY classes, even if a stale client submits them.

For AmountOff data:

- `fixed_value=false`: require decimal `data.percentage` in the inclusive range 0–100.
- `fixed_value=true`: require decimal `data.fixed_values.USD` >= 0.
- `data.min_prices.USD` remains optional decimal USD and is persisted as Lunar minor units.
- Only active AmountOff data keys are persisted. All per-unit/BuyXGetY scalar keys are stripped.

`coupon` is required and unique. `max_uses` and `max_uses_per_user` are nullable or integers >= 1; zero is rejected because Lunar interprets a falsy zero as unlimited.

### Local model and resources

The controller queries and route-binds `App\Models\Discount`, preserving the project wrapper extension point instead of importing Lunar’s base model.

Resources always safely represent any existing legacy/unknown type:

```text
supported: true  only for Lunar\DiscountTypes\AmountOff
supported: false for every other persisted type
```

Unknown types use the label `Unsupported`; no `match` expression may throw. Decimal response conversion remains safe for unknown types by returning base `min_prices` data only.

Legacy/unknown records may be listed, shown, and deleted. Their update endpoint returns validation failure / unsupported response before mutation. This gives administrators cleanup capability without presenting an editable invalid configuration.

Authorization remains exactly core-only (`super_admin`, `admin`, `staff`) within the existing admin group. No permission-matrix or middleware changes occur.

## Frontend contract

### Supported form

Create and supported edit routes show a coupon-required AmountOff form only:

- No type selector.
- No BuyXGetY fields.
- No fixed-per-unit fields.
- A `fixed_value` toggle exposes either percentage (max 100) or fixed-cart USD input.

Client validation blocks missing coupon, percentage above 100, zero `max_uses` values, malformed/invalid local datetime input, and existing required/numeric/date errors before mutation. `toIsoUtc` must never produce an unhandled `RangeError`; invalid dates remain in validation state.

A backend 422 response must render its field messages in the form error summary, not only a generic toast.

### Legacy rows

A row with `supported=false` has an `Unsupported` type label. Its action opens the existing detail route in read-only legacy mode; it is not editable and has a delete action for cleanup. The API is still the authority if a malicious client submits PUT/PATCH.

### Pagination

After a successful deletion that removes the only visible item on page N where N > 1, the list moves to page N-1. It does not leave the administrator on an empty stale page.

## Testing

TDD is mandatory. New regression coverage must include:

1. API rejects missing coupon, per-unit/BuyXGetY type, percentage > 100, and zero use limits; valid percentage/fixed-cart AmountOff still persists decimal/minor money correctly.
2. API resources list/show legacy type safely with `supported=false` / `Unsupported`; delete succeeds and update cannot mutate it; controller uses the local wrapper model.
3. Form contains no removed type configuration, requires coupon, blocks cap/zero/date errors, maps 422 field errors, and does not throw on invalid date input.
4. List legacy read-only/delete behavior and last-item page back-navigation.
5. Existing checkout/coupon regression suite runs unchanged, demonstrating this is containment rather than a checkout rewrite.
6. Full backend/admin suites, admin production build, route middleware audit, and whitespace check pass.

## Acceptance criteria

- Admin cannot create/update a no-coupon, BuyXGetY, or per-unit Discount.
- Admin cannot save percentage > 100 or `max_uses`/`max_uses_per_user` = 0.
- Unknown persisted types never cause the list or resource endpoint to 500 and can be removed.
- No checkout runtime code is modified.
- All work remains uncommitted for Claude review.
