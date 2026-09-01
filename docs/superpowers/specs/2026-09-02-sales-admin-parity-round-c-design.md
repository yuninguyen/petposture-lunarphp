# Sales admin parity Round C — design

## Goal

Complete the approved Order Detail and Return Request operations parity: state-machine-backed order actions, partial shipment creation, reasoned refunds, return tracking, low-value no-return refunds, and non-authoritative refund estimate preview.

## Scope

### Order operations

- Use the existing authenticated `POST /orders/{id}/actions/{action}` endpoint and `OrderResource.available_actions` to render only current state-machine actions.
- Do not render `markShipped` in generic actions. It belongs solely to the shipment workflow.
- Expose `remaining_shippable_quantities` from `OrderResource` as an object keyed by order-line ID and derived by `OrderOperationsService::remainingShippableQuantities()`.
- Add an Add Shipment/Mark Shipped form. It submits tracking number, selected carrier, and selected non-shipping lines with quantities. The existing service remains the sole validator of line ownership and remaining quantity.
- For a `processing` order, UI first successfully invokes `markShipped`, then creates shipment. A shipment failure after successful transition is not rolled back client-side; UI refetches and reports the actual state.
- Extend `OrderController::createShipment` validation to pass `items` to existing `recordShipment` service support. Do not add shipment business logic to controller or frontend.
- Add a required refund reason select. Allowed machine values are exactly:
  - `return_approved`
  - `defective`
  - `wrong_item`
  - `no_return_required`
  - `customer_request`
  - `duplicate_order`
  - `other`
  The controller validates membership against `OrderOperationsService::REFUND_REASON_LABELS`, then passes reason to `refundOrder` so existing order-event audit detail includes it.

### Return Request operations

All new Return Request endpoints remain inside the existing `/admin` group and retain the current `canManageOrders` role set: `super_admin`, `admin`, `staff`, `Order Manager`, `Support`.

- Add `POST /admin/return-requests/{id}/tracking`. Validate scalar tracking number and carrier in `manual,ups,usps,fedex,dhl`; allow only approved requests whose `return_tracking_number` is blank. Controller independently enforces both preconditions before calling existing `ReturnRequestService::addTracking`.
- Add `POST /admin/return-requests/{id}/approve-low-value-waiver`. Validate optional scalar admin note; allow only requested records with strict boolean `meta.low_value_auto_waive_eligible === true`, then call existing service.
- Extend Return Request resource/API type with return tracking values and `low_value_auto_waive_eligible` so UI can show action affordances. API enforcement is authoritative.
- Add `POST /admin/return-requests/{id}/preview`. It receives optional `fee_waived`, independently authorizes admin access, loads the request, and invokes `ReturnRequestService::calculateRefundEstimate`. It returns decimal `item_subtotal`, `tax`, `restocking_fee`, `estimated_refund`. It does not use or weaken the public tracking-token endpoint.

### UI

- Action buttons use existing Button, ConfirmModal, toast, i18n, React Query patterns.
- Refund reason options are supplied by API response or a single shared endpoint-backed contract; frontend must not invent a divergent enum. The chosen implementation will expose the authoritative reason options with the Order response because the UI needs labels as well as values.
- Return Tracking button appears only for `approved` records without return tracking. Waiver action appears only for `requested` records marked eligible. UI hiding is not access control.
- Approve modal fetches estimate on open and when `fee_waived` changes. Preview loading/error is informational and never disables the normal approve action, which recalculates server-side.

## Non-goals

- Manual Create Order.
- Any new fraud/IP work.
- Client-side state-machine, shipment eligibility, or refund calculation logic.
- Changes to Order/Return services, payment settlement semantics, vendor code, migrations, permission matrix, or public guest preview behavior except safely reusing existing calculation service through a separate admin route.

## Failure handling

- Mutations preserve server validation messages and refetch the relevant order/request after completion or mutation failure where a preceding state transition may have succeeded.
- No browser-side compensating state mutation or rollback is permitted after multi-step shipment failure.
- Validation/eligibility rejections cause no service action/side effect.

## Testing

- Backend feature tests prove field/resource contracts, role gates, invalid statuses/eligibility, validation, admin preview calculation, refund reason persistence, partial shipment payload, and mark-shipped then shipment sequence.
- Frontend tests prove action visibility, confirmation flows, shipment payload/default quantities, reason requirement, tracking/waiver visibility, preview re-fetch on fee-waived changes, and nonblocking preview errors.
- Verify focused suites, full relevant backend/frontend suites, TypeScript, production build, routes, and diff whitespace.

## Decision log

- Existing state/payment/shipment and return services are reused; controllers only validate, authorize, load resources, and orchestrate existing service calls.
- Admin estimate preview is a separate endpoint because the guest preview requires private tracking credentials and must remain public-flow specific.
- The frontend must use an authoritative refund reason option contract rather than duplicating `REFUND_REASON_LABELS`.
- All changes remain uncommitted for Claude review before merge.
