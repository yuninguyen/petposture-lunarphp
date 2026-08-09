# PetPosture

An e-commerce platform for pet posture products, built as a monorepo with Next.js (frontend) and Laravel + Lunar PHP (backend).

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js&logoColor=white)
![Laravel](https://img.shields.io/badge/Laravel-11-FF2D20?logo=laravel&logoColor=white)
![PHP](https://img.shields.io/badge/PHP-8.3-777BB4?logo=php&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Stripe](https://img.shields.io/badge/Payments-Stripe%20%2B%20PayPal%20%2B%20Airwallex%20%2B%20Payoneer%20%2B%20PingPong-635BFF?logo=stripe&logoColor=white)
![License](https://img.shields.io/badge/License-Proprietary-lightgrey)

**Live site:** https://petposture.com  
**Admin panel:** https://api.petposture.com/admin

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS 4 |
| Backend | Laravel 11, PHP 8.3, Lunar PHP (e-commerce engine) |
| Backend server | FrankenPHP + Caddy (single binary, no separate PHP-FPM/Nginx) |
| Admin Panel | Filament 3 + Filament Shield (RBAC) |
| Auth | Laravel Sanctum |
| Roles & Permissions | Spatie Laravel Permission |
| Payments | Stripe (cards, incl. Radar fraud scoring) + PayPal (Smart Buttons, popup approval) + Airwallex/Payoneer/PingPong (redirect/hosted-checkout, added 2026-08-07) |
| Database | MySQL |
| Cache & Session | Redis (via `predis/predis`) |
| Queue | Database driver, processed by a `queue:work` process (supervisord) |
| Scheduler | Laravel scheduler, driven by a `schedule:work` process (supervisord) |
| Hosting | VPS (Docker Compose, 3 containers: backend + frontend + redis) |

---

## Project Structure

```
petposture/
├── frontend/                   # Next.js app (App Router, TypeScript)
│   ├── app/
│   │   ├── page.tsx            # Homepage
│   │   ├── shop/                     # Product catalog & product detail
│   │   ├── cart/                     # Shopping cart
│   │   ├── checkout/                 # Checkout + success page
│   │   ├── account/                  # Customer dashboard (orders, addresses, profile)
│   │   ├── sign-in/, sign-up/        # Auth (split from a single /auth page)
│   │   ├── blog/                     # Blog listing + post detail
│   │   ├── track-order/              # Guest order tracking
│   │   ├── admin/                    # Frontend admin (orders, blog)
│   │   └── [policy pages]/           # FAQ, privacy, terms, shipping, etc.
│   ├── Dockerfile.prod
│   └── next.config.ts
├── backend/                    # Laravel API + Filament admin
│   ├── app/
│   │   ├── Http/Controllers/Api/     # REST API controllers
│   │   ├── Models/                   # Eloquent models (+ Models/Legacy, pre-Lunar, deprecated)
│   │   ├── Services/                 # CheckoutService, ShippingService, OrderOperationsService, etc.
│   │   ├── Jobs/                     # Queued jobs (emails, IP-intelligence lookup)
│   │   ├── Lunar/ShippingModifiers/  # Registers real shipping options into Lunar's cart pipeline
│   │   ├── Filament/                 # Filament resources, pages, widgets
│   │   └── Providers/Filament/       # AdminPanelProvider (theme, layout)
│   ├── database/
│   │   ├── migrations/
│   │   └── seeders/
│   ├── Dockerfile
│   ├── supervisord.conf        # Runs frankenphp + queue:work + schedule:work together
│   └── routes/api.php
├── docker-compose.prod.yml     # VPS deployment (backend + frontend containers)
└── docker-compose.yml          # Local dev
```

---

## Features

- Product catalog with categories, variants, attributes, and brands
- Shop by Breed / Shop by Solution (added 2026-08-02): two independent product facets on top of
  category — breed (`flat-faced`/`long-backed`) and health-concern solution
  (`eating-digestion`/`mobility-support`/`comfort-safety`) — each with a picker index page
  (`/shop/breeds`, `/shop/solutions`) and dedicated landing pages per variant
  (`/shop/breeds/flat-faced`, `/shop/solutions/comfort-safety`, …), plus matching filter facets in
  the main shop sidebar. A product can carry both a breed and a solution tag at once.
- Shopping cart & checkout flow (guest + authenticated), Stripe card and PayPal (Smart
  Buttons rendered inline, popup approval — not a full-page redirect) payments, plus Airwallex,
  Payoneer, and PingPong (redirect/hosted-checkout — customer is bounced to the gateway's own
  page and back, added 2026-08-07). A "Save this
  information for next time" checkout checkbox saves the shipping address for next time: to the
  customer's account (`/api/me/addresses`, authenticated) if logged in, or to `localStorage`
  (same-device only) for guest checkouts — guest addresses are deliberately not matched by email
  across devices, since that would let anyone probe a stranger's address just by typing their
  email at checkout.
- Customer account dashboard (`/account`): order history with expandable order detail
  (items, shipping/billing address, tracking, payment status), saved addresses, profile info
- Order management & tracking, with a WooCommerce-style admin order view:
  status actions (mark paid/processing/shipped/delivered/cancel), refunds (full/partial, via
  Stripe or PayPal depending on which gateway the order was paid through)
  with a required Reason select (Defective, Wrong Item, Low-Value — No Return Required, Customer
  Changed Mind, Duplicate Order, Approved Return Request, Other) so a refund issued outside the
  Return Request flow still leaves an audit trail, and an auto-updating Order Notes activity
  timeline. **Order Status** (the fulfillment state machine: awaiting-payment → processing →
  shipped → delivered/cancelled) and **Payment Status** (paid/partially-refunded/refunded/failed —
  tracked independently, since a refund never rewrites the fulfillment state) show as two separate
  color-coded badges side by side, so a partially-refunded order still reads "Shipped" for
  fulfillment while clearly showing "Partially Refunded" for payment, instead of one field hiding
  the other. Payment Method and Refund Reason (when a refund was issued) also live in the Order
  Summary block alongside these two statuses, rather than at the bottom of the item totals — the
  item totals block itself now reads straight top to bottom as Items Subtotal → Discount (with the
  coupon code inline) → Shipping → Tax → Order Total, nothing extra below.
- Multi-shipment tracking (added 2026-07-25): an order can ship in more than one package —
  admin picks which items/quantities go in each shipment when marking an order shipped (or
  adding another package to an already-shipped order), each with its own required tracking
  number and carrier (no placeholder/auto-generated tracking allowed). Each order line shows
  its own tracking on the order view. The AfterShip webhook matches per-shipment and only
  auto-marks the whole order delivered once every shipment on it reports delivered; the
  "Order Shipped" customer email fires once per shipment with that shipment's own items.
- Order Attribution tracking (UTM/referrer origin, device type, session page views) — self-hosted,
  no third-party analytics service required
- Stripe Radar fraud/risk scoring surfaced on the order view (automatic on every card payment)
- Customer IP intelligence on the order view (location, ISP, connection type via ip-api.com,
  captured asynchronously at checkout so it never blocks the checkout request)
- Shipping Cost management (Sales > Shipping Cost): full CRUD over shipping methods (price,
  free-shipping threshold, delivery estimate) — checkout and order totals both read from the same
  source, so what's configured in the admin is exactly what customers are charged
- Customers are linked to real Lunar `Customer` records on signup/checkout (not just Users),
  so Sales > Customers shows real customer data instead of an empty page
- Blog post SEO Settings (Google Search + Social Media tabs: SEO title, focus keyphrase, meta
  description, social title/description/image) with a "Generate with AI" button that calls
  Claude Opus 5 (`AiSeoGeneratorService`, `anthropic-ai/sdk`) to draft all five fields from the
  post's title/content in one request (structured JSON output, admin reviews before saving —
  never auto-saves). Anthropic API key follows the same DB-`Setting`-overrides-`.env` pattern as
  Stripe/PayPal (`ANTHROPIC_API_KEY` or Settings → `anthropic_api_key`); without it configured,
  the button shows a clear error instead of failing silently.
- Blog with slug-based routing, a Tags taxonomy (`blog_tags`, with a Merge action for cleanup) and
  Categories, including a "comparison" post type (retailer price-comparison cards, each item with
  an `in_stock` toggle that surfaces a "⚠ Out of stock" badge in the admin Posts list, with outbound
  affiliate links — Chewy/Amazon/Walmart/Petco/PetSmart, managed under Content → Affiliate Networks)
  with FTC disclosure. Outbound affiliate links go through an internal `/go/{post}/{item}` redirect
  (added 2026-08-07) that logs a click (`affiliate_clicks` table: post, network, product, referrer)
  before forwarding to the real retailer URL — a Reports page (Finance → Reports, added 2026-08-09)
  shows total clicks (7/30-day/all-time), top network, and top-clicked posts from that table. No
  revenue/commission tracking yet, click volume only. Comparison-item prices are still entered by
  hand — evaluated pulling them live from retailer APIs instead (2026-08-09) and deferred: only
  Walmart (via Impact) has a currently-usable price API among the 5 retailers; Amazon's real API is
  gated behind an Associates sales history this site doesn't have yet; the others have no public
  price API at all.
- Legal/compliance pages, editable from admin without a code deploy (rebuilt as a CMS 2026-08-09):
  Privacy Policy (incl. a CCPA/CPRA "Your U.S. State Privacy Rights" section — the site doesn't
  sell/share personal data, so this is a disclosure + contact-based rights process, not an opt-out
  mechanism), Terms and Conditions, Cookie Policy, Acceptable Use Policy, Affiliate Disclosure,
  Shipping Policy, and Return & Refund Policy all read from a `Page` model (Content → Pages in
  Filament, rich-text editor) via one shared frontend layout that auto-builds its own table of
  contents from the page's own headings. A real cookie notice banner (essential-cookies-only,
  dismissed via localStorage) replaced Cookie Policy's prior mention of a "Cookie Consent Manager"
  that never existed in code. Footer groups these under a dedicated "Legal" column (plus the 4
  most-referenced ones in the bottom bar) and a merged "Shop" column (previously two separate "Shop
  by Solution"/"Shop by Breed" columns). FAQs, Contact Us, and Track Your Order are intentionally
  *not* part of this CMS (accordion data, a real form, and a live order-lookup tool, respectively —
  not flat editable content).
- Discount / coupon codes (Lunar's discount engine, incl. free-shipping coupons)
- Self-service order returns (`/returns`): guest lookup by order number + email, item/quantity
  selection, reason and note — reviewed in Filament (Sales > Return Requests) with
  approve (RMA address, emails the customer), reject (with a reason), or mark received actions.
  The 30-day return window from the published Return & Refund Policy is enforced both in the UI
  (dimmed/disabled past the window) and server-side on submission. Server-side validation also
  rejects an `order_line_id` that doesn't belong to the order, and caps requested quantity
  (summed across duplicate line entries and prior *completed* return requests for that line)
  against what was actually purchased.
  On approval, the refund amount is auto-computed (25% restocking fee on the pre-tax item
  subtotal, prorated for partial-quantity returns, tax refunded in full) — the admin can waive
  the fee for a confirmed defective/wrong-item case or override the final amount (the recorded
  fee reconciles with whatever amount is actually approved), and the approval email shows the
  fee/refund breakdown. Refunding is still a separate, manual action on the order itself —
  nothing here auto-triggers the actual Stripe refund.
  Low-value items (at or under an admin-configurable threshold, default $30, set in Settings) get
  a faster path instead: a one-click "Waive & Refund" action skips the ship-back/receive flow
  entirely and refunds via Stripe directly (full refund if the waived item covers the whole
  order, otherwise partial), emailing the customer (`OrderReturnWaived`). A fraud guard limits
  this fast path to once per customer email — repeat low-value claims fall back to the normal
  return flow.
  The `/returns` form itself shows a live estimated-refund preview (`POST
  /api/orders/return-requests/preview`, no side effects) as items are selected, a restocking-fee
  disclosure linking to the policy page, days-remaining-in-window messaging, and blocks the
  lookup early with a friendly message if the order already has a return in progress. Admin's
  Return Requests table surfaces the resulting Refund/Fee amounts, and the Approve form warns if
  a manually-entered override deviates from the computed estimate.
  Once approved, admin can separately record the customer's own return-shipment tracking number
  (a note/badge on the table — informational only, doesn't drive status). An approved request
  with no tracking number 7 days after approval auto-expires and emails the customer (daily
  scheduled job — independent of, and unrelated to, the original 30-day return-eligibility
  window above, which only gates whether a request can be created in the first place).
- Contact form (`/contact` → `POST /api/contact`) has a hidden honeypot field — a filled
  `website` field silently no-ops (200 response, no mail sent) instead of erroring, so bots
  don't learn they were caught — and every real submission is logged (IP + email domain) for
  future spam-pattern audits
- Product reviews (storefront submit + admin moderation)
- Multi-language support
- SEO metadata & automatic sitemap, `<link rel="canonical">` on all 21 public routes, and a
  www → non-www 301 redirect at the edge (see "Domain canonicalization" below)
- Static policy pages (FAQ, privacy, shipping, returns, etc.)
- Full Filament admin panel with a custom dark sidebar theme (Haze-referenced), narrowed nav width,
  and reorganized nav groups (Commerce, Content, Finance, System — "Content Management" is displayed
  as "Content" today, a label-only rename). Real dashboard widgets
  (revenue/orders/AOV, sales-by-category, order pipeline, return-request aging), a real DB-backed
  notification center (order placed, new review, new customer — polling every 30s), Users with real
  active/inactive status and last-login tracking, a Roles card grid + Permissions matrix, and a real
  file manager (Files) replacing the old bare media table. Products table shows a thumbnail + name +
  description, category/brand, price, and click-to-quick-edit Stock/Status (single-variant products
  only for Stock, since the column is a sum across variants). Every Edit/Delete header button across
  the whole panel — local resources and untouched Lunar/Shield vendor pages alike — is styled from one
  global config (outlined orange for Edit, outlined red for Delete), not per page. Customers table
  (added 2026-08-07) shows Name/Email/Total Orders/Total Spent/Joined/Status (Status derived from
  the linked login account's active flag) with a matching filter; the Customer view page has a
  3-column Customer Details box (identity/contact fields, account reference/tax/phone, Customer
  Groups) plus separate Orders / Address Book (the customer's saved address book,
  `lunar_addresses` — distinct from the temporary cart address at checkout and from the frozen
  per-order address snapshot) / Login Accounts (the actual login email/password manager —
  supports more than one linked login per customer) tabs.
- Role-based access control via Filament Shield

---

## Domain canonicalization (www → non-www)

`petposture.com` (non-www) is the canonical domain — `frontend/lib/site.ts`'s `SITE_URL` feeds
both `app/robots.ts`'s sitemap URL and every URL emitted by `app/sitemap.ts`. Fixed 2026-08-10
after discovering `www.petposture.com` and `petposture.com` both served identical 200 content
with **no redirect and no canonical tag between them** — a duplicate-content SEO risk, found
while investigating an unrelated Googlebot 4xx/5xx report (which turned out unrelated; both
domains were healthy).

- **Edge redirect**: a Cloudflare Redirect Rule (zone `7c77d5e7f534eb3da62f474ec3c88e0a`, phase
  `http_request_dynamic_redirect`) 301s `www.petposture.com/*` → `petposture.com/*`, preserving
  path and query string, for both HTTP and HTTPS. Created via the Cloudflare API (no dashboard UI
  step needed) — see the ruleset entrypoint for `http_request_dynamic_redirect` on that zone if it
  ever needs editing.
- **Canonical tags**: all 21 public-content routes (home, shop + breed/solution index & `[slug]`
  pages, product detail, blog index + `[slug]`, contact, faqs, track-order, our-mission, and all 7
  legal pages) set `alternates: { canonical: '/path' }` in their `generateMetadata`/`metadata`
  export, resolved against `SITE_URL` via `metadataBase` in `app/layout.tsx`. Utility/account
  routes (`/cart`, `/checkout`, `/account`, `/auth/*`, `/sign-in`, `/sign-up`, `/wishlist`,
  `/returns`, the legacy `/product/[id]` redirect) deliberately have no canonical — they're either
  `robots.txt`-disallowed or not indexable content.
- **Adding a new public route**: give it its own `alternates: { canonical: '/your-path' }` (or
  build it from `params` for a dynamic route, e.g. `` `/blog/${slug}` ``) — there is no global
  default; a page that skips this silently has no canonical tag at all.

---

## Email deliverability & branding (DNS)

**DNS is authoritative on Cloudflare, not Hostinger's own panel.** `petposture.com`'s
nameservers point at Cloudflare (`nelly.ns.cloudflare.com` / `sam.ns.cloudflare.com`), so all
mail DNS records (MX, DKIM, SPF, DMARC, BIMI) must live in the **Cloudflare zone**
(Zone ID `7c77d5e7f534eb3da62f474ec3c88e0a`). Hostinger's own DNS panel shows what Hostinger
*expects* for its mail product, but records entered there are not live on the internet unless
also present in Cloudflare — this exact gap caused a same-day production incident where the
domain had **no MX record at all** (found 2026-07-24; see `handoff.md` for the full writeup).
**Never add a Hostinger Email Routing setup to this zone** — it locks the zone's MX/DKIM/SPF to
Cloudflare's own routing service and is incompatible with routing mail to Hostinger mailboxes.

- **Live records in the Cloudflare zone**: MX (`mx1`/`mx2.hostinger.com`, priority 5/10), 3 DKIM
  CNAMEs (`hostingermail-a/b/c._domainkey`), `autodiscover`/`autoconfig` CNAMEs, SPF
  (`v=spf1 include:_spf.mail.hostinger.com ~all`), and BIMI/DMARC below.
- **BIMI**: `default._bimi.petposture.com` TXT record points at
  `https://petposture.com/assets/bimi-logo.svg` (a hand-built SVG Tiny PS reproduction of the
  paw icon mark — square viewBox, no scripts/external refs, per BIMI's spec). This is what lets
  Gmail/Yahoo show the brand logo next to the sender name, instead of a generic avatar.
- **DMARC** is `p=quarantine; pct=25` — required by Gmail for BIMI to take effect at all.
  `pct=25` staggers enforcement to a quarter of mail rather than jumping straight to 100%,
  specifically to limit blast radius while monitoring aggregate reports
  (`rua=mailto:no-reply@petposture.com`) for a few weeks before considering `pct=100`. If
  deliverability problems show up, roll back to `p=none` first and investigate.
- Both DNS changes propagate on their own schedule (TTL 3600s) and Gmail may take additional
  days beyond that to crawl and start showing the BIMI logo — absence right after the DNS
  change lands is expected, not a sign of misconfiguration.
- To verify what's *actually* live (not just what a DNS panel shows), query a public
  DNS-over-HTTPS resolver directly, e.g.
  `curl -s "https://cloudflare-dns.com/dns-query?name=petposture.com&type=MX" -H "accept: application/dns-json"`
  — this bypasses any panel/caching confusion and hits the real authoritative answer.

### Sender identity (4 mailboxes, one Hostinger account, free aliases)

Adopted 2026-07-24 to match how larger ecommerce sites separate sender identities. All 4 share
one Hostinger mailbox/inbox via free email aliases (hPanel → Email → Bí danh email) — no extra
paid mailbox needed.

| Address | Role | Used by |
|---|---|---|
| `support@petposture.com` | **Primary** mailbox (SMTP login credential). The address customers see and can reply to. | `Reply-To` on `WelcomeEmail`, `ContactAutoReply` |
| `no-reply@petposture.com` | Alias. Send-only default sender (`MAIL_FROM_ADDRESS`); also receives internal admin notifications. | `OrderConfirmation`, `NewOrderAdmin`, `CancelledOrderAdmin`, `ContactFormSubmission`, `NewsletterConfirmation`, DMARC `rua` reports |
| `accounts@petposture.com` | Alias. Isolates the security-sensitive reset flow from general transactional mail. | `PasswordResetEmail` |
| `hello@petposture.com` | Alias. Friendlier sender for the first touchpoint. | `WelcomeEmail` |

`backend/.env` `MAIL_USERNAME` is `support@petposture.com` (matches the primary mailbox);
`MAIL_FROM_ADDRESS` stays `no-reply@petposture.com` (default sender for everything not listed
above). Changing which Hostinger mailbox is primary requires updating `MAIL_USERNAME` and
recreating the backend container (`docker compose up -d --force-recreate backend`) — editing
`.env` alone doesn't reach an already-running container, since Docker injects `env_file` values
as real process env vars at container start.

Domain sending reputation is brand-new as of the 2026-07-24 DNS fix — if messages from
`accounts@`/`hello@` start landing in spam, that's the first thing to suspect (reputation not
yet built up for those specific senders) before assuming a config regression.

---

## Deployment (VPS via Docker Compose)

The monorepo is deployed to a VPS running two long-lived Docker containers, built from
`backend/Dockerfile` and `frontend/Dockerfile.prod` and orchestrated by
`docker-compose.prod.yml` (both containers run with `network_mode: host`).

| Service | Container | Port | Tech |
|---------|-----------|------|------|
| Frontend (Next.js) | `petposture-frontend` | 3001 | Node.js |
| Backend (Laravel) | `petposture-backend` | 8001 | FrankenPHP + Caddy, via supervisord |
| Cache/Session store | `petposture-redis` | 6379 (localhost only) | Redis 7, bound to `127.0.0.1` |

FrankenPHP currently runs in **classic mode** (plain `php_server` in `Caddyfile`, no
`laravel/octane`) — Laravel still bootstraps fresh on every request. Measured directly on the
VPS (localhost, bypassing Cloudflare/network), a simple API call (`/api/settings`) has a TTFB
of ~0.77–0.81s, consistent with a full framework bootstrap on every request — this is the
main lever for reducing API latency (bigger than the Redis cache/session win). Worker mode
(persistent app in memory, Octane-style) is not enabled yet; it would need `laravel/octane` +
`octane:install --server=frankenphp`.

Two request-scoped state leaks were identified and fixed in `SetLocale` and a new
`ResetPermissionCache` middleware (both registered in `bootstrap/app.php`) as prerequisites for
worker mode — a persistent app container would otherwise let locale/permission state leak
across requests on the same worker:

- `SetLocale` (and `LanguageSwitcher`) used `config('app.locale')` — which `SetLocale` mutates
  every request — as their own fallback default, causing the "default" locale to drift to
  whatever the last request set it to. Fixed both to fall back to the never-mutated
  `config('app.fallback_locale')` instead.
- Spatie `PermissionRegistrar` keeps a local in-memory reference to roles/permissions for the
  process lifetime; a role/permission change wouldn't be reflected on a persistent worker until
  restart. Fixed by adding `ResetPermissionCache` (calls `clearPermissionsCollection()` — the
  method the package itself documents for Octane/Swoole-style persistent workers) to both the
  `web` and `api` middleware groups. Deliberately *not* `forgetCachedPermissions()`, which also
  deletes the shared cross-request cache store entry and would force a full DB rebuild on every
  single request, negating the point of caching permissions at all.

A follow-up audit found and fixed 3 more request-scoped state leaks (`SetLocale` mutating
`lunar.orders.statuses` off its own previous output instead of the pristine config file;
`SetLocale` only running on the `web` middleware group while its global side effects — Carbon
locale, PHP `setlocale()`, the MySQL session's `lc_time_names` — are process-wide, so `api`
requests need it too; and `Lunar\Admin\Support\CustomerStatus` having the same locale-memoization
bug as `OrderStatus`). Worker mode is still **not enabled** — see "Cloudflare edge caching"
below for the approach actually adopted instead. Revisit worker mode only if checkout/account
TTFB specifically becomes a measured problem; this audit work carries over if so.

### Cloudflare edge caching (adopted instead of worker mode, for now)

Rather than accept worker mode's state-leak risk class for a payment-handling site, the
highest-traffic, non-personalized part of the API (product/brand/post/content catalog reads) is
cached at Cloudflare's edge instead — checkout/cart/account/admin are untouched and still hit
Laravel on every request.

- **Cache Rule** on the `petposture.com` zone caches `GET` requests to `/api/products*`,
  `/api/brands*`, `/api/posts*`, `/api/settings`, `/api/categories`, `/api/blog/categories`, and
  `/api/checkout/payment-methods` — 5 min edge TTL, 60s browser TTL, `override_origin` (Laravel
  sends `Cache-Control: private` by default, so the rule must explicitly override it).
- **Purge on write**: `App\Services\CloudflareCacheService::purgeAll()` runs whenever a Product,
  Brand, Post, or Setting is saved/deleted (via 4 model observers). It calls Cloudflare's
  `purge_everything`, not a targeted per-URL purge — purging by specific URL (`files` array) was
  verified in production to silently do nothing for entries cached via `override_origin` when
  the origin sends `Cache-Control: private` (undocumented by Cloudflare; found by testing).
  Admin saves are infrequent, so a full-zone purge's cost is negligible.
- `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ZONE_ID` live only in the VPS's `backend/.env` (see
  `.env.example` for how to generate a token — Cloudflare only shows it once, at creation).
  Without them set, `CloudflareCacheService` no-ops safely.
- **Never add a personalized/authenticated endpoint to this Cache Rule.**

### Backend container processes (supervisord)

The backend container runs three processes side by side:

- `frankenphp` — serves the app
- `php artisan queue:work` — processes the database queue, so queued jobs (order confirmation
  emails, lifecycle emails, IP-intelligence lookups, outbound webhooks) actually get processed
  instead of piling up unprocessed in the `jobs` table
- `php artisan schedule:work` — runs Laravel's scheduler (added 2026-07-25 alongside
  `returns:expire-overdue`, the first scheduled command in the project — see `routes/console.php`).
  Without this process, anything registered via `Schedule::command()` silently never runs; there's
  no OS-level cron on the container, so this long-running process is the only thing driving it.

The container's entrypoint also runs `php artisan migrate --force` and cache-warms
(`config:cache`, `route:cache`, `view:cache`, `event:cache`) on every start/restart.

### Redis

`docker-compose.prod.yml` runs a `redis:7-alpine` container (`petposture-redis`), bound to
`127.0.0.1` only (not exposed publicly), with a named volume (`redis_data`) for persistence.
Laravel connects to it via `predis/predis` (`REDIS_CLIENT=predis` in `backend/.env`) and uses
it for both `CACHE_STORE` and `SESSION_DRIVER`.

### Stripe config: DB `Setting` overrides `.env`

Stripe credentials can be set two ways: `backend/.env` (`STRIPE_KEY`/`STRIPE_SECRET`/
`STRIPE_WEBHOOK_SECRET`) or the Admin Settings UI (Filament → Manage Settings → Payment tab),
which writes to the `settings` DB table and takes priority. **Every Stripe-reading class must
resolve credentials the same way** — `Setting::get('stripe_key') ?: config('services.stripe.key')`
(and same for `stripe_secret`/`stripe_webhook_secret`), cached for 5 minutes under cache keys
`stripe_key`/`stripe_secret`/`stripe_webhook_secret` (invalidated on Settings save). Both
`StripePaymentIntentService` and `StripeCardGateway` follow this pattern now — `StripeCardGateway`
used to read `config()` directly, which meant `/api/checkout/payment-methods` reported
`mode: placeholder` (no live Stripe.js/card Element mounted) even though credentials were saved
in the DB and payment-intent creation succeeded, breaking checkout with "Stripe card form is not
ready yet." If you add another Stripe-touching class, follow the same DB-first pattern.

### PayPal config: DB `Setting` overrides `.env` (same pattern as Stripe)

PayPal credentials follow the exact same DB-first pattern as Stripe: `backend/.env`
(`PAYPAL_MODE`/`PAYPAL_CLIENT_ID`/`PAYPAL_CLIENT_SECRET`/`PAYPAL_WEBHOOK_ID`) or the Admin
Settings UI (Filament → Manage Settings → Payment tab), which writes to the `settings` DB table
and takes priority. `PayPalService` resolves `client_id`/`client_secret`/`mode`/`webhook_id` via
`Setting::get('paypal_*') ?: config('services.paypal.*')`, cached 5 minutes (invalidated on
Settings save). Without real sandbox credentials entered, checkout falls back to a placeholder
mode (fake `PAYPAL-PLACEHOLDER-...`/`CAPTURE-PLACEHOLDER-...` IDs, no real PayPal Smart Buttons
rendered) so the checkout flow still works end-to-end for testing other payment methods.

### Airwallex / Payoneer / PingPong config (redirect-checkout gateways, added 2026-08-07)

Three more payment methods, all **redirect/hosted-checkout** (customer is bounced to the
gateway's own payment page and back — no embedded card field or popup), same DB-`Setting`-
overrides-`.env` credential pattern as Stripe/PayPal: `AirwallexService`, `PayoneerService`,
`PingPongService` (`app/Services/`) + `AirwallexGateway`/`PayoneerGateway`/`PingPongGateway`
(`app/Payments/Gateways/`), configured in Filament → Settings → Payment (new tabs) or
`backend/.env` (`AIRWALLEX_*`/`PAYONEER_*`/`PINGPONG_*`, see `.env.example`). Without real
credentials, each falls back to placeholder mode exactly like Stripe/PayPal — the redirect
target becomes the success page directly, so the checkout flow still completes end-to-end for
testing. A shared `payment_webhook_events` table (`gateway` + `event_id` unique) and
`OrderOperationsService::syncRedirectGatewayPayment()` handle webhook idempotency/state
transitions for all three at once, instead of three near-duplicate tables/methods like
Stripe/PayPal each got. **Before enabling live mode**: Payoneer's and Airwallex's exact
request/response API shapes were not confirmable against live docs when built and are
best-effort reconstructions — verify against a real sandbox account before flipping
`PAYONEER_MODE`/`AIRWALLEX_MODE` to `live`. PingPong's `prePay` fields are doc-verified, but its
RSA signing format should still be checked against PingPong's own Signature Guide first.

### Standard deploy (from a local clone with SSH access to the VPS)

```bash
ssh root@<vps-ip> "cd /opt/petposture && git pull origin main \
  && docker compose -f docker-compose.prod.yml build backend frontend \
  && docker compose -f docker-compose.prod.yml up -d --force-recreate backend frontend \
  && sleep 10 \
  && docker exec petposture-backend php artisan optimize:clear"
```

Build/recreate only `backend` or only `frontend` if the change is isolated to one side.

### `.env` files

`backend/.env` and `frontend/.env` live directly on the VPS at `/opt/petposture/` (not
committed to Git) and are mounted into the containers via `env_file:` in
`docker-compose.prod.yml`.

---

## Local Setup

### Backend

```bash
cd backend
cp .env.example .env
composer install
php artisan key:generate
php artisan migrate --seed
php artisan serve
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at `http://localhost:3000`, backend at `http://localhost:8000`.

**Troubleshooting a local admin panel resource that 404s or is missing from the sidebar**: try
`php artisan filament:optimize-clear`, which clears a stale `bootstrap/cache/filament` component
cache that can silently hide/404 a resource added or changed since the cache was last built.
(`APP_URL` intentionally stays pointed at the production domain even in local `.env` — it's only
used for generating absolute URLs, e.g. in emails; if you click a Filament-generated sidebar link
while running `php artisan serve` locally, it'll follow `APP_URL` to production instead of
staying local — expected, not a bug.)

### Docker

```bash
docker-compose up -d
```

---

## Testing & Code Quality

```bash
cd backend
composer format   # Pint (Laravel preset)
composer analyse   # PHPStan level 3
php artisan test   # PHPUnit feature/unit suite
```

`php artisan test` currently has ~21 pre-existing failures unrelated to feature work in progress
(`AdminAuthTest`, `CartApiTest`, `CheckoutApiTest` — a role/language seeding collision between a
migration and test setup; see `ARCHITECTURE.md`'s "Known gap" note). New work should still add
its own passing tests; don't let the pre-existing red mask a new regression.

```bash
cd frontend
npm run lint       # ESLint (no Prettier — see RULES.md)
npx tsc --noEmit    # TypeScript strict-mode check
```

---

## API Endpoints

| Group | Prefix |
|-------|--------|
| Auth | `/api/login`, `/api/register`, `/api/auth/forgot-password`, `/api/auth/reset-password` |
| Products & Reviews | `/api/products/...` (incl. `/api/products/{slug}/reviews`) |
| Categories | `/api/categories/...` |
| Cart & Checkout | `/api/cart/...`, `/api/checkout/place-order`, `/api/checkout/shipping-rates`, `/api/checkout/tax-quote`, `/api/checkout/payment-intent`, `/api/checkout/paypal-order`, `/api/checkout/paypal-capture`, `/api/checkout/airwallex-session`, `/api/checkout/payoneer-session`, `/api/checkout/pingpong-session`, `/api/apply-coupon` |
| Orders | `/api/orders/...` (authenticated, scoped to the customer), `/api/orders/track` (public, reference + email), `/api/orders/by-payment-session` (public, resolves an order by `gateway`+`session_id` — used by the checkout success page after a redirect-gateway payment) |
| Return Requests | `/api/orders/return-requests` (public, create), `/api/admin/return-requests/...` (list/approve/reject/complete) |
| Customer account | `/api/me/addresses` (authenticated address book) |
| Blog / Posts | `/api/posts/...` |
| Settings / Content | `/api/settings/...`, `/api/content/...` |
| Newsletter | `/api/newsletter/subscribe` (fired from the checkout "email me with news and offers" opt-in) |
| Stripe webhook | `/api/webhooks/stripe` |
| PayPal webhook | `/api/webhooks/paypal` |
| Airwallex / Payoneer / PingPong webhooks | `/api/webhooks/airwallex`, `/api/webhooks/payoneer`, `/api/webhooks/pingpong` |
| AfterShip webhook | `/api/webhooks/aftership` (HMAC-verified, auto-marks orders delivered) |
| Affiliate click redirect | `GET /go/{post}/{item}` (not under `/api` — a top-level `routes/web.php` route, logs the click then 302s to the retailer) |

---

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for a detailed system diagram and request flow.

---

## License

Proprietary — All rights reserved.

<p align="center"><b>© 2026 PetPosture</b></p>
