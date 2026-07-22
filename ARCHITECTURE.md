# PetPosture — Architecture

Headless e-commerce: **Next.js 16 (App Router)** storefront + **Laravel 11 / Lunar PHP** commerce API, both deployed as separate Docker containers on a single VPS behind Cloudflare. No Vercel, no separate CI service — a `build.js` script run on `git push` is the entire deploy pipeline.

## System diagram

```mermaid
graph TB
    Browser["Browser"]
    CF["Cloudflare (DNS, cache, BIC, DMARC)"]

    subgraph VPS["VPS — docker-compose.prod.yml (network_mode: host)"]
        FE["frontend container<br/>Next.js server.js :3001"]
        BE["backend container<br/>FrankenPHP + Caddy :8001<br/>+ supervisord queue worker"]
        Redis["redis:7-alpine :6379<br/>(127.0.0.1 only)"]
        MySQL["MySQL (external/managed)"]
    end

    Stripe["Stripe API"]
    AfterShip["AfterShip API"]

    Browser -->|HTTPS petposture.com| CF --> FE
    Browser -->|HTTPS api.petposture.com| CF --> BE
    FE -->|fetch, getApiBaseUrl()| BE
    BE --> MySQL
    BE --> Redis
    BE -->|payment intents, refunds| Stripe
    BE -->|tracking webhooks| AfterShip
    Stripe -->|webhook| BE
    AfterShip -->|webhook| BE
```

## Frontend — `frontend/`

- **Next.js 16.2.3, React 19.2.4**, App Router only (`app/`), TypeScript strict mode.
- **No state library, no axios/swr/react-query.** Every API call is a plain `fetch()` against `getApiBaseUrl()` (`frontend/lib/api.ts`), which resolves the backend origin from `NEXT_PUBLIC_API_URL` (prod) or `127.0.0.1:8000` (local dev).
- Pages live in `app/<route>/page.tsx` and are thin — they just import and render a matching component from `components/` (e.g. `app/returns/page.tsx` → `components/RequestReturnPage.tsx`). All real UI logic lives in `components/`.
- `components/` is flat for top-level pages (`ShopPage.tsx`, `RequestReturnPage.tsx`, `ReturnRefundPolicyPage.tsx`, …) with subfolders for cross-cutting concerns: `components/auth/`, `components/checkout/`, `components/orders/`, `components/product/`, `components/shop/`.
- Auth: Sanctum bearer token issued by the backend, stored client-side via `context/AuthContext`, also mirrored into an httpOnly `petposture_token` cookie by the backend on login.
- Pages that read `useSearchParams()` (e.g. `checkout/success`, `returns`) always wrap the content in `<Suspense>` at the default-export level — required by the App Router, not optional.
- Styling: Tailwind v4, no CSS-in-JS. Animation: `framer-motion`. Icons: `lucide-react`.
- Production runs a custom `server.js` (not `next start`) inside `Dockerfile.prod` — single-stage Node 20 Alpine image, `npm run build` at image build time.
- **`frontend/AGENTS.md` is load-bearing, not boilerplate**: this Next.js/React version is newer than most training data — read `node_modules/next/dist/docs/` before writing anything non-trivial.

## Backend — `backend/`

- **Laravel 11**, PHP 8.3, no `Kernel.php` (`bootstrap/app.php`-based config). **Lunar PHP 1.x** is the commerce core (`Order`, `OrderLine`, `Customer`, `Product` models come from `Lunar\Models\*`, not app-owned models).
- **App-owned commerce logic sits in `app/Services/*.php`**, one class per concern (`OrderOperationsService`, `ReturnRequestService`, `CheckoutService`, `StripePaymentIntentService`, `AfterShipService`, `ShippingService`, `SalesTaxService`, …). Controllers stay thin: validate → call a service → return a `JsonResource`.
- Order lifecycle state machine lives in `app/Support/Orders/OrderStateMachine.php` — the single source of truth for allowed status transitions (`awaiting-payment → payment-offline/payment-received/cancelled → processing → shipped → delivered`). Never hand-roll a status transition; go through `OrderOperationsService::update()`/`performAction()`, which calls the state machine and fires the matching customer email + webhook.
- Order metadata (payment/refund/shipment/fulfillment state, timestamps) is stored in the `lunar_orders.meta` JSON column, not new columns — this is the established extension point for anything scalar/mutable on an order. New **relational, multi-row, audited** concepts (e.g. `order_events`, `order_return_requests` + `order_return_request_items`) get their own migration/table instead.
- **Admin panel = Filament 3**, auto-discovered from `app/Filament/Resources/*.php` (no manual registration). Resources are grouped via `getNavigationGroup()`; commerce resources (Orders, Return Requests, Shipping Costs, Discounts, Customer Groups, Customers, Reviews) all share the `lunarpanel::global.sections.sales` group — don't invent a new group name for a new commerce resource.
- **API auth**: Laravel Sanctum, backed by the app's own `User` model (not `Lunar\Models\Customer` directly) — `CustomerLinkService` links a `User` to a Lunar `Customer` on registration. Guest flows (checkout, order tracking, return requests) resolve by `(order reference OR meta->tracking_number) + customer_reference email`, no auth required, always throttled.
- **Transactional email**: custom Blade views under `resources/views/mail/*.blade.php` (not Laravel's markdown mail for anything customer-facing today — those were migrated off markdown to full custom HTML for design control). Every mail view needs the font-family inline on *every* element (no CSS inliner runs for `Content(view: …)` mailables) and the logo via `$message->embed()` for real `Content-ID` embedding — Gmail strips `data:` URIs and hosted-URL images get blocked by BIC in some clients.
- **Payments**: Stripe, custom integration (no `laravel/cashier`) via `StripePaymentIntentService` + `Payments/Gateways/StripeCardGateway.php`. Stripe keys/webhook secret are DB `Setting` values (5-min cache), falling back to `.env` — always read both places the same way `StripePaymentIntentService` does, or checkout breaks silently.
- **Shipment tracking**: AfterShip webhook (`/api/webhooks/aftership`) auto-marks orders delivered; HMAC-verified, no auth middleware (self-verifying).

## Data flow: adding a customer-facing feature (reference shape)

The "Request a Return" feature (Phase 1) is the current reference implementation for this shape — new features should follow it:

1. Migration + model(s) in `app/Models/` (dedicated table if the data is relational/audited, `meta` JSON if it's scalar order state).
2. A single `App\Services\*Service` class owns all mutation + validation logic (`ValidationException::withMessages()` for business-rule rejections) and fires customer email(s) directly (`Mail::to(...)->send(...)`) — no queued job unless the trigger is a webhook/background event.
3. `App\Http\Resources\Api\*Resource` (`JsonResource`) for the API shape; controller stays a thin validate-then-delegate layer.
4. Routes: public/guest routes at top level of `routes/api.php` (throttled), admin routes inside the existing `Route::prefix('/admin')->middleware(['auth:sanctum', 'role:...'])` group, authenticated-customer routes inside the existing bare `auth:sanctum` group.
5. Filament `Resource` for admin review/action if staff need to work the queue (approve/reject/complete-style actions as `Tables\Actions\Action::make()` with a `->form([...])` modal, not a full edit page).
6. Frontend: a `components/<Name>Page.tsx` + thin `app/<route>/page.tsx`, reusing the existing guest-lookup pattern (`/api/orders/track`-style reference+email lookup) rather than inventing a new one.
7. Deploy: `git push` (runs `build.js`) → SSH to VPS → `git pull && docker compose -f docker-compose.prod.yml build <service> && up -d --force-recreate <service>` → `php artisan migrate --force` runs automatically via the backend container's entrypoint on every start.

## Deployment

- **No CI service.** `build.js` at the repo root runs on `git push` (see `RULES.md` for exact steps) — it installs deps and runs both production builds locally as a push-time smoke test. It does **not** run tests or linters.
- **Production**: single VPS, `docker-compose.prod.yml`, three services (`redis`, `backend`, `frontend`), all `network_mode: host` — no bridge networking, no port-mapping section, ports are just whatever `$PORT` each app binds to.
- Manual deploy after every merge: SSH in, `git pull`, `docker compose build` the changed service(s), `up -d --force-recreate`. Migrations run automatically on backend container start (baked into the Docker entrypoint), but hotpatching a single file via `docker cp` for a quick test does **not** persist — always follow up with the real `git pull` + rebuild, or the next deploy silently reverts the hotpatch.
- GitNexus (`npx gitnexus analyze`) reindexes the code graph — run it after every deploy per root `CLAUDE.md`.

---
*Superseded content removed: this file previously described a generic Vercel-hosted Next.js + "database TBD" architecture that never reflected this project. See `backend/README.md` / `frontend/README.md` for narrower per-app notes.*
