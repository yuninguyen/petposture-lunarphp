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
- New scalar/mutable order state → `meta` JSON key. New relational/audited data (multiple rows, own lifecycle) → its own migration + model, matching the `order_events` / `order_return_requests` precedent.
- Comments: sparse, by convention. Only for non-obvious *why* (a workaround, a hidden constraint). Never restate what the code already says.
- Filament resources: auto-discovered, no manual registration. Commerce resources go in `getNavigationGroup() { return __('lunarpanel::global.sections.sales'); }` — don't invent a new nav group.

**TypeScript/React (frontend)**
- `"use client"` is the literal first line of the file, no blank line before it, blank line after, then imports.
- Pages (`app/**/page.tsx`) are thin wrappers that render one component from `components/`. All logic lives in the component.
- No new state-management library, no axios/swr/react-query. Use `fetch()` against `getApiBaseUrl()` (`lib/api.ts`). This is deliberate — don't add a data-fetching library to "improve" it.
- Any component using `useSearchParams()` must wrap its default export in `<Suspense>` — the App Router build fails otherwise.
- ESLint flat config (`eslint-config-next`) — run `npm run lint`. No Prettier; ESLint is the only formatter config present, don't add one.
- **Read `frontend/AGENTS.md` before writing non-trivial Next.js/React code.** This Next.js/React version postdates most model training data; check `node_modules/next/dist/docs/` for APIs you're unsure about instead of assuming.

## Error handling

- **Controllers**: validate with `Validator::make(...)->validate()` or inline `ValidationException`; wrap risky calls in `try { ... } catch (ValidationException $e) { throw $e; } catch (\Throwable $e) { Log::error(...); return response()->json(['message' => ..., 'code' => ErrorCode::X->value], 4xx/5xx); }`. Let `ValidationException` bubble — don't catch-and-reformat it.
- **Services**: throw `ValidationException::withMessages(['field' => ['message']])` for business-rule failures. This is the only exception type application code should throw for expected failure cases.
- **Non-critical external calls** (AfterShip, IP intelligence, etc.): `catch (\Throwable $e) { Log::warning(...); }` — no rethrow, no user-facing error. These are side effects, not the main flow.
- **Frontend**: every `fetch()` call checks `res.ok`, reads `errorData.message` from the JSON body for the user-facing error, and never throws an unhandled promise rejection into the UI — always caught and surfaced as a state variable.
- Never swallow an exception silently (empty catch block). Log it, even for soft-fail paths.

## Docker / deploy

- Backend image: `dunglas/frankenphp:1.2-php8.3-alpine`, `composer install --no-dev --optimize-autoloader --no-scripts`, supervisord runs FrankenPHP + queue worker together. Migrations run automatically on container start — don't add a manual migrate step to the deploy script.
- Frontend image (`Dockerfile.prod`): single-stage `node:20-alpine`, `npm ci && npm run build`, runs custom `server.js` (not `next start`).
- `docker-compose.prod.yml`: all three services (`redis`, `backend`, `frontend`) use `network_mode: host`. Don't add a bridge network or a `ports:` section — that's not how this stack is wired.
- Deploy = SSH to VPS → `git pull` → `docker compose -f docker-compose.prod.yml build <service>` → `up -d --force-recreate <service>`. There is no CI pipeline; `build.js` (repo root, runs on `git push`) is a local push-time smoke build only — it does **not** run on the VPS and does **not** run tests/lint.
- **Never leave a hotpatch (`docker cp` into a running container) undeployed.** It's for same-session testing only — the next real deploy (`git pull` + rebuild) silently overwrites it. Always follow up with a real commit + push + redeploy once a change is approved.
- After every deploy: run `npx gitnexus analyze` (per root `CLAUDE.md`) and run `php artisan optimize:clear` inside the backend container.

## Forbidden / avoid

- `laravel/cashier` — Stripe is integrated by hand (`StripePaymentIntentService` + custom gateway). Don't introduce Cashier.
- Any frontend state library (Redux, Zustand, Jotai, etc.) or data-fetching library (axios, SWR, React Query) — not present, not wanted. Plain `fetch()`.
- Prettier — no config exists; don't add one, ESLint is the single source of formatting truth on the frontend.
- Markdown-based Mailables (`Content(markdown: ...)`) for anything customer-facing — all customer emails are custom `Content(view: ...)` Blade for design control. New customer emails follow that pattern, not Lunar's/Laravel's default markdown mail.
- Manual order `status` writes outside `OrderOperationsService` — breaks the state machine, the customer emails, and the outbound webhook dispatch that are all wired to go through it.
- `--no-verify` / `--no-gpg-sign` on git operations, and destructive git commands (`reset --hard`, `push --force`) without explicit user instruction.
