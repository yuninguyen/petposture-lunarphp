# Order Follow-ups — 2026-09-04

**For an external coding model (GPT-5.6 / DeepSeek harness).** Two independent, real, verified issues. Fix and commit separately, in this order. Do not combine them into one commit.

---

## 1. Refund banner never shows "refunded", only "processing"

**Confirmed on live order #17** (paid PayPal order → cancelled → refunded): the customer-facing tracking page always shows *"This order was cancelled after payment. Your refund is being processed."* — even though the refund actually completed on 2026-09-03. There is no distinct copy for the completed-refund case.

### Root cause

`refund_status` is stored on the order (`meta['refund_status']`, values `null` / `'refunded'` — see `backend/app/Services/OrderOperationsService.php:372`) but is **never exposed** by `OrderTrackingResource`, which is what the customer-facing `/checkout/success` and `/returns` pages consume. The frontend only receives `payment_confirmed_before_cancellation` (boolean), so it can't distinguish "refund in flight" from "refund done."

### Fix — backend

**File:** `backend/app/Http/Resources/Api/OrderTrackingResource.php`

Add a `refund_status` field to the array returned by `toArray()` (put it next to `payment_confirmed_before_cancellation`, around line 64-67):

```php
'refund_status' => $meta['refund_status'] ?? null,
```

Do not touch any other field. This mirrors exactly how `OrderResource.php:81` already exposes the same field for the admin API — just reusing the existing meta key, no new backend logic.

### Fix — frontend

**File:** `frontend/components/CheckoutSuccessPage.tsx`

1. Add `refund_status: string | null;` to the `TrackingOrder` type (near `payment_confirmed_before_cancellation?: boolean;` at line 48).

2. There are two render sites for the same banner — both must be updated identically:
   - Lines 160-166 (summary panel)
   - Lines 428-435 (timeline step)

   Current logic (summary panel):
   ```tsx
   {order.status === "cancelled" ? (
       order.payment_confirmed_before_cancellation ? (
           <div className="flex items-start gap-2 rounded-[10px] border border-[#f0ddd0] bg-[#fff8f4] px-3 py-2 text-sm text-[#7a4020]">
               <Mail size={14} className="mt-0.5 flex-shrink-0 text-[#df8448]" />
               <span>This order was cancelled after payment. Your refund is being processed.</span>
           </div>
       ) : null
   ) : (
       ...
   )}
   ```

   Change to branch on `order.refund_status === "refunded"`:
   ```tsx
   {order.status === "cancelled" ? (
       order.payment_confirmed_before_cancellation ? (
           <div className="flex items-start gap-2 rounded-[10px] border border-[#f0ddd0] bg-[#fff8f4] px-3 py-2 text-sm text-[#7a4020]">
               <Mail size={14} className="mt-0.5 flex-shrink-0 text-[#df8448]" />
               <span>
                   {order.refund_status === "refunded"
                       ? "This order was cancelled and your refund has been completed."
                       : "This order was cancelled after payment. Your refund is being processed."}
               </span>
           </div>
       ) : null
   ) : (
       ...
   )}
   ```

   Apply the same `order.refund_status === "refunded" ? "...has been completed." : "...is being processed."` swap at the second occurrence (~line 433), keeping that block's existing wrapper markup unchanged — only the text content changes.

3. Do not change the copy for any other status or the non-cancelled branch (lines 167-171).

### Fix — required test update (do this or the full suite goes red)

**File:** `backend/tests/Feature/OrderPublicResourceTest.php:170`

`test_track_endpoint_never_leaks_internal_or_staff_only_fields` currently asserts `refund_status` must **never** appear on the public track response:

```php
$response->assertJsonMissingPath('data.refund_status');
```

Once `OrderTrackingResource` starts exposing `refund_status`, this line will fail the whole suite. Change it to assert the field is present with the expected value instead — the test already seeds `$meta['refund_status'] = 'refunded';` at line 153, so:

```php
$response->assertJsonPath('data.refund_status', 'refunded');
```

Leave every other line in this test untouched — `refund_id`, `refund_amount`, and `refunded_at` must **stay** blocked (`assertJsonMissingPath`, lines 171-173 as currently written): those carry gateway transaction identifiers and raw amounts, which is a different sensitivity level than a plain status string the customer already needs to see rendered in their own tracking page.

### Verify

- `cd backend && vendor/bin/phpunit tests/Feature/OrderPublicResourceTest.php` — confirm `test_track_endpoint_never_leaks_internal_or_staff_only_fields` passes with the updated assertion, and that `refund_id`/`refund_amount`/`refunded_at` are still correctly rejected.
- `cd backend && vendor/bin/phpunit tests/Feature` — full suite still green.
- Manually re-check the already-issued token for order #17 against the live API to confirm the new field appears:
  ```bash
  curl -s -X POST "https://api.petposture.com/api/orders/track" -H "Content-Type: application/json" \
    -d '{"tracking_token":"hdxn5u4pFmyTek7XPdtEttCeQ7YHyGPM49w6BUVxAia6FIYtIXsLFZlhVStnRRj9","email":"mav3rick.sui+test11@gmail.com"}'
  ```
  Expect `"refund_status":"refunded"` in the response (this token was minted 2026-09-04 for testing and is still valid for ~90 days).
- Load `https://petposture.com/checkout/success?token=hdxn5u4pFmyTek7XPdtEttCeQ7YHyGPM49w6BUVxAia6FIYtIXsLFZlhVStnRRj9&email=mav3rick.sui%2Btest11%40gmail.com` and confirm the banner now reads "...has been completed."

---

## 2. Order Detail (admin) — too many equally-heavy action buttons

**File:** `admin/src/features/orders/OrderDetailPage.tsx`

Current header row (line 62) renders up to 5 buttons side by side, all either solid `primary` or solid `danger` — no visual hierarchy:

```tsx
{genericActions.map((action) => <Button key={action.action} variant={action.action === 'cancelOrder' ? 'danger' : 'primary'} onClick={() => setPendingAction(action)}>{action.label}</Button>)}
{shippableLines.length > 0 && <Button onClick={openShipment}>{order.status === 'processing' ? t('orders.mark_shipped') : t('orders.add_shipment')}</Button>}
{canRefund && <Button variant="danger" onClick={() => setRefundOpen(true)}>{t('orders.refund')}</Button>}
<Button variant="secondary" onClick={() => setReturnOpen(true)}>{t('orders.mark_returned')}</Button>
```

`genericActions` comes from `available_actions` (backend: `backend/app/Support/Orders/OrderStateMachine.php:39-50`), which for a given status returns 1-2 of: `Mark Paid`, `Mark Processing`, `Mark Delivered`, `Cancel Order` (never more than 2, since a status only ever transitions to 2 targets max — see `ALLOWED_TRANSITIONS` in that file). Combined with the shipment button, Refund, and Mark Returned, that's up to 5 buttons visible at once, e.g. for a `payment-received` order: Mark Processing, Cancel Order, Refund, Mark Returned = 4; for `processing`: Cancel Order, Mark Shipped, Refund, Mark Returned = 4.

### Decided approach

Keep exactly **one primary action visible as a solid button**, move everything else into a "More actions" (`•••`) dropdown menu — same pattern as Shopify's order page. Pick the primary action as the single most forward-progressing one:
- If `order.status === 'processing'` and there are shippable lines → primary = "Mark Shipped" (the shipment button).
- Else if `genericActions` contains a non-destructive action (i.e. not `cancelOrder`) → primary = that action.
- Else (only `cancelOrder` is available, or nothing is) → no primary button, everything goes in the menu.

Everything else (`Cancel Order`, `Refund`, `Mark Returned`, and any other generic action not chosen as primary) goes into the dropdown, in that order, each keeping its current color semantics as text/icon color inside the menu (destructive items in red text) rather than as solid button fills.

### Implementation

There is no existing dropdown/menu component in `admin/src/components/ui/`. Add a minimal one — don't pull in a new dependency (no Headless UI / Radix in `admin/package.json` currently), just a self-contained component using `useState` + a click-outside handler.

**File:** Create `admin/src/components/ui/dropdown-menu.tsx`

```tsx
import { useEffect, useRef, useState, type ReactNode } from 'react';
import clsx from 'clsx';

interface DropdownMenuItem {
  key: string;
  label: string;
  onClick: () => void;
  destructive?: boolean;
}

export function DropdownMenu({ items, label = 'More actions' }: { items: DropdownMenuItem[]; label?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label={label}
        onClick={() => setOpen((current) => !current)}
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 bg-white text-primary hover:bg-gray-50"
      >
        •••
      </button>
      {open && (
        <div className="absolute right-0 z-10 mt-2 w-48 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
          {items.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => { setOpen(false); item.onClick(); }}
              className={clsx(
                'block w-full px-4 py-2 text-left text-sm hover:bg-gray-50',
                item.destructive ? 'text-red-600' : 'text-primary'
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

**File:** `admin/src/features/orders/OrderDetailPage.tsx`

1. Import the new component:
   ```tsx
   import { DropdownMenu } from '@/components/ui/dropdown-menu';
   ```

2. Replace the button row at line 62 (inside the existing `<div className="flex flex-wrap gap-2">`) with logic that picks one primary action and puts the rest in the menu. Insert this just before the `return` statement (after `const genericActions = ...` at line 59):

   ```tsx
   const shipLabel = order.status === 'processing' ? t('orders.mark_shipped') : t('orders.add_shipment');
   const canShipNow = order.status === 'processing' && shippableLines.length > 0;
   const nonDestructiveAction = genericActions.find((action) => action.action !== 'cancelOrder');
   const cancelAction = genericActions.find((action) => action.action === 'cancelOrder');

   type PrimarySlot = { kind: 'ship' } | { kind: 'action'; action: typeof genericActions[number] } | null;
   const primary: PrimarySlot = canShipNow
     ? { kind: 'ship' }
     : nonDestructiveAction
     ? { kind: 'action', action: nonDestructiveAction }
     : null;

   const menuItems = [
     ...(shippableLines.length > 0 && primary?.kind !== 'ship' ? [{ key: 'shipment', label: shipLabel, onClick: openShipment, destructive: false }] : []),
     ...(primary?.kind === 'action' ? [] : nonDestructiveAction ? [{ key: nonDestructiveAction.action, label: nonDestructiveAction.label, onClick: () => setPendingAction(nonDestructiveAction), destructive: false }] : []),
     ...(cancelAction ? [{ key: cancelAction.action, label: cancelAction.label, onClick: () => setPendingAction(cancelAction), destructive: true }] : []),
     ...(canRefund ? [{ key: 'refund', label: t('orders.refund'), onClick: () => setRefundOpen(true), destructive: true }] : []),
     { key: 'markReturned', label: t('orders.mark_returned'), onClick: () => setReturnOpen(true), destructive: false },
   ];
   ```

   Rules encoded above (must match exactly):
   - `processing` status with shippable lines remaining → primary = `Mark Shipped`.
   - Otherwise, if there's a non-`cancelOrder` generic action available (e.g. `Mark Processing`, `Mark Paid`, `Mark Delivered`) → primary = that action.
   - Otherwise → no solid primary button, only the `•••` menu.
   - `Add Shipment` for any non-`processing` state with shippable lines is never primary — it goes into the menu.
   - `Cancel Order`, `Refund`, `Mark Returned` are never primary — always in the menu.

   Then update the JSX button group to:
   ```tsx
   <div className="flex flex-wrap items-center gap-2">
     {primary?.kind === 'ship' && <Button onClick={openShipment}>{shipLabel}</Button>}
     {primary?.kind === 'action' && <Button onClick={() => setPendingAction(primary.action)}>{primary.action.label}</Button>}
     <DropdownMenu items={menuItems} label={t('orders.more_actions')} />
   </div>
   ```

3. Add the new locale key `orders.more_actions` (value: `"More actions"`) to `admin/src/locales/en.json` under the existing `orders.*` block, next to `orders.mark_returned`. Add the Vietnamese equivalent to the corresponding VN locale file (check `admin/src/locales/` for the exact filename) with value `"Hành động khác"`, matching this project's existing bilingual-admin-UI requirement.

4. Leave all the modal/dialog JSX (`ConfirmModal` blocks at lines 76-79) completely unchanged — only the trigger buttons move, not the underlying mutation/modal logic.

### Verify

- `cd admin && npm test -- OrderDetailPage` (or the project's actual test command — check `admin/package.json` `scripts.test`) — existing `OrderDetailPage.test.ts` must still pass; read it first, since it likely asserts on button text/count directly and may need selector updates.
- Manually load an order in each of the distinct status states (`payment-received`, `processing`, `shipped`, `cancelled`) in the admin UI and confirm: exactly one solid button + the `•••` menu is shown (or just the menu, for `cancelled`/`delivered` where nothing is actionable), and every action inside the menu still triggers its correct existing modal.

---

## Out of scope — do not touch

**PayPal webhook still pointing to an old ngrok URL** is *not* a code issue — there is no ngrok reference anywhere in this repository (confirmed via full-repo grep). The webhook endpoint URL is configured entirely inside the PayPal Developer Dashboard (Apps → Webhooks), external to this codebase — see `backend/.env.example:79-82` for the exact endpoint (`https://<domain>/api/webhooks/paypal`) and events to re-register. This is a manual dashboard action for the account owner, not something a coding pass can fix. Do not modify `backend/app/Services/PayPalService.php`, `backend/config/services.php`, or any webhook-related code for this.

## Definition of done

- Full backend suite green: `cd backend && vendor/bin/phpunit`.
- Only files touched: `OrderTrackingResource.php`, `OrderPublicResourceTest.php`, `CheckoutSuccessPage.tsx`, `OrderDetailPage.tsx`, new `admin/src/components/ui/dropdown-menu.tsx`, `admin/src/locales/en.json` (+ VN locale file).
- No changes to `OrderResource.php`, `OrderOperationsService.php`, `OrderStateMachine.php`, `PayPalService.php`, or any Filament (`ViewOrder.php`) file — those are either already correct or out of scope.
