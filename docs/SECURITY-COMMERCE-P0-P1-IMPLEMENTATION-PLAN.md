# PETPOSTURE — SECURITY & COMMERCE TRUST P0/P1 IMPLEMENTATION PLAN

> **Status:** Official execution plan for ChatGPT (implementer)
> **Depends on:** `Report-CTO-System-Validation-Audit — PetPosture.md` (verified) + `PetPosture-Canonical-Implementation-Blueprint-v5.1-AUTHORITATIVE.md`
> **Scope:** Checkout/payment security, order/PII exposure, XSS, auth storage, admin permission matrix, review trust/lifecycle, email reliability, legacy data consolidation.
> **Out of scope (already covered elsewhere):** SEO canonical/sitemap/schema/claim-safety work — see `SEO-P0-P1-IMPLEMENTATION-PLAN-v1.1.md`. Do not duplicate P0-T1..T7 from that document here.
> **Verification note:** Every finding referenced below was independently re-verified against current source by Claude (grep + read) before this plan was written — not just taken from the ChatGPT audit report at face value. File:line references are accurate as of the time this plan was written; re-check line numbers before editing since other work may have shifted them.

---

# 0. EXECUTION ORDER

```text
P0 — Stop the bleeding (checkout/payment/PII/XSS)
        ↓
P1 — Trust & commerce correctness (reviews, email, roles, data consolidation)
        ↓
P2 — Quality/performance cleanup
        ↓
Security regression test suite green
```

Do not start P1 tasks before all P0 tasks pass their acceptance criteria. Do not expand content/commerce features while P0 is open.

---

# 1. P0 — CHECKOUT, PAYMENT & PII (CRITICAL)

## P0-S1 Checkout session ownership binding

**Problem:** `backend/routes/api.php:95-97` exposes
```text
GET  /checkout/session/{token}
POST /checkout/session/{token}/payment-intent
POST /checkout/session/{token}/confirm
```
with only `throttle:api-write` — no auth, no ownership check. `CheckoutSessionService` resolves the entire session (payload, payment intent, order) from token possession alone.

Tasks:

- Do not remove the token-based flow (guest checkout must keep working), but add a second binding factor:
  - if the shopper is authenticated, bind the session to `user_id` and reject access from a different authenticated user;
  - for guest checkout, bind session to a signed, short-TTL possession proof (e.g. HMAC-signed cookie set when the session is created, checked on every subsequent call) — not just the URL token;
- add explicit session states: `open → payment_pending → paid → confirmed → expired/consumed`; reject `payment-intent`/`confirm` calls on sessions not in the expected state;
- add TTL to sessions; expired sessions return 410/404, not stale data;
- rotate/invalidate the token after `confirm` succeeds so it cannot be replayed or reused for lookups;
- add idempotency key support on `payment-intent` and `confirm` so retried requests don't create duplicate payment intents/orders.

Acceptance:

- A token leaked via logs/referrer/browser-history alone can still read minimal non-sensitive session status, but cannot mutate payment state or read payment secrets without the second factor.
- Replaying `confirm` on an already-confirmed session does not create a duplicate order.
- Automated test: session A cannot be read/mutated using session B's flow context.

## P0-S2 Stop returning raw payload/payment secrets in checkout resources

Tasks:

- audit `CheckoutSessionResource` (and any resource serializing `CheckoutSessionService` output) for: raw payload echo, full payment intent object, client secret;
- strip to the minimum the frontend actually needs to render the current step;
- payment client secret should only be present in the specific response that the frontend needs it for (creating the payment element), not in general session reads.

Acceptance: `GET /checkout/session/{token}` response contains no payment client secret and no raw internal payload dump.

## P0-S3 Client-controlled checkout payload / totals

**Problem:** `CheckoutSessionService` uses `array_replace_recursive()` to merge client payload, and `subtotal_minor`/`discount_minor`/`tax_minor` can be `null` on non-empty carts.

Tasks:

- introduce a FormRequest/DTO that whitelists exactly which fields the client may set (shipping address, contact info, selected shipping method, payment method choice) — never totals, discounts, tax, payment status, or any server-computed field;
- server recomputes price/discount/tax/shipping from current product/variant/promotion state on every mutation; never trust client-sent totals;
- fix the `null` totals bug so every checkout session response has fully resolved `subtotal_minor`/`discount_minor`/`tax_minor` in minor units with currency.

Acceptance: a request that tries to override `subtotal_minor`/`discount_minor`/`tax_minor`/payment status is silently ignored (server value wins); no checkout session response ships `null` totals for a non-empty cart.

## P0-S4 Order/IDOR & tracking token

**Problem:** `OrderResource.php:36` — `'tracking_number' => $meta['tracking_number'] ?? $this->reference` uses the order reference as a de facto secret; public order lookup/retry-payment flows accept reference/email and return payment-intent data.

Tasks:

- generate a dedicated random tracking access token per order, independent of the human-readable order reference; never fall back to `$this->reference` as a trackable credential;
- create a minimal public tracking DTO (status, carrier, ETA, masked address) — do not reuse the internal `OrderResource` for any public/unauthenticated endpoint;
- public order lookup failure responses must be generic (do not reveal whether the email/reference exists) to prevent enumeration;
- rate-limit lookup/retry-payment by IP **and** by hashed email/reference/device signal, not just IP;
- retry-payment only allowed when order status is still valid/unpaid/unexpired.

Acceptance: no public endpoint returns full `OrderResource` (address/payment fields) without authentication; tracking uses its own rotatable token; failed lookups don't leak existence.

## P0-S5 XSS sanitization for CMS/API HTML

**Problem:** `dangerouslySetInnerHTML` used in `BlogPostPage.tsx`, `LegalPageLayout.tsx`, `ProductDetails.tsx` with zero sanitization anywhere in the frontend (`sanitize`/`DOMPurify` grep returns nothing).

Tasks:

- add server-side sanitization in Laravel before persisting rich-text HTML (posts, pages, product descriptions) — allowlist tags/attributes, strip `<script>`, inline event handlers (`on*`), `javascript:` URLs, disallowed `iframe` sources;
- as defense in depth, also sanitize client-side immediately before `dangerouslySetInnerHTML` (e.g. DOMPurify) in the three components listed above;
- add a CSP header (nonce or hash based) at the Next.js layer;
- add a regression test per surface (blog, legal page, product description) that submits an XSS payload and asserts it's stripped both at save-time and at render-time.

Acceptance: a `<script>`/`onerror=`/`javascript:` payload submitted through any CMS-authored field never reaches the rendered DOM unescaped.

## P0-S6 Auth token storage hardening

**Problem:** `frontend/context/AuthContext.tsx` and `admin/src/lib/auth.ts` store bearer tokens in `localStorage`; frontend also sets JS-readable cookies (`petposture_token`/`petposture_user`) alongside a separate HttpOnly cookie mechanism.

Tasks:

- pick one auth channel: HttpOnly + Secure + SameSite cookie/session, backed by Sanctum's stateful API mode (already partially enabled per `bootstrap/app.php`);
- remove the JS-readable `petposture_token`/`petposture_user` cookies and localStorage token storage once the HttpOnly flow is confirmed working for both storefront and admin;
- keep `proxy.ts` role/token checks as UI-only navigation guards — they must never be the sole gate for any admin/account action; confirm every protected admin API route is enforced server-side regardless of what the proxy allows through.

Acceptance: no bearer token or role JSON readable via `document.cookie` or `localStorage` in either app; XSS on one page can no longer directly exfiltrate a usable session token.

---

# 2. P1 — TRUST & COMMERCE CORRECTNESS

## P1-S1 Review evidence & moderation lifecycle

Extends `SEO-P0-P1-IMPLEMENTATION-PLAN-v1.1.md` P0-T3 (which only covers "don't render Verified without `is_verified`"). This task covers the full lifecycle that produces `is_verified` correctly.

**Problem:** `ProductController.php:218-230` creates a review with `customer_name`, `rating`, `comment`, `is_verified: false` hardcoded — no link to an order/customer/purchase at all, and no `status` (pending/approved) field.

Tasks:

- add `customer_id` (or guest email) + `order_id`/`order_line_id` reference to the review schema;
- a review may only be marked `is_verified = true` when the referenced order is paid/fulfilled and belongs to the same customer/email who is submitting the review;
- add a `status` column (`pending` default → `approved`/`rejected` via admin moderation); public review listing and aggregate rating must only include `approved` rows;
- add basic anti-abuse: rate limit per IP/customer, max comment length, honeypot or Turnstile on the public submit endpoint;
- the client must never be able to set `is_verified` or `status` directly — strip those from the request validation whitelist.

Acceptance: aggregate rating/`Verified` badge only reflects `approved` + `is_verified` rows tied to a real paid order; unauthenticated/unlinked submissions default to `pending`, unverified, and are excluded from public listing until approved.

## P1-S2 Review migration backfill (data integrity)

**Problem:** `backend/database/migrations/2026_07_17_000002_migrate_reviews_to_lunar_products.php` adds `lunar_product_id` and drops `product_id` without a visible mapping/backfill step — risk of orphaning reviews if this ever runs against real data.

Tasks:

- before allowing this migration (or any future run of it in a fresh environment) to touch a database with real review rows, add a preflight report (count of reviews, count mappable to a Lunar product via a stable key);
- add explicit mapping logic (legacy product → Lunar product) and fail the migration loudly if any review would become orphaned;
- only drop the legacy `product_id` column after reconciliation passes;
- document rollback steps.

Acceptance: running the migration against a database with existing reviews either fully reconciles them or fails with a clear report — it never silently orphans rows.

## P1-S3 Admin role/permission matrix

**Problem:** `User::ADMIN_PANEL_ROLES` (Filament) includes `Product Manager`, `Order Manager`, `Support` in addition to `super_admin/admin/staff`, but `backend/routes/api.php:131` gates the React-admin API with only `role:super_admin|admin|staff`. Business-specific roles can log into Filament but get 403 from the React admin API, and per-action policy enforcement (`authorize()`/Policy checks) is inconsistent across admin controllers (e.g. `PageController`, `CommentController`).

Tasks:

- build one explicit permission matrix (domain × view/create/update/delete/publish/refund) covering every role currently in `ADMIN_PANEL_ROLES`;
- align the API middleware role list with Filament's role list, or explicitly scope which roles get which API groups;
- add `authorize()`/Policy calls to every admin controller action that mutates data (start with `PageController`, `CommentController`, then sweep the rest), using the existing `ProductPolicy`/`PostPolicy` as the template;
- write a test per role × action combination for at least Products, Orders, Reviews, Posts (publish vs. edit vs. refund).

Acceptance: Filament, React admin, and the API middleware agree on who can do what; a role that can log in can perform (or be correctly denied) the actions the UI shows it.

## P1-S4 Contact form reliability

**Problem:** `ContactController.php:42,51` sends `Mail::to(...)->send(...)` synchronously inside the HTTP request — no queue, no idempotency, duplicate emails possible on client retry.

Tasks:

- persist an inbound `ContactMessage` record with an idempotency key (e.g. hash of email+message+timeframe) before sending anything;
- move the actual send to a queued job;
- track delivery state (`received/queued/sent/failed/retried`) on the record so retries don't re-send duplicates.

Acceptance: submitting the same contact form twice in quick succession (e.g. double-click, browser retry) produces one email, not two; request returns fast regardless of mail provider latency.

## P1-S5 Newsletter double opt-in

**Problem:** `NewsletterController.php:35` sets `status: 'subscribed'` immediately on signup; confirmation mail failures are only `Log::warning`'d (swallowed); frontend shows "You're in!" regardless of whether the confirmation email actually sent.

Tasks:

- new subscribers start as `status: 'pending'`;
- generate a signed, expiring confirmation token; only flip to `subscribed` when the link is clicked;
- add a signed unsubscribe link;
- if the confirmation email fails to send, surface a retryable state (not just a log line) — e.g. a `mail_status` column with a retry job;
- don't promise a discount code to an unconfirmed subscriber if business policy requires confirmation first (confirm this policy question with the user before changing copy).

Acceptance: a subscriber only reaches `subscribed` status after clicking the confirmation link; a failed confirmation send is retried, not silently dropped.

## P1-S6 Order email idempotency

**Problem:** `SendOrderConfirmationJob`/`SendOrderLifecycleEmailJob` have no visible dedup key/delivery record; `DispatchOutboundWebhook` calls `fail()` on any non-2xx, including transient 5xx, losing retry opportunities.

Tasks:

- add a delivery-log table (job type, order id, provider message id, status, attempt count) and check it before sending to avoid duplicate sends on job retry;
- fix `DispatchOutboundWebhook` to distinguish 5xx/network errors (retry with backoff) from 4xx (dead-letter/alert, don't retry forever).

Acceptance: re-running a queued order email job (e.g. after a worker crash mid-send) does not send a duplicate email; webhook 5xx gets retried, 4xx does not.

## P1-S7 Mail provider fail-fast

**Problem:** `backend/config/mail.php:17` — `env('MAIL_MAILER', 'log')` — production silently "succeeds" at the application layer while only logging if `MAIL_MAILER` isn't set correctly.

Tasks:

- add a boot-time check (e.g. in a service provider or health-check command) that fails startup/alerts loudly if `app()->environment('production')` and `config('mail.default') === 'log'`.

Acceptance: production cannot silently run on the `log` mailer without an explicit, visible failure.

## P1-S8 Future/scheduled post exposure

**Problem:** `ContentController::post()` (single post route) filters only `status='published'`, missing the `published_at <= now()` filter that `posts()` (list route) already has correctly.

Tasks:

- add `->where('published_at', '<=', now())` to the `post()` query, matching `posts()`, while preserving the existing signed-preview-token bypass for admin previews.

Acceptance: a post scheduled for the future returns 404 on its direct slug URL until `published_at` passes (unless a valid preview token is used).

---

# 3. P2 — CONSOLIDATION & PERFORMANCE

## P2-S1 Retire legacy Product model from the write path

**Problem:** `DatabaseSeeder.php` still imports `App\Models\Legacy\Product` and creates legacy category/product rows alongside Lunar products — two sources of truth.

Tasks:

- confirm (with the user) that Lunar is the sole commerce source of truth going forward;
- remove/guard the legacy seeder from running in any environment that also seeds Lunar products, or delete it if confirmed dead;
- add an invariant test: every product returned by any public API traces back to a Lunar product record.

## P2-S2 Product search & related-product performance

**Problem:** `ProductController.php` uses `LOWER(CAST(attribute_data AS CHAR)) LIKE ?` for breed/solution/badge/search filtering, and `inRandomOrder()` for related products — both unindexed/expensive at scale.

Tasks:

- move breed/solution/badge into normalized, indexed columns or a pivot table instead of matching inside a JSON blob;
- replace `inRandomOrder()` with a deterministic related-product selection (e.g. same collection, ordered by a stable key) with optional caching.

## P2-S3 `/api` vs `/api/v1` duplicate route registration

**Problem:** confirmed via code comment in `ContentController.php:51-54` — `routes/api.php` is registered twice (plain + `/api/v1` alias) in `bootstrap/app.php`, which is why named routes collide under route caching (this is why preview links use a manually-signed HMAC token instead of Laravel's signed URL helper).

Tasks:

- decide on one versioning policy: either drop the `/api/v1` alias, or make it the primary and deprecate bare `/api`;
- once decided, revisit whether the manual HMAC preview-token workaround can be replaced with Laravel's native signed routes.

---

# 4. TEST PLAN (must pass before closing this plan)

## Checkout/payment

- Session A cannot be read or mutated via session B's guest-proof/user binding.
- Expired session token is rejected.
- Confirmed session cannot be replayed to `confirm` again or produce a duplicate order.
- Attempting to override `subtotal_minor`/`discount_minor`/`tax_minor`/payment status via request body has no effect.
- `GET /checkout/session/{token}` never returns a payment client secret outside the step that needs it.

## Order/PII

- Public order lookup with a wrong reference/email returns a generic not-found response (no enumeration signal).
- Public tracking response contains no address/payment fields beyond what a minimal tracking DTO needs.
- Retry-payment is rejected for an already-paid or expired order.

## XSS

- Script/event-handler/`javascript:` payload in blog content, legal page content, and product description is stripped both at save and at render.
- CSP blocks inline script not covered by nonce/hash.

## Reviews

- A review from a customer with no matching paid order cannot be `is_verified = true`.
- Unapproved (`pending`) reviews never appear in public listing or aggregate rating.
- Client cannot set `is_verified` or `status` via the public submit endpoint.

## Admin

- Each role in `ADMIN_PANEL_ROLES` is tested against each of view/create/update/delete/publish/refund per domain; Filament, React admin, and API middleware agree.

## Email

- Duplicate contact-form submission (same content, short window) sends one email.
- Newsletter subscriber stays `pending` until confirmation link is clicked.
- Production boot fails/alerts if `MAIL_MAILER=log`.
- Re-running an order-confirmation job after a crash does not duplicate the email.

## Content

- A post with a future `published_at` 404s on its direct slug route without a valid preview token.

---

# 5. NOTES FOR THE IMPLEMENTER

- This plan intentionally does not touch canonical URL/sitemap/JSON-LD/claim-safety work — that's `SEO-P0-P1-IMPLEMENTATION-PLAN-v1.1.md`'s job. If a task here seems to overlap (e.g. review `Verified` badge in P0-T3 there vs. P1-S1 here), P0-T3 owns the render-time rule ("don't show Verified without `is_verified`"); P1-S1 here owns *how `is_verified` gets set correctly in the first place*.
- Any policy question that affects business behavior (e.g. "should unconfirmed newsletter subscribers still get the discount code?", "is guest checkout required or can we require login?") should be confirmed with the user before implementing — don't assume.
- After finishing each numbered task, run `gitnexus_detect_changes()` (or the project's equivalent check) to confirm the change only touched the expected symbols, per this repo's `CLAUDE.md` rules.
