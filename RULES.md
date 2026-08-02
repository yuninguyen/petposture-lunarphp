# PetPosture — Rules

Read this before touching code. See `ARCHITECTURE.md` for the why; this file is just the enforceable rules.

## Coding conventions

**PHP (backend)**
- Laravel Pint (`laravel` preset) formats everything — run `composer format` before committing PHP, don't hand-format.
- `larastan`/PHPStan level 3 (`phpstan.neon`) — run `composer analyse`.
- Constructor property promotion + `private readonly` for service dependencies (`public function __construct(private readonly XService $x)`).
- One class per concern in `app/Services/*.php`. Controllers validate + delegate to a service; they do not contain business logic.
- Business-rule rejections throw `ValidationException::withMessages([...])` from the **service**, not the controller — let Laravel's default handler format the 422.
- Never mutate order status by hand (`$order->update(['status' => ...])`). Always go through `OrderOperationsService::update()`/`performAction()` so the state machine, emails, and webhooks stay in sync.
- New scalar/mutable order state → `meta` JSON key. New relational/audited data (multiple rows, own lifecycle) → its own migration + model, matching the `order_events` / `order_return_requests` / `order_shipments` precedent.
- Shipment tracking numbers are **required**, never silently defaulted (no "fall back to the order reference" placeholder) — `OrderOperationsService::update()`/`recordShipment()` both throw `ValidationException` on a blank `tracking_number` rather than inventing one.
- Refund reasons are a fixed select (`OrderOperationsService::REFUND_REASON_LABELS`), not free text — keeps refund-without-return cases reportable/auditable. Add new reasons to that const, don't accept an arbitrary string.
- Adding a `Schedule::command(...)` to `routes/console.php` does nothing by itself — `supervisord.conf` must also run `php artisan schedule:work` (there's no OS cron in the container). Always add/verify both together.
- Comments: sparse, by convention. Only for non-obvious *why* (a workaround, a hidden constraint). Never restate what the code already says.
- Filament resources: auto-discovered, no manual registration. Commerce resources go in `getNavigationGroup() { return __('lunarpanel::global.sections.sales'); }` — don't invent a new nav group.
- Order has three distinct status fields (`status`, `meta.payment_status`, `meta.fulfillment_status` — see `ARCHITECTURE.md`) with overlapping but different value sets. Never label a badge/column ambiguously as just "Status" or "Fulfillment Status" — use "Order Status" for the `status` column specifically; `meta.fulfillment_status` already owns the "Fulfillment Status" name (it's customer-facing via `Api\OrderResource`) and must not be reused for something else in the admin panel.
- Mail Blade views (`resources/views/mail/*.blade.php`) have no CSS inliner — every base style must stay inline on the element. `@media` breakpoints are **additive only**: add classes alongside the existing inline styles (see the `.stack-col`/`.stack-gap`/`.full-col`/`.mail-px` pattern, `ARCHITECTURE.md`), never delete or replace an inline style to "clean up," since non-`@media`-aware clients (older Outlook) only ever see the inline styles.
- Raw SQL against `attribute_data` (Lunar's JSON attribute column) — e.g. the `breed`/`solution`/`badge`/`q` filters in `ProductController@index` — must cast with `CAST(attribute_data AS CHAR)`. `AS TEXT` is Postgres-only and silently 500s every request on this MySQL database; this exact mistake shipped and broke the `badge`/`q` filters for a while before being caught (2026-08-02).

**TypeScript/React (frontend)**
- `"use client"` is the literal first line of the file, no blank line before it, blank line after, then imports.
- Pages (`app/**/page.tsx`) are thin wrappers that render one component from `components/`. All logic lives in the component.
- No new state-management library, no axios/swr/react-query. Use `fetch()` against `getApiBaseUrl()` (`lib/api.ts`). This is deliberate — don't add a data-fetching library to "improve" it.
- Any component using `useSearchParams()` must wrap its default export in `<Suspense>` — the App Router build fails otherwise.
- ESLint flat config (`eslint-config-next`) — run `npm run lint`. No Prettier; ESLint is the only formatter config present, don't add one.
- **Read `frontend/AGENTS.md` before writing non-trivial Next.js/React code.** This Next.js/React version postdates most model training data; check `node_modules/next/dist/docs/` for APIs you're unsure about instead of assuming.
- Body/label text should use the design-token scale (`text-xs`/`text-sm`/etc., `tailwind.config.ts`) where possible, not arbitrary `text-[Npx]` values — a repo-wide sweep (2026-07-30) found ~365 hardcoded-px text sizes with no responsive breakpoint, several unreadably small on mobile. When a spot genuinely needs a value off the token scale, pair it with a `md:` breakpoint (e.g. `text-[13px] md:text-[16px]`) rather than one fixed size for every viewport — desktop-only elements (`hidden md:block` nav, etc.) don't need a mobile variant at all.
- Guest-owned data tied to a user (saved address, wishlist, …) is **localStorage-only for guests, server-only once logged in, with no merge-on-login** — established by checkout's guest "save address" and repeated for the wishlist (`ARCHITECTURE.md`). Don't build a guest→account sync/merge step unless explicitly asked; the existing precedent deliberately keeps guest data device-local and throwaway.

## Error handling

- **Controllers**: validate with `Validator::make(...)->validate()` or inline `ValidationException`; wrap risky calls in `try { ... } catch (ValidationException $e) { throw $e; } catch (\Throwable $e) { Log::error(...); return response()->json(['message' => ..., 'code' => ErrorCode::X->value], 4xx/5xx); }`. Let `ValidationException` bubble — don't catch-and-reformat it.
- **Services**: throw `ValidationException::withMessages(['field' => ['message']])` for business-rule failures. This is the only exception type application code should throw for expected failure cases.
- **Non-critical external calls** (AfterShip, IP intelligence, etc.): `catch (\Throwable $e) { Log::warning(...); }` — no rethrow, no user-facing error. These are side effects, not the main flow.
- **Frontend**: every `fetch()` call checks `res.ok`, reads `errorData.message` from the JSON body for the user-facing error, and never throws an unhandled promise rejection into the UI — always caught and surfaced as a state variable.
- Never swallow an exception silently (empty catch block). Log it, even for soft-fail paths.

## Docker / deploy

- Backend image: `dunglas/frankenphp:1.2-php8.3-alpine`, `composer install --no-dev --optimize-autoloader --no-scripts`, supervisord runs FrankenPHP + queue worker + scheduler (`schedule:work`) together. Migrations run automatically on container start — don't add a manual migrate step to the deploy script.
- Frontend image (`Dockerfile.prod`): single-stage `node:20-alpine`, `npm ci && npm run build`, runs custom `server.js` (not `next start`).
- `docker-compose.prod.yml`: all three services (`redis`, `backend`, `frontend`) use `network_mode: host`. Don't add a bridge network or a `ports:` section — that's not how this stack is wired.
- Deploy = SSH to VPS → `git pull` → `docker compose -f docker-compose.prod.yml build <service>` → `up -d --force-recreate <service>`. There is no CI pipeline; `build.js` (repo root, runs on `git push`) is a local push-time smoke build only — it does **not** run on the VPS and does **not** run tests/lint.
- **Local backend dev deps get wiped on every `git push`**: `build.js`'s push-hook smoke build runs `composer install --no-dev`, which strips Pint/PHPStan/Pail/PHPUnit/Faker from the local `backend/vendor/`. If `php artisan serve` (or anything needing those) errors with `Class "Laravel\Pail\PailServiceProvider" not found` right after a push, run `composer install` (no flag) again before debugging further — it's not a real regression.
- **Never leave a hotpatch (`docker cp` into a running container) undeployed.** It's for same-session testing only — the next real deploy (`git pull` + rebuild) silently overwrites it. Always follow up with a real commit + push + redeploy once a change is approved.
- After every deploy: run `npx gitnexus analyze` (per root `CLAUDE.md`) and run `php artisan optimize:clear` inside the backend container.
- After every **frontend** deploy: also manually purge Cloudflare (`docker exec petposture-backend php artisan tinker --execute='app(App\Services\CloudflareCacheService::class)->purgeAll();'`) and verify with a public `curl` — `/checkout` has been observed served stale from the edge otherwise (see `ARCHITECTURE.md` known-gap note). Don't assume the deploy took effect just because the container restarted cleanly.
- **Never probe the live public domain (`petposture.com`/`api.petposture.com`) with automated/scripted requests** (checking for exposed `.env`, looping to test rate limits, etc.) — a host-level `fail2ban` jail (`nginx-badbots`, see `ARCHITECTURE.md`) bans an IP from *every path, every site on the VPS* on a single matched scanner-pattern request, and that ban has already collaterally locked out a real customer sharing a CGNAT IP with the probing session. Probe `127.0.0.1:8001` (backend) / `127.0.0.1:3001` (frontend) directly on the VPS instead — bypasses Cloudflare and this nginx layer entirely, same result, zero blast radius. If you must hit the public domain to test edge-layer behavior specifically, keep it to one or two requests, not a loop.
- **A "Googlebot"/"bingbot"/etc. User-Agent in `nginx`/fail2ban logs is not proof of the real crawler** — scanners routinely spoof well-known good-bot UA strings to blend in or evade naive allowlists. Verify via the IP's actual owner (`curl "http://ip-api.com/json/<ip>?fields=isp,org,as,reverse"` — no `whois` binary needed) before treating a ban as a false positive or before ever whitelisting a UA string outright.

## Forbidden / avoid

- `laravel/cashier` — Stripe is integrated by hand (`StripePaymentIntentService` + custom gateway). Don't introduce Cashier.
- A third-party PayPal SDK package (`srmklive/paypal`, `paypal/paypal-checkout-sdk`, etc.) — PayPal is integrated by hand (`PayPalService` + `Payments/Gateways/PayPalGateway.php`), mirroring the Stripe pattern. Don't introduce a PayPal SDK package.
- Any frontend state library (Redux, Zustand, Jotai, etc.) or data-fetching library (axios, SWR, React Query) — not present, not wanted. Plain `fetch()`.
- Prettier — no config exists; don't add one, ESLint is the single source of formatting truth on the frontend.
- Markdown-based Mailables (`Content(markdown: ...)`) for anything customer-facing — all customer emails are custom `Content(view: ...)` Blade for design control. New customer emails follow that pattern, not Lunar's/Laravel's default markdown mail.
- Manual order `status` writes outside `OrderOperationsService` — breaks the state machine, the customer emails, and the outbound webhook dispatch that are all wired to go through it.
- `--no-verify` / `--no-gpg-sign` on git operations, and destructive git commands (`reset --hard`, `push --force`) without explicit user instruction.
