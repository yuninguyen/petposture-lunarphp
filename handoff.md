# Handoff — 2026-07-26

## In progress (uncommitted) — Order Summary layout rework

**`ViewOrder.php` Order Summary reorganized per Yuni's explicit spec** — two-column layout inside
the Order Summary box (`Infolists\Components\Group` per column, no behavior change to any field's
logic, just placement):
- Left: Date, Order Number, Customer Email, Customer IP.
- Right: Payment Method, Order Status, Payment Status, Refund Reason (still only shown when set).
- **Payment Method now shows the card brand when paying by card** — e.g. "Visa •••• 4242" instead
  of a flat "Credit Card" — using `meta.card_brand`/`meta.card_last4`, already captured by
  `StripePaymentIntentService` from the Stripe charge but not previously surfaced here (only used
  on the customer-facing `/checkout/success` page before). Falls back to "Credit Card" if Stripe
  didn't return brand/last4 for some reason, COD/PayPal unchanged.
- **Layout**: outer grid is now `Order Summary` (columnSpan 6) beside a nested `Grid::make(1)`
  (columnSpan 6) containing `Order Attribution` stacked above `Fraud & Risk` — instead of the
  previous three-box-in-a-row (6:3:3) layout. Order Summary visually spans the height of both
  stacked boxes on the right simply by having more content (8 fields vs the two smaller boxes),
  not an explicit CSS row-span — didn't want to fight Filament's grid abstraction for a purely
  visual effect achievable by nesting.
- Verified via VPS throwaway checkout: Pint clean, PHPStan clean (`[OK] No errors`).
- **Not yet committed/deployed** — layout changes are best judged visually; will deploy and ask
  Yuni to confirm in the actual admin UI rather than assume the CSS grid math renders as intended.

## Shipped today (2026-07-26), deployed to production, verified working

**Admin Order view: Order Status vs Payment Status clarity fix**
Triggered by Yuni testing a low-value-waiver refund (order #15, `nemalipuriarmando814@gmail.com`)
and asking why the header still showed "Shipped" instead of "Refunded" — turned out to be working
as designed (fulfillment `status` and `meta.payment_status` are intentionally separate fields, see
`ARCHITECTURE.md`), but the UI made that split hard to see: "Payment Status" was buried as a plain
text line inside the totals block, not a badge, while "Status" was a prominent badge — so it read
like there was only one status.
- `ViewOrder.php` (Order Summary section): added a new `meta.payment_status` badge right next to
  the existing status badge, color-coded (`paid`=success, `partially-refunded`/`pending`=warning,
  `refunded`=gray, `failed`=danger). Removed the old plain-text "Payment Status: ..." line from the
  totals block now that it's a badge (avoids showing it twice).
- Renamed the `status` badge label from "Status" to **"Order Status"** in both `OrderResource.php`
  (list table column) and `ViewOrder.php` (detail page) — first tried "Fulfillment Status", but
  caught mid-session that this collides with an existing, different, customer-facing field:
  `meta.fulfillment_status` (derived by `OrderStateMachine::applyDerivedStatuses()`, values
  `unfulfilled/processing/shipped/delivered/cancelled/returned`, exposed via `Api\OrderResource`
  to `/account`). Settled on "Order Status" instead, which matches how `status`'s state machine is
  already referred to elsewhere in the codebase and doesn't overload either name.
- **Found and fixed a real bug while doing this**: the list-table badge color match
  (`OrderResource.php`) checked for `'payment-pending'` and `'dispatched'`, but those strings don't
  exist anywhere in `OrderStateMachine::ALLOWED_TRANSITIONS` — the real values are
  `awaiting-payment`/`payment-offline` and `shipped`. So almost every order badge silently fell
  through to the gray default color regardless of actual status. Fixed to match real status values
  (`awaiting-payment`/`payment-offline`=warning, `cancelled`=danger,
  `payment-received`/`processing`/`shipped`=info, `delivered`=success), and added the same
  color-coding to the detail-page badge (previously had none).
- Also moved **Payment Method** and **Refund Reason** up into the Order Summary section as their
  own labeled fields (next to Order Status/Payment Status), instead of being buried as plain-text
  lines at the bottom of the Items totals block. Refund Reason only shows when the order actually
  has one (`meta.refund_reason` set). Folded **Coupon** into the totals block's Discount row instead
  (`Discount: -$X (CODE)`, or a standalone `Coupon: CODE` line when a coupon applies with no
  discount amount — e.g. free-shipping coupons) so the totals block now reads in one straight
  order top to bottom: Items Subtotal → Discount (coupon) → Shipping → Tax → Order Total, with
  nothing below Total anymore. The old below-Total divider (`<hr>` + Payment Method/Refund
  Reason/Coupon lines) is gone entirely — those three moved elsewhere or up into this list.
- Commits `86efcdc` (feature) and `adbac92` (Pint formatting). `composer format`/`composer analyse`
  couldn't run locally (dev deps not installed in this checkout's `vendor/`), so both were run
  against a throwaway `composer install` (with dev deps) on the VPS host instead: Pint reformatted
  the two files (whitespace/operator style only — they hadn't been run through Pint in a while, so
  it touched pre-existing code too, not just the new additions); PHPStan reported 12 pre-existing
  errors, none on any of the newly added/changed lines, left alone as out of scope. Deployed:
  pushed to `origin/main`, `git pull` + `docker compose build backend` +
  `up -d --force-recreate backend` on the VPS, container healthy, `php artisan optimize:clear` run.

**Docs sync (committed, `c625f34`)**: confirmed via direct VPS check
(`ssh root@94.72.123.183`, `/opt/petposture`) that the entire 2026-07-25 session — Refund
Reason/Partially Refunded (`d7c042c`/`b0eee73`) *and* the auto-waive low-value return work
(`46f61de`/`73202da`/`98235dd`) — was in fact already deployed (backend container rebuilt
2026-07-25 19:27 +07, right after the last of those commits). `handoff.md` and `README.md` had
been left describing some of this as pending; both updated to reflect reality.

## Shipped 2026-07-25, deployed to production, verified working

**Admin Order View overhaul (Filament)** — commits `eebcea8`, `6ef44bc`, `869f44e`, `33b6eb7`
Fixed a real bug found while addressing a UX complaint: `OrderStateMachine::canTransition()` treated
a same-status transition as valid (used elsewhere to allow meta-only updates), but `availableActions()`
reused that same check to decide which header buttons to show — so an already-`shipped` order kept
showing "Mark Shipped" alongside "Mark Delivered", and re-clicking it would have re-sent the shipped
email and re-registered AfterShip tracking. Fixed by excluding same-status transitions from the button
list specifically. Also: secondary actions (Mark Returned, Refund) moved into an outlined "More
Actions" dropdown instead of loose buttons; removed the rarely-used "Adjust Shipping" action entirely
(and its now-orphaned service method — zero other callers, confirmed via `gitnexus_impact`); Order
Summary / Order Attribution / Fraud & Risk now sit in one row (6:3:3); Customer IP block now spans
full width instead of wrapping narrowly; the Items table's Shipping line now shows the actual method
name (e.g. "Shipping - Standard Shipping") via `ShippingService::nameFor()` instead of just a dollar
amount.

**Multi-shipment / per-item tracking** — commits `34956e0`, `1b593bb`, deployed and verified
(container healthy, `order_shipments` backfill produced 3 real rows from 11 candidate orders as
predicted, `Mark Shipped` → item picker → per-item tracking display all confirmed working via
screenshot, spacing polish applied)
An order can now ship in more than one package. New `order_shipments` + `order_shipment_items`
tables (mirrors the `order_return_requests` shape) let admin pick which items/quantities are in
each shipment — defaults to "everything remaining," so the common single-package case needs zero
extra clicks. Each order line on the admin view shows its own tracking. Backend changes:
- `OrderOperationsService::recordShipment()` replaces the old (zero-caller, dead) `createShipment()`
  — validates items belong to the order and don't exceed remaining shippable quantity (summed
  against prior shipments on that line).
- **Tracking numbers are now required everywhere** — no more silent fallback to the order reference
  as a placeholder. This was a deliberate call after finding the *old* system already had to work
  around this (`OrderResource.php` had a comment-documented filter hiding "placeholder shipments"
  from customers) — decided to stop generating the placeholder in the first place instead of
  filtering it after the fact. The backfill migration also skips these legacy placeholder entries.
- AfterShip webhook rewritten to match a specific shipment by tracking number (not just "the order"),
  and only auto-marks the **order** delivered once **every** shipment on it reports delivered.
- "Order Shipped" customer email now fires once per shipment (not just the first), showing that
  shipment's own items — per Yuni's choice (vs. batching into one email once everything ships).
- `OrderController::createShipment()` (the endpoint the separate Next.js `/admin/orders/[id]` admin
  page calls) now delegates to the same `recordShipment()` — **this was a real bug caught during
  review**: the method it used to call was deleted during the refactor and would have 500'd on that
  route until caught and fixed pre-deploy.
- **Known accepted gap**: that same Next.js page can also `PATCH /api/orders/{id}` with a tracking
  number but no status change — that path still only updates the legacy `meta.shipments[]` array,
  it does **not** create an `order_shipments` row. No crash, just a quantity-accounting blind spot
  on that specific secondary surface. Left as-is since Yuni confirmed Filament is the real admin
  workflow, not this page.
- **Found in production data while verifying**: two old orders (`11` and `14`) share the exact same
  backfilled tracking number (`1Z999AA10123456784`, an obviously-fake format) — looks like leftover
  test data, not a real customer collision, and doesn't currently cause a problem (order 14 was
  already `delivered`). Flagged to Yuni; not cleaned up.

**Return Request: tracking note + 7-day auto-expiry** — commits `1b2c1fe`, `325b9de`, deployed and
verified (`ps aux` inside the container confirms `schedule:work` running alongside `frankenphp` and
`queue:work`)
- New "Add Return Tracking" admin action captures the customer's own return-shipment tracking
  (`return_tracking_number`/`return_carrier`/`package_received_at` on `order_return_requests`) —
  informational only (a 🚚/📦 note/badge on the table), does **not** auto-drive the return's status.
  Deliberately not wired to a webhook yet — physical arrival ≠ verified contents, so admin still has
  to manually confirm via the existing "Mark Item Received" action.
- An approved return request with no tracking number gets **7 days** (down from an initial 14,
  shortened per Yuni) after `approved_at` before it auto-expires (new `expired` status) and emails
  the customer (`OrderReturnExpired`) — a scheduled daily job (`returns:expire-overdue`).
  Deliberately independent of the original 30-day return-eligibility window, which only gates
  whether a request can be *created* — a return approved on day 28 still gets a fresh 7 days to
  ship, not "2 days left of 30."
- **Infra addition**: this project had never run the Laravel scheduler before — no OS cron, no
  `Schedule::` calls anywhere. Added `php artisan schedule:work` as a third supervisord process.
  `README.md`/`ARCHITECTURE.md`/`RULES.md` all updated to document this (a `Schedule::command()`
  registration silently does nothing without this process running).

**Refund Reason select + Partially Refunded status** — commits `d7c042c`, `b0eee73`, deployed and
verified (VPS `git log -1` + backend container rebuild timestamp both confirm this pair is live)
- The order-level Refund action now requires a Reason (`OrderOperationsService::REFUND_REASON_LABELS`:
  Defective/Damaged, Wrong Item Shipped, Low-Value — No Return Required, Customer Changed Mind,
  Duplicate/Accidental Order, Approved Return Request, Other) — a fixed select, not free text, so
  it stays reportable. Stored in `meta.refund_reason`, shown in the order's payment info block and
  logged as an Order Note event. This doubles as the audit trail for the "refund without requiring
  the item back" pattern discussed today (useful for filing supplier claims on the dropship side).
- Found and fixed a follow-on gap the same conversation surfaced: a **partial** refund left
  `meta.payment_status` at `"paid"` — Yuni noticed the Payment Status line still said "Paid" right
  after refunding. Partial refunds now set `payment_status` to `"partially-refunded"` (full refunds
  still set `"refunded"` as before); existing generic label formatters (`Str::headline()`/
  `formatStatusLabel()`) render it correctly with zero frontend changes needed. This value is also
  customer-facing (`/account`, `/checkout/success` read the same `payment_status` field) — same
  transparency a full refund already gets, just extended consistently to partial ones.
**Auto-waive low-value returns** — commits `46f61de`, `73202da`, `98235dd`, deployed and verified
(VPS backend container rebuilt at 2026-07-25 19:27 +07, right after `98235dd`; working tree on VPS
clean at that commit)
- New admin-configurable threshold (Settings, default **$30**): return request items at or under
  the threshold are flagged eligible for a one-click "Waive & Refund" action instead of the full
  ship-back/receive flow — `ReturnRequestService::approveLowValueWaiver()`. Threshold lives in
  `ManageSettings.php` alongside the other Stripe/SMTP settings.
- **Fraud guard**: a customer only gets the fast path once — a repeat low-value claim from the
  same email always falls back to the normal ship-back flow (`OrderReturnRequestResource.php`
  enforces this before showing the waiver action).
- New `OrderReturnWaived` mail notifies the customer when a waiver is approved.
- Fixed same-day: `approveLowValueWaiver()` now passes a null amount (full refund) instead of an
  explicit partial amount when the waived item covers the entire order — previously this left
  `payment_status` at `"partially-refunded"` even for a 100%-covered order (`73202da`).
- Fixed same-day: the status update (`waived`) and the Stripe `refundOrder()` call now share a DB
  transaction — previously a Stripe failure (bad payment intent, decline, network error) left the
  request stuck showing `waived` with no actual refund and no retry path, since `guardStatus()`
  requires `requested` status. Found while testing the real refund path against a live Stripe
  test-mode payment on production (`98235dd`).
- Also fixed along the way: `phpstan.neon` updated for the installed PHPStan 2.x/Larastan 3.x
  (removed a dropped parameter, broadened the magic-property ignore pattern to the generic
  Eloquent `Model` class).

**Overdue pending-review reminder for return requests** — commit `9feb9d4`, deployed and verified
(backend container healthy after rebuild)
Closes the gap noted below in previous handoffs: a fresh return request (`requested` status, before
any admin action) had no deadline or reminder at all — only post-approval tracking had the 7-day
auto-expire. Deliberately chose a **passive reminder over auto-action** (Yuni's call): auto-expiring
an unreviewed request risks rejecting something that deserved approval just because admin was slow,
so nothing about the request's status/emails/behavior changes.
- `OrderReturnRequest::isPendingReviewOverdue()` — true when still `requested` and
  `requested_at` is older than the new `PENDING_REVIEW_REMINDER_DAYS` constant (**2 days**, Yuni's
  call).
- `OrderReturnRequestResource`: the `requested_at` column turns red with a "⚠️ N days pending
  review" note for overdue rows; the Return Requests nav item shows a red count badge
  (`getNavigationBadge()`) of overdue requests, visible without opening the page.
- Caught by PHPStan during the format/analyse pass (see below): `getNavigationBadge()` called
  a private static method via `static::` instead of `self::` — fixed before deploy.

**`/contact` honeypot verified against simulated spam-bot behavior** — no code change, verification
only, via `curl` against production (`https://api.petposture.com/api/contact`):
- Submission with the hidden `website` field filled (what a naive bot that blindly fills every
  `<input>` does) → 200 fake-success response (so the bot thinks it worked), confirmed via
  `storage/logs/laravel.log`: logs `Contact form spam blocked (honeypot)` and never reaches the
  `Mail::send` calls — no email sent.
- Submission with `website` empty (legit path) → confirmed via log (`Contact form submission`,
  no `mail failed` line) that real submissions still go through normally, i.e. the honeypot has no
  false-positive risk for real users. **Sent 2 real test emails to `support@petposture.com`**
  (admin notification + auto-reply, since the test used that address as the "customer" email to
  avoid spamming a stranger) — subject `[TEST] Honeypot false-positive check`, safe to ignore/delete.
- Rate limiting (`throttle:api-write`, 20 req/min/IP): fired 25 rapid honeypot-filled requests —
  first 20 returned 200, requests 21–25 returned 429. Confirms a basic flood bot gets cut off.
- **Known limitation, not a bug**: this is a CSS-positioning honeypot (off-screen, `tabIndex={-1}`,
  `aria-hidden`) — it only stops bots that don't evaluate CSS/JS before filling forms (the common
  case: simple scripts/curl-based spam). A sophisticated headless-browser bot that renders the page
  and checks visibility before filling fields could still bypass it. Not worth a stronger mechanism
  (e.g. CAPTCHA) unless real bypass spam is actually observed — would add friction for real
  customers otherwise.

**AfterShip delivered-webhook pipeline verified end-to-end against production** — no code change,
verification only. A real UPS/USPS/FedEx/DHL delivery scan still hasn't been observed triggering
this (that part depends on AfterShip itself, not testable by us), but everything *our* code does in
response is now confirmed working on live production data, not just fake tracking numbers in a
test environment:
- Crafted a real AfterShip-shaped webhook payload (`{"msg":{"tracking_number":"TESTTRACK00015",
  "tag":"Delivered"}}`), signed it with the real `AFTERSHIP_WEBHOOK_SECRET` (HMAC-SHA256, base64),
  and POSTed it to `https://api.petposture.com/api/webhooks/aftership` — used order #15's existing
  test shipment (`TESTTRACK00015`, the same order used to test the low-value waiver earlier) rather
  than a real customer's shipment.
- Response: `{"message":"Order marked as delivered"}`. Confirmed via DB: `order_shipments` row
  updated to `status=delivered`, `lunar_orders.status` flipped `shipped` → `delivered`,
  `meta.fulfillment_status` synced to `delivered`.
- **Real side effect — flagged to Yuni**: this permanently changed order #15's status in production
  and queued a genuine "Order Delivered" email to `nemalipuriarmando814@gmail.com` via
  `SendOrderLifecycleEmailJob` — confirmed sent (`0` pending jobs, no `failed_jobs` row after).
  Acceptable since #15 was already Yuni's own test order/email, not a real customer, but worth
  knowing this test order is now sitting as "delivered" in the admin panel.
- Full chain confirmed working: HMAC signature verification → shipment lookup by tracking number →
  shipment marked delivered → all-shipments-delivered check → order status update → queued customer
  email → email sent successfully.

## In progress (uncommitted) — held back to batch with more work before deploy

**PHPStan cleanup for `OrderResource.php`/`ViewOrder.php`** — the 12 pre-existing errors noted
above are now fixed locally, confirmed by re-running `composer analyse` on the VPS throwaway
checkout (`[OK] No errors`). No behavior change, all type-safety only:
- `OrderResource.php`: the product-name lookup (`$variant->product?->translateAttribute(...)`)
  now assigns `$variant->product` to a `/** @var Product|null */`-annotated local first — the
  eager-loaded relation is still accessed the same way (no extra query), just typed.
- `ViewOrder.php`: added a private `order(): Order` accessor that narrows `$this->record`
  (Filament's `ViewRecord::$record` is typed `Model|int|string`, always resolved to an `Order` by
  the time these methods run) — replaces the 5 flagged `$this->record->lines`/`->status` accesses.
  The other 6 errors were `static::` calls to `private` methods/properties (`$carrierLabels`,
  `formatCustomerIpBlock()`, `formatAddressBlock()` x2, `formatLineTracking()` x2) — changed to
  `self::`, same fix pattern as the `getNavigationBadge()` bug caught above.
- Pint pass: clean, no reformatting needed.

**Removed the orphaned Next.js admin section** (`frontend/app/admin/orders/*`,
`frontend/app/admin/blog/*`) — this is the "legacy admin page" behind the tracking-number gap
discussed above (PATCH tracking number there only wrote `meta.shipments[]`, never created an
`order_shipments` row, so AfterShip couldn't match it). Investigated first rather than assuming:
- No link to it anywhere in the app's real UI (Header, Footer, account, dashboards) — only
  reachable by typing the exact URL. No client-side auth guard either (relied entirely on the
  backend API returning 403 for non-admins).
- Git history: only 3 commits total, all from the initial buildout (2026-04-20 → 2026-06-06),
  nothing since — ~7 weeks untouched as of today.
- Publishing blog posts is unaffected: Filament's `PostResource` (Create/Edit/List) is the real
  write path, and the public `/blog` pages read the same `/api/posts` endpoint regardless of which
  admin UI created the post — the deleted pages were just a second, unused way to write to the same
  table.
- `gitnexus_impact` on all 4 page components (`AdminOrderDetailPage`, `AdminOrdersPage`,
  `AdminBlogDashboard`, `CreatePostPage`) confirmed 0 upstream callers before deleting. `npm run
  build` passes clean afterward (had to clear a stale `.next/` route-types cache first, unrelated
  to the deletion itself) — route list confirms `/admin/*` is gone, 26 routes remain, nothing else
  broke.
- Deliberately did **not** touch the backend API routes/controller methods these pages called
  (`OrderController::update()`/`performAction()`/`createShipment()`, the admin posts endpoints).
  Filament doesn't call these — it goes straight to `OrderOperationsService` — so with the frontend
  gone, grepping the repo now shows **no remaining caller of `PATCH /api/orders/{id}` at all**.
  Left them in place anyway: removing API surface is a bigger, separate decision (an external
  integration outside this repo could theoretically still call them), and out of scope for what
  Yuni asked for this round.
- **Not committed/pushed/deployed yet** — holding to batch with further work this session per Yuni.

## Known gaps / not done

- **A real carrier delivery scan reaching our webhook is still unconfirmed** — the entire *our-side*
  pipeline (signature verify → shipment match → status update → email) is now verified end-to-end
  against production with a simulated-but-correctly-signed webhook call (see above); the only thing
  left unconfirmed is whether AfterShip itself reliably calls our webhook when a real UPS/USPS/
  FedEx/DHL scan happens — that's outside our code, can only be observed, not tested.
- Carried over from 2026-07-24, still open: **Hostinger Mail trial expires 2026-08-15** — must
  upgrade before then; a real guest return submission through `https://petposture.com/returns`
  (not just curl/route checks) is still pending a suitable real order+email from Yuni.

## Immediate follow-ups (next session)

1. Watch for the next real "delivered" AfterShip webhook hit to confirm the new per-shipment
   matching logic end-to-end with real carrier data (not test tracking numbers).
2. Still pending from before: upgrade Hostinger Mail before 2026-08-15; a real end-to-end guest
   return submission once Yuni has a suitable order+email on hand.
3. Commit + push + deploy the PHPStan cleanup above (currently local-only, held back to batch with
   more work this session).

## Backlog / bigger asks (need scoping before starting)

- **Return Request Phase 3** — auto-generated prepaid return shipping label via a carrier API.
  The low-value no-return-required rule it was waiting on (auto-waive, above) has since shipped,
  but Phase 3 itself is deliberately deferred until the site scales — don't re-propose without a
  fresh ask.
- **PayPal payment gateway** — net-new integration alongside the existing custom Stripe integration.
- **Shop by Solution / Shop by Breed re-think** — needs a business-side decision on target categories first.
- **Support helpdesk tooling** (Zendesk/Freshdesk/shared inbox) for `support@petposture.com` — only worth it once there's more than one person handling customer replies.
