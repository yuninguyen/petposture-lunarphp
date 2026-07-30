# Handoff — 2026-07-31

## Mobile text-size sweep (storefront) + mobile-responsive email templates — commits `b32317c`..`d3823aa`

Yuni reviewed the site on a phone and felt text was too small in general. Code audit confirmed it:
widespread arbitrary `text-[8px]`–`text-[13px]` classes with zero responsive breakpoints across the
frontend, instead of the project's own design-token scale. Delegated the full fix (all ~365 real
occurrences across 45 files, once a background agent's thorough grep found more than the initial
251-count estimate) to a background Agent, then iterated with Yuni against real screenshots:

- **First broad pass overshot on desktop.** Some bumped spots (Header's `hidden md:block` secondary
  nav, footer legal links, `ProductCard` badges) are desktop-only and never needed a mobile bump in
  the first place — screenshots at desktop width showed them now "hơi to." Selectively reverted those
  three to smaller values (`13px`/`13px`/`10px`) while keeping the real mobile-only fixes.
- **Topbar text wrap on phone**: `Free Shipping on all us orders over $50` was wrapping "$50" onto
  its own line — root cause was letter-spacing (`tracking-[0.2em]`), not text length. Fixed with
  `tracking-[0.03em] md:tracking-[0.2em]` + `whitespace-nowrap`.
- **Mobile logo oversized in two separate places** — the topbar logo and the mobile drawer's own
  independent logo instance both needed their own fix (`h-[50px]` → `h-[38px]` on mobile, `md:`
  breakpoint keeps desktop at `60px`/`50px`).
- **Footer section labels** (`FooterSection`'s `<h3>`, `Footer.tsx:58`) went through two rounds of
  direct user calibration: `16px` (original, felt fine on desktop but small on mobile) → `13px`
  (first mobile fix) → Yuni said that read as "hơi nhỏ" → settled on **`text-[14px] md:text-[16px]`**.
- **Contact page labels**: `font-black` → `font-semibold` (weight looked too heavy) and
  `tracking-[0.15em]` → `tracking-[0.08em]` (letter-spacing made labels look oddly far apart).
- **Removed the mobile hamburger drawer's "Shop the Collection" CTA button** (`Header.tsx`) —
  Yuni's call after I flagged it as redundant with the drawer's own nav links one tap above it.

**Transactional emails had zero `@media` queries at all** (confirmed via `rg "@media"` before/after,
not assumed) — fixed across all 19 templates in the same sweep, at Yuni's explicit "sửa toàn bộ 19
template cùng lúc." 11 templates needed real layout fixes (2-column-on-mobile → stacked, fixed
padding → responsive `mail-px`), the other 8 (`order-delivered`, `order-shipped`, `order-returned`,
the 5 return-status emails) have no fixed-width/2-column pattern and were confirmed fine as-is. See
`ARCHITECTURE.md`'s Transactional email section for the exact class pattern and the "additive only,
never replace an inline style" rule (now also in `RULES.md`) — the "no CSS inliner runs on these
mailables" constraint means every base style has to stay inline, `@media` can only add classes on top.

All 19 templates were rendered and screenshotted at a real mobile viewport using real/synthetic data
(a `DB::beginTransaction()` + rollback script created temporary `OrderReturnRequest`/`OrderShipment`
rows against a real local order so every Mailable could render its real relational data, then rolled
back — nothing persisted). One false-positive bug I initially reported and then retracted: 6 templates
appeared to show hardcoded "Laravel" branding — actually just local `.env`'s `APP_NAME=Laravel`
default; the templates correctly use `{{ config('app.name') }}`, confirmed both by `grep`ing the
`.blade.php` source (no hardcoded "Laravel" string) and by checking production's `config('app.name')`
via tinker (`PetPosture`, correct).

Every change went through the full deploy cycle (typecheck → Playwright screenshot at mobile
viewport → commit → `gitnexus analyze` → push → SSH deploy + container rebuild → Cloudflare purge →
verify live via `curl`) per Yuni's standing workflow requirement — no shortcuts. Final state confirmed
live via `curl` against `petposture.com`: footer label class present, "Shop the Collection" text
count 0.

## Follow-up sweep of the fail2ban ban list — no other false positives found

After fixing the customer's collateral ban (below), Yuni asked to check whether any other
currently-banned IP was a similar false positive. Cross-referenced all 75 remaining bans against
`nginx`'s rotated/gzipped access logs (`zgrep` across `access.log{,.1,.*.gz}`) to see the exact
request that triggered each one.

Most are genuine WordPress-targeting scanners (`/xmlrpc.php`, `/wp-login.php`, `/wp-json/`,
`wlwmanifest.xml`) — this VPS also hosts an unrelated `rebateops.online`, so a lot of this traffic
is opportunistic scanning of the shared IP, not anything aimed at petposture.com specifically.

Four bans looked at first glance like good bots caught in the crossfire ("bingbot" x2,
"Google-CloudVertexBot", "ClaudeBot" — all hitting `/.git/config`). **Verified via IP ownership,
not the User-Agent string** (`curl "http://ip-api.com/json/<ip>?fields=isp,org,as,reverse"` — no
`whois` binary needed): all four resolved to generic hosting providers (Limestone Networks,
Infraly LLC), not Microsoft/Google/Anthropic. These are scanners **spoofing well-known good-bot UA
strings** specifically to blend in with legitimate crawler traffic — confirmed by a broader log
sweep showing the same fake-Googlebot/bingbot UAs requesting `/serviceAccountKey.json`,
`/.aws/credentials`, `/terraform.tfvars`, `/amplifyconfiguration.json`, etc. — no real search
engine crawler behaves like that. fail2ban banning these was correct, not a false positive.

Three more bans were on IPs in Telegram's real IP block (`149.154.161.204/230/248`, confirmed via
the same IP-org lookup — AS62041 Telegram Messenger Inc, PTR `*.ptr.telegram.org`) — genuinely
Telegram-owned, but requesting `/wp-admin/install.php`, which Telegram's actual link-preview
fetcher would never generate on its own (it only fetches the exact URL someone shared in a chat).
Left banned; they'll self-expire under the new 24h `bantime`. Not touched further, but flagged as a
judgment call if Telegram link-preview functionality for real shared petposture.com links is ever
reported broken — that would be the first thing to check.

**Net result: no additional customer-impacting false positives.** The only real incident was the
CGNAT-collateral one below, already fixed. Added a `RULES.md` note: never probe the live public
domain with scripted requests (use `127.0.0.1:8001`/`:3001` on the VPS instead), and never treat a
"Googlebot"/"bingbot" UA string as proof of the real crawler — always verify IP ownership first.

## Customer got 403'd site-wide by fail2ban (collateral from our own audit) — real customer report, resolved

Yuni reported `petposture.com/wishlist` and a favicon URL returning `403 Forbidden` and Google Search
Console showing indexing failures. First hypothesis (Cloudflare BIC/bot-fight blocking) was wrong —
the actual 403 page was a raw `nginx` error page, not Cloudflare's. Traced it to previously-undocumented
infra: a **host-level nginx (not containerized) + fail2ban** sits between Cloudflare and the Docker
containers (see `ARCHITECTURE.md` Deployment section for the full writeup) — `fail2ban`'s
`nginx-badbots` jail permanently `deny`s any IP that matches a scanner-probe pattern once, for 7 days,
across every path and every site on the VPS (this VPS also hosts an unrelated `rebateops.online`).

Root cause of *this specific* incident: earlier in this same session, a security audit ran `curl`
against `/.env`, `/api/.env`, etc. to verify those paths were properly blocked — legitimate defensive
testing, but it happened to run from an IP that turned out to be shared with Yuni's own residential
connection (Vietnam ISP, likely CGNAT). fail2ban correctly flagged the scanning *pattern* (that part
worked as designed) but banned the whole IP for 7 days, collaterally locking out the real customer
sharing it. Confirmed via `fail2ban-client status nginx-badbots` (found the exact IP in the 76-entry
ban list) and `grep '<ip>' /var/log/nginx/access.log` (showed the exact `curl/8.18.0` requests that
triggered it). Unbanned via `fail2ban-client set nginx-badbots unbanip <ip>`, verified `/`, `/favicon.ico`
back to 200 and `/wishlist` correctly 404 (that route was never built — not a bug, just doesn't exist).

**Changed**: `bantime` in `/etc/fail2ban/jail.d/nginx-badbots.conf` dropped from `604800` (7 days) to
`86400` (24h) to shrink the blast radius of the next false positive — a single flagged request
shouldn't be able to lock a shared-IP customer out for a week. Left `maxretry=1` alone (the filter
patterns — `.env`, `wp-login.php`, `.git/config`, etc. — are specific enough that real traffic
shouldn't trigger them at all; the risk was duration, not sensitivity). This VPS-level config change
isn't tracked in git (fail2ban configs live outside the app repo) — noted here since it's the only
record of it.

**Lesson for future audits on this project**: any external HTTP probing against the *live* domain
(not localhost/origin-only) risks tripping this same jail from whatever IP the probing runs from.
Prefer probing `127.0.0.1:8001`/`:3001` directly on the VPS (bypasses both Cloudflare and this nginx
layer) when checking for exposed files/paths, unless specifically testing the edge-blocking behavior
itself.

## Two public endpoints had no rate limit at all — fixed, commit `48b0c49`

Same audit pass, next finding after the data-leak fix below: a systematic read of every route in
`routes/api.php` not behind `auth:sanctum` found two public write endpoints with **zero**
throttle middleware, unlike every sibling public endpoint in the file:

- `POST /orders/retry-payment` — gated only by tracking_number+email (like `/orders/track`, which
  already has `throttle:10,1`), but calls the real Stripe API on every hit. Unthrottled, it's both
  a way to hammer Stripe and a much faster brute-force surface against a known tracking number
  than its sibling `/orders/track` allows. Now matches it: `throttle:10,1`.
- `POST /newsletter/subscribe` — sends a real confirmation email synchronously on every "new
  subscribe"/"resubscribe" hit, no rate limit at all. Unthrottled, this is an email-bombing vector
  against an arbitrary third-party address, and would burn through the mail provider's sending
  quota fast (relevant given the Hostinger Mail trial). Added `throttle:api-write` (20/min/IP),
  matching `/contact` and `/apply-coupon`.

Verified live on production: 11th request to `/orders/retry-payment` within a minute now returns
429 (curl loop, see session). No test changes needed — existing tests only call each route once.

Also checked and ruled out during this pass: IDOR on `OrderController` (`baseOrderQuery()` scopes
non-staff users to `where('user_id', ...)`, confirmed correct on `show`/`index`; `update`/
`performAction`/`createShipment` all explicitly gate on `canManageOrders()`) and the admin-only
`created_by_admin` checkout flag (impossible to set via the public API — it's not in
`CheckoutController::placeOrder()`'s validated field list, only ever set server-side by the
Filament `CreateOrder` page). Noted but not fixed: a harmless duplicate `return new
OrderResource($order);` (dead code, second one unreachable) in `OrderController::show()`, and a
leftover `/api-test` debug route (returns a static `{status: ok, v: 3}`, no data exposure) — both
cosmetic, not worth a dedicated commit.

## Public order-tracking endpoints were leaking internal/staff-only data — fixed, commit `e8ddcf1`

Found during a targeted post-mortem audit (same session as the PayPal webhook table-name bug
below — asked "what else looks like this class of bug"). `/api/orders/track` (throttled 10/min,
no auth) and `/api/orders/retry-payment` (**no throttle at all**, no auth) — both gated only by
knowing/guessing a `tracking_number` + `email` pair — were returning the **full** admin-facing
`OrderResource`, including `internal_note` (staff-only commentary on the order), `payment_intent_id`,
`refund_id`/`refund_amount`/`refund_status`, the full `order_events` audit trail, and
`available_actions`.

Root cause: commit `bdf9bf9` (2026-07-17, before this session) switched both endpoints from a slim
`OrderTrackResource` to the full `OrderResource` to fix a real crash (`shipping_address`/`lines`/
`total` were missing, breaking `checkout/success` and the track-order page) — but over-corrected by
exposing everything instead of just what those two pages actually render.

Fixed with `OrderPublicResource` (extends `OrderResource`, strips the internal/sensitive keys) —
confirmed via `grep` exactly which `order.*` fields `TrackOrderPage.tsx` and `checkout/success/
page.tsx` consume (both hit the same `/api/orders/track` endpoint) before deciding what to keep:
shipping/billing address, `payment_status`, `card_brand`/`card_last4`, `amount_charged`, `shipments`,
totals all stay; `internal_note`/`payment_intent_id`/refund internals/`order_events`/
`available_actions` are gone. `test_stripe_webhook_marks_card_order_as_paid`'s tracking assertions
were also stale leftovers from before `bdf9bf9` (asserted `payment_status` missing and a
`tracking_url` field that hasn't existed on this resource in months) — corrected to match reality.

New `OrderPublicResourceTest` — verified meaningful by reverting the controller fix via `git stash`
and confirming both new tests fail, then re-applying and confirming they pass. GitNexus flagged
this as **HIGH risk** (both endpoints are entry points to 6 execution flows) — expected, since the
whole point was changing their public response shape; mitigated by the before/after test proof
above. Pint/PHPStan clean (same 6 pre-existing `orderEvents`-relation false positives as before,
zero new). Deployed, verified live via `curl` against `/api/orders/track`.

**Worth internalizing**: this and the PayPal webhook table-name bug were both found by testing
already-shipped code, not by a bug report. A slim, security-conscious "what does this public
endpoint actually need to return" review is worth doing any time a resource shared between an
admin/authenticated context and a public/guest context gets its shape changed.

## PayPal webhook table-name bug fixed + PayPal test coverage + payment-failure alert email + admin address view — commit `a256e23`

Writing the first real test coverage for the PayPal gateway (12 tests: prepare/place/capture/
webhook/refund) uncovered a **live production bug**: `PayPalWebhookEvent` had no `$table`
override, so Eloquent's naming convention resolved the model to `pay_pal_webhook_events`
(PayPal's two adjacent capitals split into "pay_pal") instead of the migration's actual
`paypal_webhook_events` table. Every real PayPal webhook (async capture confirmation, refunds,
disputes) has been silently 500ing since the gateway shipped — caught by the controller's generic
`catch (\Throwable)`, logged, never surfaced. Fixed with `protected $table = 'paypal_webhook_events';`,
verified against the live table on the VPS after deploy. The immediate-capture path (checkout's
own `paypal-capture` call) was never affected — only the async webhook confirmation was broken.

Also shipped in the same commit:
- **Payment failure alert now actually notifies someone.** `PaymentFailureAlertService::record()`
  previously only did `Log::critical()` + an order event when the failure threshold was hit — no
  real-time channel. Added `SendPaymentFailureAlertJob` + `PaymentFailureAlertAdmin` mailable
  (mirrors the existing `NewOrderAdmin`/`CancelledOrderAdmin` admin-mail pattern, sent to
  `config('mail.from.address')`), dispatched right alongside the existing log/event calls.
- **`UserAddressResource`** (Filament, Sales nav group, read-only + delete) — admins can now see
  which customers have saved addresses. This data has existed since `/api/me/addresses` shipped
  and grew again with checkout's "save this information" checkbox, but had zero admin visibility
  until now.

All three came from a self-audit (asked "what's the highest-value non-feature work left") rather
than a specific bug report — worth repeating: **writing tests for an already-shipped feature is a
good way to catch this class of silent-failure bug**, especially anything involving Eloquent's
automatic table-name guessing on multi-capital class names.

## Checkout UI polish + guest/account "save address" — commits `2ef89d2`, `ab843f4`

Font-size bumps (breadcrumb `12px→14px`, Order Summary Subtotal/Discount/Shipping/Tax rows
`13px→14px`, footer policy links `11px→13px` — matching a competitor-store checkout screenshot
Yuni referenced for readability/professionalism) plus a "?" `HelpCircle` icon next to "Shipping"
in `OrderSummary.tsx` that opens a modal with processing/transit/rates copy sourced from the real
`/shipping-policy` page.

Wired up the previously-decorative "Save this information for next time" checkbox
(`checkout/page.tsx`, `id="saveDelivery"` — had zero `checked`/`onChange` before this): logged-in
users get the address saved via `POST /api/me/addresses` (marked default) and prefilled from
`GET /api/me/addresses` on return visits; guests get it saved to `localStorage`
(`petposture_guest_address`, same-device only) and prefilled from there. Deliberately **not**
matched by email across devices for guests — that would let anyone probe a stranger's saved
address just by typing their email at checkout (see `ARCHITECTURE.md`/README for the full
writeup). Verified via Playwright (prefill from seeded `localStorage` renders correctly, checkbox
state toggles), `tsc --noEmit` and `npm run lint` clean, deployed + Cloudflare-purged + verified
live via public `curl`.

## Real PayPal gateway built and deployed — commits `7bbdb07`, `918dbe3`

Replaced `MockPayPalGateway` with a working integration mirroring the Stripe pattern:
`PayPalService` (OAuth, create/capture/refund via Orders API v2, webhook signature
verification), `PayPalGateway` implementing `PaymentGatewayInterface`, `OrderOperationsService::
refundOrder()` and the auto-refund-on-cancel path in `update()` now branch by
`meta.payment_gateway` (stripe vs paypal) instead of assuming Stripe everywhere, new
`syncPayPalPayment()` sharing the same status-transition logic as `syncStripePayment()` via an
extracted `applyPaymentStatusTransition()` helper. Frontend renders PayPal Smart Buttons inline
in checkout (popup approval, matching how Shopify does it) driven by `createOrder`/`onApprove`,
replacing the old static "redirect" placeholder. Admin Settings → Payment tab got Client ID/
Secret/Mode fields + a "Test PayPal" connection check, mirroring Stripe's.
**Still placeholder mode** — needs a real PayPal Developer sandbox app (Client ID/Secret)
entered in Settings before this can be tested live; code path is fully wired but unverified
against a real PayPal sandbox transaction. Pint clean, PHPStan introduces zero new errors
(verified on VPS throwaway checkout), `npm run build`/`tsc --noEmit`/lint clean locally.

**Found and fixed along the way**: the PayPal logo badge next to the payment method row was
hotlinking a Shopify checkout-web SVG asset (`viewBox 38x9`) into a differently-proportioned
48x21 box, rendering with dropped/garbled letters — confirmed via a Playwright screenshot.
Switched to PayPal's own hosted logo (`paypalobjects.com/webstatic/mktg/Logo/pp-logo-100px.png`,
100x26) with a matching 62x16 container (commit `918dbe3`).

**Real deploy gotcha hit during this session — worth knowing for next time**: after rebuilding
and recreating both containers, Yuni still saw the *old* checkout page (old placeholder text,
old logo) even though the frontend container itself was serving the new HTML correctly when
curled directly on the VPS (`127.0.0.1:3001`). Root cause: **Cloudflare was caching the
`/checkout` page itself** — despite `ARCHITECTURE.md`'s Cache Rule only being documented to
target specific `/api/*` GET paths (catalog/content endpoints), not full HTML pages, and
explicitly saying checkout must never be cached this way. Fixed by manually triggering
`app(App\Services\CloudflareCacheService::class)->purgeAll()` via tinker, confirmed the origin
and the public URL matched afterward. **Not yet root-caused *why* `/checkout` got cached** — the
documented Cache Rule shouldn't apply to it. Worth checking the actual Cloudflare Cache
Rules/Page Rules config directly (dashboard) next time deploys don't seem to take effect, rather
than assuming a bad build — this may bite future frontend deploys too, not just this one.

## Order Summary height: no-Fraud-Risk case fixed and confirmed — commits `ddcae9e`, `4462442`

Original complaint: an empty gap under Customer IP whenever the right-side column (Order
Attribution [+ Fraud & Risk]) is shorter than Order Summary. Two earlier attempts at a generic
fix both failed (`h-full`+`items-stretch` on the whole stack = gap moves *inside* Order Summary
when the right stack is taller; removing it = mismatched box edges, judged worse) — reverted back
to the `h-full`+`items-stretch` baseline as the accepted "lesser-bad" default.

Yuni's follow-up ask: specifically handle the case where **Fraud & Risk isn't shown at all**
(COD/PayPal/non-Stripe payments have no `meta.fraud_risk_level`) — then Order Attribution is the
*only* box on the right and was left visibly short next to Order Summary (confirmed via
screenshot of order #15, COD). Fixed in two passes:
1. First attempt (`ddcae9e`): nested `h-full` one level inside the existing `Grid::make(1)`
   wrapper — did **not** work, confirmed via screenshot (box stayed the same short height).
   Root cause: Filament's `Grid` renders CSS Grid rows sized to content (auto), so a nested
   `h-full` doesn't inherit the outer grid's stretched height through an intermediate grid
   container — percentage heights need every ancestor in the chain to have a definite size, not
   just the outermost one.
2. Working fix (`4462442`): when `hasFraudRiskData()` is false, skip the `Grid::make(1)` wrapper
   entirely and place `Order Attribution` directly as a sibling column in the outer
   `Grid::make(12)` (same level as Order Summary, `columnSpan(4)` + `h-full`) — reusing the exact
   pattern that already works for Order Summary itself. When Fraud & Risk **is** present, the
   original stacked two-box column is untouched.
- **Confirmed correct by Yuni via screenshot** of order #15 (COD, no fraud data): Order Attribution
  now matches Order Summary's height exactly, no gap.
- The **original stacked case (Fraud & Risk present, e.g. card payments)** is unchanged — still
  the "lesser-bad" `h-full`/`items-stretch` baseline from before, not revisited this round.
- Verified via VPS throwaway checkout both passes: Pint clean, PHPStan clean (`[OK] No errors`).
  Deployed both times: backend container rebuilt, healthy, `optimize:clear` run.

## Order Summary follow-up: widths + card funding type — deployed and confirmed correct

Yuni reviewed the layout and asked for two more changes, both confirmed correct via screenshot
after deploy (the only remaining complaint was the height/gap issue captured in the section above,
which is a separate, still-open cosmetic problem):
- **Widths**: Order Summary 8/12, the stacked Attribution+Fraud&Risk column 4/12 (was 6/6).
- **Payment Method now shows Credit/Debit/Prepaid, not just the brand** — e.g.
  "Credit Card - Visa •••• 4242" / "Debit Card - Mastercard •••• 1111" — using Stripe's own
  `payment_method_details.card.funding` field (`credit`/`debit`/`prepaid`/`unknown`), captured
  from the *same* charge object already fetched for brand/last4/fraud data, no extra API call.
  Deliberately **did not** build a separate BIN-lookup service — Stripe already determines this
  from the issuing bank's BIN and returns it for free; a third-party BIN database would be less
  accurate and more moving parts for no benefit. Confirmed with Yuni before implementing.
  - New `meta.card_funding` field: captured in `StripePaymentIntentService::handleWebhook()`
    (alongside `card_brand`/`card_last4`) and persisted in `OrderOperationsService::syncStripePayment()`.
  - **Existing paid orders won't have this** — only new payments from this point forward. Order
    #14 (real `card_brand=visa`, `card_last4=4242`, `card_funding=NULL`) was checked directly in
    the DB to confirm the fallback: shows "Card - Visa •••• 4242" (generic "Card" instead of
    Credit/Debit) rather than erroring or showing nothing.
  - **PayPal stays a flat "PayPal" label, no account/email shown** — confirmed with Yuni that
    `MockPayPalGateway` is a placeholder only ("PayPal redirect is not connected yet"), so there's
    no real payer email/account ever captured to show. Not worth inventing a fake field for an
    integration that doesn't exist yet (see PayPal gateway in the backlog below).
- Verified via VPS throwaway checkout before committing (per Yuni's request to test first):
  `php -l` clean on all 3 files, Pint clean (had to pull back a reformatted
  `StripePaymentIntentService.php` — that file had never been run through Pint before, unrelated
  pre-existing style debt, not from this change), PHPStan `[OK] No errors`. Manually traced the
  new formatter logic against order #14's real data before deploying, since there was no way to
  trigger a real Stripe charge with `card_funding` set without an actual payment.
- Deployed: backend container rebuilt, healthy, `optimize:clear` run. Confirmed correct via
  screenshot (order #14: "Card - Visa •••• 4242" showing, 8/4 width visibly narrower on the right).

## Order Summary layout rework — commit `ee18be8`, deployed, awaiting Yuni's visual confirmation

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
- Deployed: backend container rebuilt, `healthy`, `optimize:clear` run. **Layout not yet visually
  confirmed by Yuni** — CSS grid nesting should render as intended (Order Summary tall on the left,
  Attribution/Fraud & Risk stacked on the right) but hasn't been eyeballed in the actual admin UI.

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

## Committed, pushed, deployed — commit `c1f696c`

**PHPStan cleanup for `OrderResource.php`/`ViewOrder.php`** — the 12 pre-existing errors noted
above are now fixed, confirmed by re-running `composer analyse` on the VPS throwaway
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
- Deployed: backend + frontend containers rebuilt, both healthy, `optimize:clear` run. Verified
  `https://petposture.com/admin/orders/15` no longer resolves (redirects to `/sign-in` like any
  other unknown route) and the real site/Filament login both still work normally.

## Known gaps / not done

- **Order Summary cosmetic gap — no-Fraud-Risk case fixed** (see top of this file, commits
  `ddcae9e`/`4462442`), confirmed correct by Yuni. The **Fraud & Risk-present stacked case**
  (card payments) is still the accepted "lesser-bad" `h-full`/`items-stretch` baseline from
  before — open if anyone wants to take another pass at it (would need a custom Blade view
  override to distribute space between fields — not reachable through Filament's normal
  component API, see notes above).
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

## Backlog / bigger asks (need scoping before starting)

- **Return Request Phase 3** — auto-generated prepaid return shipping label via a carrier API.
  The low-value no-return-required rule it was waiting on (auto-waive, above) has since shipped,
  but Phase 3 itself is deliberately deferred until the site scales — don't re-propose without a
  fresh ask.
- **Shop by Solution / Shop by Breed re-think** — needs a business-side decision on target categories first.
- **Support helpdesk tooling** (Zendesk/Freshdesk/shared inbox) for `support@petposture.com` — only worth it once there's more than one person handling customer replies.
