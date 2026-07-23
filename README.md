# PetPosture

An e-commerce platform for pet posture products, built as a monorepo with Next.js (frontend) and Laravel + Lunar PHP (backend).

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
| Payments | Stripe (cards, incl. Radar fraud scoring) + Cash on Delivery |
| Database | MySQL |
| Cache & Session | Redis (via `predis/predis`) |
| Queue | Database driver, processed by a `queue:work` process (supervisord) |
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
│   ├── supervisord.conf        # Runs frankenphp + queue:work together
│   └── routes/api.php
├── docker-compose.prod.yml     # VPS deployment (backend + frontend containers)
└── docker-compose.yml          # Local dev
```

---

## Features

- Product catalog with categories, variants, attributes, and brands
- Shopping cart & checkout flow (guest + authenticated), COD and Stripe card payments
- Customer account dashboard (`/account`): order history with expandable order detail
  (items, shipping/billing address, tracking, payment status), saved addresses, profile info
- Order management & tracking, with a WooCommerce-style admin order view:
  status actions (mark paid/processing/shipped/delivered/cancel), refunds (full/partial via Stripe),
  shipment tracking with carrier links, an auto-updating Order Notes activity timeline, and an
  "Adjust Shipping" action for manually correcting a miscalculated order total
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
- Blog with slug-based routing
- Discount / coupon codes (Lunar's discount engine, incl. free-shipping coupons)
- Self-service order returns (`/returns`): guest lookup by order number + email, item/quantity
  selection, reason and note — reviewed in Filament (Sales > Return Requests) with
  approve (RMA address + estimated refund, emails the customer), reject (with a reason), or mark
  received actions. The 30-day return window from the published Return & Refund Policy is
  enforced both in the UI (dimmed/disabled past the window) and server-side on submission.
  Refunding is still a separate, manual action on the order itself — nothing here auto-triggers it.
- Automatic "delivered" detection via an AfterShip tracking webhook (`/api/webhooks/aftership`,
  HMAC-verified) — no more manually checking carrier tracking pages to close out an order
- Product reviews (storefront submit + admin moderation)
- Multi-language support
- SEO metadata & automatic sitemap
- Static policy pages (FAQ, privacy, shipping, returns, etc.)
- Full Filament admin panel with custom dark sidebar theme
- Role-based access control via Filament Shield

---

## Email deliverability & branding (DNS)

`no-reply@petposture.com` sends through Hostinger SMTP (`smtp.hostinger.com`), with SPF and
DKIM (`hostingermail-a/b/c._domainkey`) already aligned to that relay.

- **BIMI**: `default._bimi.petposture.com` TXT record points at
  `https://petposture.com/assets/bimi-logo.svg` (a hand-built SVG Tiny PS reproduction of the
  paw icon mark — square viewBox, no scripts/external refs, per BIMI's spec). This is what lets
  Gmail/Yahoo show the brand logo next to the sender name, instead of a generic avatar.
- **DMARC** was raised from `p=none` (monitor-only) to `p=quarantine; pct=25` — required by
  Gmail for BIMI to take effect at all. `pct=25` staggers enforcement to a quarter of mail
  rather than jumping straight to 100%, specifically to limit blast radius while monitoring
  aggregate reports (`rua=mailto:no-reply@petposture.com`) for a few weeks before considering
  `pct=100`. If deliverability problems show up, roll back to `p=none` first and investigate.
- Both DNS changes propagate on their own schedule (TTL 3600s) and Gmail may take additional
  days beyond that to crawl and start showing the BIMI logo — absence right after the DNS
  change lands is expected, not a sign of misconfiguration.

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

The backend container runs two processes side by side so queued jobs (order confirmation
emails, lifecycle emails, IP-intelligence lookups, outbound webhooks) actually get processed
instead of piling up unprocessed in the `jobs` table:

- `frankenphp` — serves the app
- `php artisan queue:work` — processes the database queue

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

### Docker

```bash
docker-compose up -d
```

---

## API Endpoints

| Group | Prefix |
|-------|--------|
| Auth | `/api/login`, `/api/register`, `/api/auth/forgot-password`, `/api/auth/reset-password` |
| Products & Reviews | `/api/products/...` (incl. `/api/products/{slug}/reviews`) |
| Categories | `/api/categories/...` |
| Cart & Checkout | `/api/cart/...`, `/api/checkout/place-order`, `/api/checkout/shipping-rates`, `/api/checkout/tax-quote`, `/api/checkout/payment-intent`, `/api/apply-coupon` |
| Orders | `/api/orders/...` (authenticated, scoped to the customer), `/api/orders/track` (public, reference + email) |
| Return Requests | `/api/orders/return-requests` (public, create), `/api/admin/return-requests/...` (list/approve/reject/complete) |
| Customer account | `/api/me/addresses` (authenticated address book) |
| Blog / Posts | `/api/posts/...` |
| Settings / Content | `/api/settings/...`, `/api/content/...` |
| Newsletter | `/api/newsletter/subscribe` (fired from the checkout "email me with news and offers" opt-in) |
| Stripe webhook | `/api/webhooks/stripe` |
| AfterShip webhook | `/api/webhooks/aftership` (HMAC-verified, auto-marks orders delivered) |

---

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for a detailed system diagram and request flow.

---

## License

MIT
