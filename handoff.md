# Handoff — 2026-08-21

## Full v5 positioning/taxonomy rollout: claim-safety audit, editorial hubs rebuilt, English Bulldog canonical fix (local + production), first content cluster drafted, one real bug found and fixed (not yet deployed)

Spans two sessions (2026-08-20 into 2026-08-21, date rolled over mid-session). Started from a pasted "Canonical Implementation Blueprint v5" doc (now saved properly at `docs/PETPOSTURE-BLUEPRINT-V5.md`, English) and worked through it via a running audit → fix → deploy loop, confirming each step with the user before writing.

**Content/claim-safety pass** (deployed): `/our-mission` and `OurMissionPage.tsx` rewritten to drop medical-claim language ("posture," "improve their health," "spinal") in favor of practical/fit-focused copy; the hero comparison image (`badposture-goodposture.webp`, an infographic literally claiming "Leads to vomiting, acid reflux... Strains neck & spine") was replaced with a real lifestyle photo (`dog-ramp-furniture-access.webp`) the user supplied from a generated prompt. Same sweep, extended to a full-site audit: Footer's "About PetPosture" default description, `ShopPage.tsx`'s hero copy, `FaqsPage.tsx`'s "Perfect Posture Guarantee" → "30-Day Guarantee", `ProductReviews.tsx`'s form placeholder, and — the most serious find — `ScientificBreakdown.tsx`/`TrustBadgeBar.tsx`, two components rendered on **every live product detail page**, carrying fabricated clinical claims ("Clinically tested to improve spinal alignment by 22%," "BVet Approved") with no evidence behind them. All rewritten to non-medical, practical language. **Also audited production blog posts directly** (read-only `tinker` script via SSH) — 0 violations found on the 2 real published posts; some local-only mock/seed data did carry similar language but was confirmed never to exist in production.

**Homepage + navigation**: 4 discovery labels changed (`Shop by Breed`→`Explore by Breed`, etc. — full table in the blueprint doc §8). Found and fixed a real hover-clip bug on the breed/solution carousel icons (`overflow-x-auto` forces the vertical axis non-visible too, clipping the hover `scale`/`translateY` — removed the transform, kept `boxShadow` as the hover cue). See `ARCHITECTURE.md`/`RULES.md` for the general CSS lesson.

**English Bulldog canonical slug** — found via `/dogs/english-bulldog` 404ing: `BreedSeeder.php` already had the canonical `english-bulldog` slug, but a stale `Bulldog`/`bulldog` row was left behind in the DB from before that change (seeders `updateOrCreate` by slug, so a slug rename creates a new row, not fixes the old one). Renamed the row in place via `tinker` on **both** local and production DBs (verified 0 products/posts attached before renaming, so no relational data was orphaned). Added 6 permanent 301 redirects (`next.config.ts`) for `bulldog`/`bulldogs`/`english-bulldogs` under both `/dogs/` and `/shop/breeds/`.

**Editorial hubs rebuilt** — `/dogs/{breed}` and `/solutions/{slug}` went from thin pages (H1 + product grid + guides only) to the full spec in the blueprint doc §10 (Common Challenges, Product Types, What to Consider, cross-links to related Breeds/Solutions, a Commerce CTA that's always present). New `/shop/breeds/flat-faced` and `/shop/breeds/long-backed` commerce-only pages added (Body Type has no editorial hub by design). `PostResource.php` gained Breeds/Solutions picker fields — previously a Post could only be tagged to a Breed/Solution from the Breed/Solution side, not the reverse.

**Deployed to production** (commit `ac44fef`): committed, pushed (pre-push hook ran a full production build of both apps, passed clean), `git pull` on the VPS, rebuilt both Docker images, `--force-recreate` both containers, `optimize:clear`. Verified live: new routes 200, old Bulldog URLs 301 correctly, `/dogs/english-bulldog` 200 after the DB fix was replayed on production too.

**First content cluster drafted (Dachshund Mobility)** — per the blueprint's §11 chain (Solution Hub → Guide → How-to-Choose → Comparison → Review → Shop). The existing real comparison post ("Best Dog Ramps for Dachshunds") already covered the Comparison slot; wrote the 3 missing pieces as **drafts** (not published): `how-to-choose-a-dog-ramp` (evergreen buying guide, no fabricated data needed), `ramp-vs-stairs-for-dachshunds` (category-level comparison, not branded SKUs), and a deeper single-product review of the existing comparison's real top pick (reused its already-verified real data — name, specs, real Amazon affiliate URL — rather than researching or fabricating anything new). All 3 have full SEO metadata (title/description/keyphrase/og_title/og_description) and are tagged Breed=Dachshund/Solution=Mobility. Added 2 backlinks into the existing live post so the cluster interlinks both directions. **Explicit lesson reinforced this session**: never fabricate a price/rating/affiliate URL for comparison content — either reuse already-verified real data, or write the cluster pieces that don't need per-SKU data first.

**One real, unrelated bug found, fixed, and deployed**: `/blog`'s category filter ("Breed Guides" tab) showed "No stories found" even with a real matching post. Root cause: `BlogPage.tsx`'s `featuredPost` was computed from the unfiltered post list while `latestPosts` excluded that post's id from the *filtered* list — when the globally-newest post was also the only post in the selected category, it disappeared from the grid entirely. Fixed by deriving both from the same filtered base. See `RULES.md` for the general pattern. **Shipped in a second, separate commit/deploy** (`8c090c1`, same session, after the docs update below) — after rebuilding the frontend container, the fix still didn't show on the live site: `curl -I https://petposture.com/blog` showed `cf-cache-status: HIT`, `Age: 1513` — Cloudflare was serving the pre-fix static HTML shell from before the deploy. **This was a checklist miss, not a new bug** — `RULES.md`'s existing Docker/deploy section already says to purge Cloudflare after every frontend deploy; skipped it the first time. Ran `docker exec petposture-backend php artisan tinker --execute='app(App\Services\CloudflareCacheService::class)->purgeAll();'`, re-verified `cf-cache-status: MISS`, user confirmed the fix now shows. **Lesson**: `/blog` is statically prerendered (`○` in the build output) same as any other static route — it's not just the checkout pages that need the post-deploy Cloudflare purge; any static-shell route can serve a stale build after a frontend redeploy if the purge step is skipped.

## Immediate follow-ups (next session)

1. **Review and publish (or edit) the 3 Dachshund Mobility drafts** in Filament — `how-to-choose-a-dog-ramp`, `ramp-vs-stairs-for-dachshunds`, `priorpet-birchwood-dog-ramp-review`. All currently `status: draft`.
2. ~~Deploy the `BlogPage.tsx` fix~~ — done this session (see above; required a Cloudflare purge after the rebuild, which was initially missed).
3. **Two more content clusters still needed**: French Bulldog Feeding/Comfort, Pug Feeding/Comfort — both need real product research (WebSearch a live retailer listing) since there's no existing real comparison-item data to reuse for either category yet, unlike Dachshund Mobility.
4. **Docs token-efficiency idea raised by the user, deliberately deferred**: add a short index/TOC to `ARCHITECTURE.md`/`RULES.md` so a future session can `Grep` to the right section instead of reading the whole (72KB/45KB) file, and consider splitting off very old dated entries into a separate `ARCHIVE.md`. Not done this session to avoid restructuring docs mid-update; worth doing as its own focused pass.
5. No other specific follow-up beyond the standing backlog further down this file (Hostinger Mail, Return Phase 3, Product Intelligence phase, etc. — check dates before treating as current).

---

# Handoff — 2026-08-19 (later)

## Post editor "Save Draft does nothing" + "clicks jump back to the content box" + source-code modal stuck on one line — full chain fixed (partly committed, rest in this uncommitted batch)

Continued from the 08-19 entry below. The user (Yuni) root-caused and fixed most of the "Save Draft silently failing" saga themselves (commits at the top of this file's git log); this session verified, completed, and documented the rest. **Nothing in this batch is deployed yet.**

**The two real root causes the user found (committed):**
1. **onclick escaping** (c1e05c9): ->extraAttributes(['onclick' => "localStorage.removeItem('...')"]) had its single quotes HTML-escaped by Filament to &#039;, so the browser tried to parse that literal text as JS on click and threw "Uncaught SyntaxError: Unexpected token '&'" — silently killing the click before Livewire's own save handler ran. Fix: moved the localStorage cleanup into resources/js/source-editor.js as a real click listener (label-matched), loaded panel-wide via @vite in AdminPanelProvider's BODY_END hook.
2. **CodeMirror infinite re-render loop** (ab3b63f / 9138fd4): the source-code editor synced on CodeMirror's change event, which also fired for its own initial setValue → input round-trip through Livewire → modal re-render → fresh attach + sync → forever, hanging the tab ("đơ nhảy lung tung" when pasting source code). Replaced CodeMirror with a display-only js-beautify pretty-print in source-editor.js (9138fd4), with a submit-time capture-phase listener that collapses the whitespace back out so the TipTap HTML→JSON converter sees the same tag-adjacency as the original compact HTML (0284588).

**Still-open pieces this session closed (uncommitted):**
- **CreatePost.php still had the same broken onclick extraAttributes** on both the header action and getCreateFormAction() — removed both (the JS label listener already covers them; the button keeps working).
- **"Click any other section → the page jumps back to the content box at the just-edited spot"**: the vendor Tiptap Alpine component's updateEditorContent() unconditionally called editor.chain().focus() + setTextSelection({from,to}) whenever the entangled state echo differed — scrolling/focusing the editor and swallowing clicks on other controls. Yuni fixed it in AdminPanelProvider with an alpine:init patch that overrides the tiptap component: updateEditorContent now only focuses when the editor is already focused (editor.isFocused) or explicitly force-focused (ppForceFocus, set around insertSource/refreshEditorContent). Complementary fix in this batch: ->stateBindingModifiers([]) on both PostResource and PageResource content fields — the entangle becomes $entangle(..., false) (non-optimistic), so typing no longer fires a Livewire round-trip per keystroke (the vendor afterStateUpdated → validateOnly hook rides the same traffic). Tradeoff: the SERP-preview placeholder no longer live-updates while typing.
- **Source-code modal stuck on ONE line — pretty-print had never actually worked.** Two stacked bugs in resources/js/source-editor.js: (a) import { html_beautify } from 'js-beautify' resolves undefined in js-beautify 2.x (the function lives on the default export) → html_beautify(...) throws right after data-formatted is stamped, so the one-shot guard never retries; (b) even with the import fixed, Livewire re-fills the modal textarea's value after the MutationObserver formats it (same element, guard blocks re-format). Fixed with a default-import + destructure, a guard that re-formats anything still one-line (skips multi-line = already formatted or user-edited), and a setInterval(scan, 500) retry. Verified on the real post-8 edit page: source modal went from 1 line to 98 lines.
- **AdminPanelProvider.php reformatted** (display-only): the HEAD_END CSS block's longest one-line rules (22) + the TipTap Editor section (28 rules) + 5 banner SVG/span elements expanded to readable multi-line; zero value changes (verified the rendered login page still carries --pp-orange and the expanded rules).
- composer.json/composer.lock: laravel/pail constraint ^1.2.5 → ^1.2 (Yuni). Pail is dev-only (composer dev streams logs); the earlier 20MB log of Class "Laravel\Pail\PailServiceProvider" not found was from missing dev deps + a stale auto-discovery cache — cleared the log.

**Verification**: ContentAdminRendersTest green (9 tests, 37 assertions — includes the EditPost header-save and CreatePost header-save regression tests); php -l clean on all touched files; Vite npm run build clean (bundle source-editor-D65fMgMG.js; public/build is gitignored so the Docker build regenerates it); pretty-print verified in a real browser on /admin/posts/8/edit.

**Not yet deployed** — commit + push + VPS deploy (git pull + docker compose build/up -d --force-recreate backend frontend + optimize:clear per README) is the next step.

# Handoff — 2026-08-19
# Handoff — 2026-08-19

## Filament admin polish, first real blog post, checkout page redesign, and a session-long dev-environment bug finally root-caused

**Filament admin fixes** (all deployed to production earlier in the session, before the checkout work below):
- `resolveAssetUrl()` on `Api\PostResource` fixed to accept `mixed` instead of `?string` — was 500ing on any comparison post with an item missing its image (Filament's `FileUpload` stores `[]`, not `null`, for "nothing uploaded"). This was the real cause of a "Preview button 404s" report.
- TipTap bubble-menu (text-selection popup) icons were invisible — dark-gray-on-dark-gray, because `.tiptap-tool`'s toolbar color rule was unscoped and leaked into the popup, which renders on a dark Tippy background the vendor package never themes. Scoped the color rule per context.
- Added the missing `source` (raw HTML) tool to the `'blog'` TipTap toolbar profile, so Post/Page content can accept pasted pre-formatted HTML (e.g. AI-generated drafts).

**First real comparison post created**: "Best Dog Ramps for Dachshunds" (`best-dog-ramps-for-dachshunds`, id 4 on production, status **draft**) — created directly via `tinker` on the VPS with full SEO/social metadata, 3 comparison items (PRIORPET/TRIXIE/PetSafe), tagged and linked to Breed: Dachshund / Solution: Mobility, category later changed to "Breed Guides". **Still needs before publishing**: real verified prices (currently `[VERIFY]`-flagged), real affiliate URLs for items #1/#2 (currently placeholder/wrong), real product photos for all 3 items (sourced from the retailer, not AI-generated — the affiliate link has to match the actual pictured product), and a featured/hero image for the post itself (AI-gen is fine for this one, prompt already drafted earlier in the session).

**Blog page (`BlogPage.tsx`) visual polish**: "Featured Article" and "Editor's Pick" badges were solid-orange (`bg-secondary`/`text-ink`), inconsistent with the frosted-glass category badges (`bg-white/90 backdrop-blur-sm`/`text-rust`) used everywhere else on the page (Latest Stories, etc.) — restyled both to match. Search box widened `280px` → `380px` on desktop.

**Cart page (`app/cart/page.tsx`)**: the "1 Shopping Cart / 2 Checkout Details / 3 Order Complete" stepper is now `hidden md:block` — it looked cramped/unnecessary on mobile.

**Checkout page redesign** (`CheckoutPage.tsx`, `checkout/OrderSummary.tsx`, `CheckoutSuccessPage.tsx`) — modeled on a Society6 reference the user supplied:
- Replaced the old oversized-logo `relative h-16` absolute-positioned header (which had uneven top/bottom padding and a logo that visually bled outside its own container) with a plain flex row, smaller logo (`h-9 lg:h-11`).
- `CheckoutPage.tsx` gained a full-width sticky top bar — logo left, cart icon + item-count badge right — shared by mobile and desktop, aligned to the same `max-w-[1100px]` container as the two-column layout below (learned the hard way: the bar's own content needs that same container, or the logo/cart don't line up with the columns underneath it).
- `OrderSummary.tsx` gained a mobile-only collapsible "Order Summary" toggle (closed by default, showing just the total — matches the reference exactly) instead of always showing the full price breakdown above the form. Its "Line items" block is now fully omitted (not just visually hidden) when the cart is empty, since an empty-but-rendered block still consumed a full `space-y-8` gap.
- `CheckoutSuccessPage.tsx` got the same header treatment, plus the "Continue shopping"/"Back to home" CTA buttons now share an explicit `sm:w-[200px]` — they already had identical heights, the "bigger" look the user flagged was purely the longer text + solid-color-vs-outline optical effect, not an actual size bug.

**The real story of the session — a silent, app-wide client hydration crash from `crypto.randomUUID()`.** What started as "the Order Summary toggle button does nothing" and "the checkout-success page just hangs on a spinner forever" turned out to be the *same* underlying bug, and it took an enormous amount of dead-end debugging to find (stale-dev-server theories, Suspense-boundary experiments, `force-dynamic` vs `connection()`, all ruled out one by one). The actual cause: `crypto.randomUUID()` only exists in secure contexts (HTTPS, or the literal hostname `localhost`) — `CartContext.tsx`'s `getOrCreateCartToken()` called it unconditionally inside `CartProvider`'s `useState` initializer, and `CartProvider` wraps the *entire app*. Visiting locally via `http://petposture.test` (not `localhost`, not HTTPS) with no cart token already cached in `localStorage` threw immediately at the app root, before any page-specific code ever ran — with a completely silent browser console and zero network requests, since nothing got far enough to make one. Only visible by running `npm run dev` directly and reading its own terminal, where a newer Turbopack feature forwards uncaught browser exceptions as `[browser] Uncaught TypeError: ...` — never spotted in the in-browser DevTools console across many earlier attempts. Fixed with a manual UUID-v4 fallback. Two more genuine (secondary) local-only issues were found once this stopped masking them: `next.config.ts` needed `allowedDevOrigins: ['petposture.test']` (explains the `ERR_INVALID_HTTP_RESPONSE` WebSocket errors seen in console *all session*), and `backend/.env` needed `FRONTEND_URL` to include `http://petposture.test:3000` for CORS. See `RULES.md`/`ARCHITECTURE.md` for the full writeup — this is a durable lesson worth re-reading if a similar "page hangs forever, nothing in console" bug shows up again.

**Docs updated**: `RULES.md` and `ARCHITECTURE.md` got new entries for everything above. `README.md` didn't need changes — today's work was internal/architectural, not new customer-facing features.

## Immediate follow-ups (next session)

1. **Finish the Dachshund ramps post before publishing**: real prices, real affiliate URLs (2 of 3 are currently wrong/placeholder), real product photos ×3, one AI-gen hero image, then flip Status → Published.
2. Spot-check the checkout redesign on a real mobile device (not just devtools emulation) — the mobile Order Summary collapse/expand and the sticky top bar in particular.
3. If another "page hangs forever with silent console" bug turns up locally, check `CartContext.tsx`'s `crypto.randomUUID` fallback is still in place before spending hours on it again — and remember to check the dev server's own terminal output early, not just the browser console.

---

# Handoff — 2026-08-18

## Full-day pass: mobile UX audit, WebP everywhere, asset cleanup, admin sidebar/dashboard reorg, real site search, breed/solution taxonomy migration, OG image fixes, dev-env bugs, Our Mission polish

Large continuous single-session pass following the EditPost header-button fix below.

**Next steps**:
1. Commit + push this session's work (in progress as this entry is written).
2. Deploy: this session has no SSH/VPS access, so the actual `git pull` + `docker compose build/up` on the VPS needs to be run by Yuni or from a session that has it. Once deployed, run `php artisan media-library:regenerate` on the VPS (Yuni's standing instruction) — **in this order**: deploy code first, verify the container's PHP GD build actually has WebP support (`php -r "var_dump(function_exists('imagewebp'));"` inside the backend container), *then* run the regenerate command, so existing Product images pick up the new `webp` conversion. Also purge Cloudflare + `optimize:clear` per the usual post-deploy checklist (`RULES.md`).
3. Verify in production after deploy: `/shop/breeds`, `/shop/solutions`, and blog search all work against the real dataset (only verified against local/dev data so far).
4. No other specific follow-up identified this session beyond the standing backlog items further down this file (Hostinger Mail, Return Phase 3, etc. — check their dates before treating as still current).

**Mobile UX audit + fixes**: Newsletter fine-print alignment, Contact page mobile hero, Header search collapsed to an icon-triggered overlay on mobile, ProductDetails gallery layout, LegalPageLayout mobile TOC, removed duplicate Newsletter widgets that had reappeared on Blog pages, deleted 7 confirmed-dead-code frontend components (zero references, individually grepped before deletion).

**WebP conversion extended to two more places** (already existed for some Filament uploads before today): `App\Support\ImageUploadResizer` now converts JPEG/PNG/static-GIF/WebP to WebP (quality 85) after resizing — animated GIFs are detected (`isAnimatedGif()`, counts Graphic Control Extension blocks) and only resized, never re-encoded, since WebP conversion would kill the animation. Separately, Product/ProductVariant images (which don't go through `ImageUploadResizer` at all — they're Lunar's own Spatie MediaLibrary system) got their own conversion via a new `App\Base\ProductMediaDefinitions extends StandardMediaDefinitions`, registered in `config('lunar/media.php')`. Hit and fixed a real bug during this: `addMediaConversion('webp')->format('webp')->performOnCollections(...)` fails because `format()` returns Spatie's `ImageDriver`, not the `Conversion` object — reordered to `performOnCollections()` before `format()`. Verified end-to-end via `tinker` (upload → conversion generated → `Api\ProductResource`'s new `mediaUrl()` helper serves the `webp` conversion URL). See `RULES.md`'s new "two image pipelines" rule.

**`public/assets/` cleanup**: 42MB → 2.3MB. 144 confirmed-dead legacy WordPress-migration files deleted, the remaining 34 converted to WebP (Node `sharp` script, run from inside `frontend/` since `node_modules` resolution is directory-relative — a scratchpad-relative run failed with `ERR_MODULE_NOT_FOUND`), and everything reorganized into `product/`, `banner/`, `blog/`, `breeds/`, `icons/`, `logo/` subfolders. All references bulk-rewritten and verified via `tsc --noEmit`. This surfaced a self-caused regression, caught same-day: `ProductSyncService::normalizePublicImageUrl()`'s hardcoded fallback path (`/assets/Pug-Dog-Bed.jpg`) pointed at a file that no longer existed post-rename — fixed to `/assets/product/Pug-Dog-Bed.webp`.

**Admin sidebar + Dashboard reorg** (several rounds of user-driven exact-spec iteration, each verified live in browser): merged the standalone `'PetPosture'` nav group into Catalog and the standalone `'Reports'` group into a new `'Affiliate'` group (alongside Affiliate Networks); renamed the Settings group's displayed label to "🏬 Store Configuration". Deleted `EcommerceStatsOverview` (dead/duplicate stats), redistributed the still-useful ones into `SiteOverviewStatsWidget` (Total Sales, AOV, Active Users, Orders) and `PendingReturnRequestsWidget` (renamed "Returns & Refunds": Refund Rate, Pending Review, Overdue, Awaiting Completion). `SalesOverviewChart` now reads the Dashboard's own global date-range filter instead of its own separate Today/Month/Year filter, so the chart and stat cards always agree on period. Hidden (not deleted) the Product Tags feature from the admin UI — unused in the current catalog workflow. See `ARCHITECTURE.md` for the full before/after. **Dashboard Row-1 stats spec required 2 rounds of clarification** — the user's spec had a literal duplicate the first time and a near-identical ambiguous resend the second time; flagged both explicitly via `AskUserQuestion`/plain text rather than guessing, only implemented once the user gave an unambiguous final answer.

**Real site search shipped** — previously the Header search box had no `onSubmit` at all, and blog had no search whatsoever. Header now submits to `/shop?q=<term>` (desktop + mobile overlay); `app/shop/page.tsx` threads `searchParams.q` through to the existing product query. `ContentController::posts()` gained a `?q=` param (case-insensitive `LIKE` on `title`/`content`) for blog search.

**Breed/Solution shop taxonomy — found and fixed a real architectural drift**: discovered two parallel, divergent taxonomy systems. `/dogs`+`/solutions` (content hubs) already read from the real `breeds`/`solutions` DB tables via `/api/breeds`/`/api/solutions`; `/shop/breeds`+`/shop/solutions` (shop collection pages) were still rendering from hardcoded, stale `BREED_TYPES`/`SOLUTION_TYPES`/`BREED_CONTENT`/`SOLUTION_CONTENT` constants in `frontend/lib/shopData.ts`. Migrated all 4 shop page files (`/shop/breeds`, `/shop/breeds/[slug]`, `/shop/solutions`, `/shop/solutions/[slug]`) to fetch from the real API, then — per the user's explicit "làm nốt đi" follow-up — also migrated the shop sidebar's filter facets (`useShopLogic.ts`, now takes `allBreeds`/`allSolutions` params instead of importing the hardcoded constants). Deleted the now-fully-orphaned constants from `shopData.ts`. See `RULES.md`'s new "don't hardcode a taxonomy with a real admin-managed source of truth" rule.

**OG/social-preview image fixes**: `/shop/breeds`, `/shop/solutions`, and the product detail page (`app/shop/[category]/[slug]/page.tsx`) — the last of which had **no `openGraph` metadata at all** — now emit real `openGraph`/`twitter` card data (title, stripped/truncated description, product image). Also fixed a stale favicon fallback in `app/layout.tsx` (`/assets/Logo PetPosture-icon.png`, deleted since June, → `/favicon.ico`, the real file).

**Local dev-environment bugs hit while the user tested, both root-caused and fixed live**: `/dogs/pug` 404'd because `frontend/.env.local` never had `NEXT_PUBLIC_API_URL` set (fell back to `localhost:8000`, nothing running there) — added `NEXT_PUBLIC_API_URL=http://petposture.test`. Once real images started loading, `next/image` then rejected `petposture.test` as an unconfigured hostname — added it to `next.config.ts`'s `images.remotePatterns`. Both required a dev-server restart to take effect (env vars and `next.config.ts` only load at boot). Separately, local Filament CSS/JS were 404ing sitewide — Laragon's Apache `.htaccess` was missing `css|js|build` from its rewrite whitelist (only had `api|sanctum|storage|vendor|livewire|admin`) — fixed.

**Our Mission page polish**: replaced a hardcoded external Unsplash CTA background with a locally-hosted AI-generated image (`Our-Mission-CTA-Background.webp`, Dachshund + French Bulldog); reduced the "OUR MISSION" H1 from `text-[48px]` to `text-[40px]` on desktop (mobile `32px` unchanged) per a sibling-page-consistency comparison — subtitle deliberately left unchanged (user's explicit choice, Option A: "câu hook ngắn đã đủ mạnh"). Also fixed 2 more taxonomy-migration-fallout stale-text bugs surfaced as side effects (`CreateMedia.php`'s breed-upload helper text, `SiteMediaController.php`'s docblock — both referenced the old flat-faced/long-backed taxonomy or deleted components), and deleted 2 more confirmed-dead files (`Models/ProductVariant.php` Legacy, non-`Api` `Http/Resources/ProductResource.php`).

**Docs**: `RULES.md`, `ARCHITECTURE.md`, `README.md` updated to match all of the above (nav group rename, two-image-pipeline split, taxonomy migration, real search). This entry.

## Edit Post header "Update & Publish" button dead (bottom button worked) — Filament action-name collision, fixed

User reported the header "Update & Publish" button on the Filament Edit Post page did nothing, while the identical bottom form button worked fine. Root-caused via a repro Livewire test (`Livewire::test(EditPost::class)->call('mountAction', ...)`) — the first attempt (asserting DB save) failed with the record untouched and no exception, which narrowed it to a silent no-op rather than a thrown error.

**Root cause — action-name collision in Filament's shared action registry**: `EditRecord::getSaveFormAction()` builds the bottom button as `Action::make('save')->submit('save')` — a plain submit button with **no `->action()` closure** (`CanSubmitForm::submit()` only sets flags; `HasAction::getActionFunction()` returns `null`). The header "Update & Publish" action was also named `'save'`. Filament caches *all* actions — header (`bootedInteractsWithHeaderActions()`) and form (`bootedInteractsWithFormActions()`) — into **one** `cachedActions[$name]` map on every Livewire request, so the form action silently overwrote the header action in the registry. Clicking the header button then resolved to the *form* action, whose `MountableAction::call()` → `evaluate(null)` did nothing. The bottom button was unaffected because it's a `<button type="submit">` inside the `<form wire:submit="save">` — it never goes through `mountAction` at all. `CreatePost` was never hit because its form action is named `'create'`, not `'save'` (confirmed by a passing create-side regression test).

**Fix**: renamed the EditPost header action `'save'` → `'headerSave'` (`backend/app/Filament/Resources/PostResource/Pages/EditPost.php`), keeping `->action(fn () => $this->save())` unchanged. Added two permanent regression tests to `ContentAdminRendersTest.php` (`test_edit_post_header_update_and_publish_action_saves`, `test_create_post_header_save_action_creates_post`) that fill the form, click the header action via `->call('mountAction', '<name>')`, and assert the DB row + `published_at` auto-fill. Verified: full `ContentAdminRendersTest` class green (9 tests, 37 assertions), Pint clean on both changed files, full backend suite re-run green. See the new `RULES.md` rule (action names must be unique across header + form actions) for the durable lesson.

**Note for this session's tooling**: `composer install` was re-run to restore missing dev deps (phpunit/pint/larastan had vanished from `vendor/`); the `post-autoload-dump` script fails when MySQL is down, which is non-fatal (packages still extract). Tests must run via `vendor\bin\phpunit` directly — `php artisan test` boots Laravel (loading `.env`'s `DB_CONNECTION=mysql`) *before* PHPUnit processes phpunit.xml's `<env>` overrides, so the sqlite `:memory:` test DB never applies and tests try to hit the local MySQL instead.

**Not yet deployed** — commit + push to origin (push triggers the `build.js` deploy pipeline) is the next step.

# Handoff — 2026-08-17
# Handoff — 2026-08-17

## Wyoming LLC prep: business address/phone updated everywhere; governing-law clause still pending

User is about to register a Wyoming LLC. Updated the business address (old: `2017 I St A,
Sacramento, CA 95811`) to `1501 South Greeley Hwy, Ste C #1465, Cheyenne, WY 82007` and
consolidated the phone number to `+1 (916) 623-5368` (previously two different numbers were
inconsistently used: `623-5368` in the seeded Cookie Policy vs `668-0065` everywhere else —
`623-5368` is now the single canonical number) across: `LegalPagesSeeder.php` (re-seeded into the
live `pages` DB rows via `php artisan db:seed --class=LegalPagesSeeder`, which is safe to re-run —
it's `updateOrCreate` keyed by slug), the `business_address`/`business_phone` rows in the
`settings` table (updated directly + cache cleared, since a bulk `->update()` doesn't fire
`SettingCacheObserver`), `ContentController.php`'s fallback defaults, `SettingsContext.tsx`,
`ContactPage.tsx`, `Header.tsx`, `TrackOrderPage.tsx`, and all 6 transactional email Blade
templates.

**Still pending — do NOT change until the user gives the actual Wyoming formation date/confirms
the LLC is registered**: Terms & Conditions §10 (seeded in `LegalPagesSeeder.php`, search
"governed by and construed in accordance with the laws of the State of California") still names
California as the governing-law state. This should flip to Wyoming once the LLC is actually
formed there — changing it prematurely (before the entity legally exists in Wyoming) would make
the Terms inaccurate. Ask the user for the effective date before touching this.

## Full homepage/shop visual pass + backend fixes + Breed/Solution gap closure + Filament nav groups

Large single-session pass, all verified via local build (`npx next build`, exit 0) and `php -l`/local DB checks — **not yet deployed to production** until this session's commit/push/deploy step runs.

**Frontend visual/UX changes** (all in `frontend/`): removed the "Start With Your Dog" homepage section (100% duplicate of the existing "Shop by Breed" panel — same 5 breeds, same images); redesigned "Explore by Body Type" (`BreedBanners()` in `HomePage.tsx`) from dark-overlay lifestyle banners to a light card layout matching a user-supplied mockup, and fixed a real dead link in the process (`Shop Now` had `href="#"`, now links to the real `/shop/breeds/flat-faced`/`/shop/breeds/long-backed`); blog guide cards now show a "Read Guide →" link instead of a date/read-time row; consolidated 4 separate hand-rolled newsletter forms (`HomePage.tsx`'s `EmailCta`, a dead-unused `Newsletter.tsx`, and inline forms in `ShopPage.tsx`/`BlogPage.tsx`) into one canonical `components/Newsletter.tsx`, now rendered once inside `Footer.tsx` so every page with a footer gets it automatically — `BlogPage.tsx`'s sidebar "Never miss a post" widget was previously a static, non-functional form and is now wired to the real `/api/newsletter/subscribe` endpoint; new hero banner image (two-dog "built differently" concept — Frenchie eating from an elevated bowl, Dachshund on a ramp) replacing a feeding-only single-dog photo, to actually match the new headline's "feeding, comfort, mobility and walking" copy; fixed a real Tailwind bug on `OurMissionPage.tsx`'s CTA button — nested unnamed `group`/`group-hover:` classes on both the outer `<section>` and the inner `<Link>` meant hovering *anywhere* in the section (not just the button) triggered the button's orange fill-in, hiding its text; changed the global `rust` color token (`#8f4a1f` → `#a8551a`) per explicit user request — same hue as `secondary` but less "muddy brown," still ~5.3:1 contrast (passes WCAG AA text), cascades automatically to all 142 existing `text-rust`/`border-rust` usages since it's one Tailwind token, not per-file edits; redesigned `/shop` (`ShopPage.tsx`/`ProductFilterBar.tsx`/`ProductGrid.tsx`) to remove 3 redundant nested cards (a boxed sidebar filter panel with its own "Refine Catalog/Filters" header, a "Storefront overview" card, and `ProductGrid`'s own "Catalog Results" card — all three were partly re-stating "Showing X of Y products") down to one slim results bar + a flat filter list, matching the user's "feels disjointed, not like Chewy" complaint; changed `/shop`'s page background from `#f7f3ee` to white after the redesign made it visually blend into the Footer's `Newsletter` peach strip right below it.

**Backend fix — real, measurable N+1 bug**: `Api\PostResource::resolveSeo()` unconditionally reads `$this->seo`, but none of the 4 controllers building `Post::with([...])` queries (`ContentController::posts()`/`post()`, `PostController::index()`, `BreedController`, `SolutionController`) eager-loaded that relation — every post in a list response triggered its own extra SQL query. This was the actual root cause of a user-reported slow `/blog` page load (separately, `/api/products`/`/api/posts` were also returning 500 mid-session because MySQL wasn't running locally yet — unrelated, resolved once the user started it). Fixed by adding `'seo'` to all 4 eager-load arrays. See `RULES.md` for the enforceable rule this created.

**Legal/business info**: see the Wyoming LLC entry above this one in today's log.

**Breed/Solution "close the gap" task — turned out to be much closer to done than an initial audit suggested.** User asked, referencing the PetPosture Master Strategy Blueprint, whether the codebase matches the business-model direction. A first-pass research-agent audit reported Breed/Solution entities as "PARTIAL — not seeded, frontend still hardcoded" and Filament nav groups as "MISSING." **Both claims were wrong when checked directly against the running app** (lesson: verify agent audit findings against live state before acting on them, especially anything phrased as "missing"):
- `breeds` (5 rows, correct `body_type`) and `solutions` (4 rows: Feeding/Comfort/Mobility/Walking) were **already populated** in the DB — added `BreedSeeder.php`/`SolutionSeeder.php` (idempotent, registered in `DatabaseSeeder`) so this survives a fresh install, not because the table was empty.
- `/dogs`, `/dogs/[slug]`, `/solutions`, `/solutions/[slug]` were **already** calling the real `GET /api/breeds`/`GET /api/solutions` endpoints, not hardcoded. The audit had checked `frontend/lib/shopData.ts`'s `BREED_TYPES`/`SOLUTION_TYPES`, which back a *different, intentionally separate* concept (the Body-Type shop-collection pages, `/shop/breeds/[slug]` etc. — per the blueprint's own "Breed Hubs and Shop Collections are not the same thing" section, both are correct to keep as-is).
- `BreedResource`/`SolutionResource` already declared `getNavigationGroup() → 'PetPosture'` via a method override — the audit only checked for the static `$navigationGroup` property and missed it.
- **The real, still-open gap**: `breed_product`/`solution_product` pivot tables are empty — not a code bug. `Lunar\Models\Product::count()` is 7, and every one of them is Lunar demo/test data ("Test Product", "Interactive Smart Cat Toy", "Smart GPS Pet Tracker," a cat food item) — **there are no real PetPosture dog SKUs in the catalog yet** to link to a breed or solution. This blocks the whole "Recommended Products" section of every `/dogs/{slug}` and `/solutions/{slug}` page from showing anything.
- Linked `post_breed`/`post_solution` for the 3 existing blog posts with an unambiguous match (Dachshunding 101 → Dachshund; Orthopedic-bed post → Comfort; "Traditional Bowls" post → Feeding), via `$model->posts()->syncWithoutDetaching()` directly — real content curation, not seed/fixture data.
- **Also found while doing this**: most of the 7 existing blog posts are generic/imported placeholders — several literally contain the sentence "This is an imported mock post for testing purposes." in their `content` field. Real breed-specific "money cluster" content (per the blueprint's `Best Dog Ramps for Dachshunds` style article list) has not actually been written yet — only 1 real comparison post and 1 real launch article exist.
- Filament: moved `AffiliateReports` from the `'Finance'` group to a new `'Reports'` group, and added both `'PetPosture'` and `'Reports'` to `AdminPanelProvider`'s explicit `->navigationGroups([...])` ordering array (they worked before, just rendered unpositioned in the nav).

**Next task, in priority order** (see the "Next steps" section of today's user-facing summary for the full reasoning):
1. Source/list real PetPosture dog SKUs in Lunar (even 3–5 to start) — this is the actual blocker for `breed_product`/`solution_product`, the homepage "PetPosture Picks" section showing real products, and for the blueprint's whole Shop-side flywheel. Nothing else in the breed/solution/content pipeline can produce real signal until this exists.
2. Write the first real breed-specific "money cluster" articles (blueprint's suggested first 10: Best Dog Ramps for Dachshunds, Best Orthopedic Beds for Dachshunds, Best Harnesses for French Bulldogs, etc.) and link each to its breed + solution via `post_breed`/`post_solution` as it's published.
3. `post_product` pivot (Phase 3 of the blueprint — petposture_pick/recommended/alternative/mentioned relation types) — not started, deliberately sequenced after 1–2 since it needs both real products and real posts to link.
4. `product_profiles`/`suppliers`/`product_tests` (Phase 4) — not started, correctly not a priority yet per the blueprint's own phase ordering.

# Handoff — 2026-08-15

## Blog goes live: Breed/Solution content hubs finished, Draft Preview shipped, first real post published, blog post page redesigned end-to-end, `published_at` auto-fill bug found and fixed

Continuation of the Breed/Solution work referenced in the 2026-08-13 entry below. Everything in
this entry is deployed and verified live in production (petposture.com), not just locally.

**Draft Preview feature shipped, but not without a real production incident on the way.** The
original plan was Laravel's own `URL::temporarySignedRoute()`, which needs a named route —
naming `/posts/{slug}` in `routes/api.php` (`api.posts.show`, then `content.posts.show`) caused
`php artisan route:cache` to fail with a duplicate-name error on every container boot, because
`bootstrap/app.php` re-registers the entire `routes/api.php` file a second time under `/api/v1`
(so any named route in that file always collides with itself once cached). This put
`petposture-backend` into an infinite restart loop in production — root-caused via `docker ps`
showing "Restarting" and reading `bootstrap/app.php`. Fixed by abandoning route names entirely:
`ContentController::hasValidPreviewToken()` uses a self-rolled `hash_hmac('sha256', ...)` token
instead (see `ARCHITECTURE.md`/`RULES.md` for the full writeup — this is now a documented rule,
not just a one-off fix). Verified end-to-end after the fix: a token generated by the real admin
"Preview" button opens the real draft on the live frontend and returns 200.

**Found and fixed a second real bug while publishing the first real post**: setting Status to
Published in the Post admin does **not** auto-fill `published_at` — it's an independent form
field. The post looked published (status column said so, direct-by-slug page worked) but was
invisible on `/blog` and the Home Page's "From the PetPosture Blog" section, since that list
endpoint filters `published_at <= now()` and `NULL` never satisfies that. Fixed in both
`CreatePost`/`EditPost`: auto-fill `published_at = now()` whenever status is Published and the
field is empty (see `RULES.md`). Backfilled the existing post's `published_at` directly in
production so it appears everywhere immediately.

**Save/Publish button also promoted to the page header** (Post Create/Edit) per user request — the
primary action (Publish/Save Draft/Update & Publish) now appears next to the page title, not just
at the bottom of a long form, so it doesn't require scrolling. Implemented as a header `Action`
that calls `$this->create()`/`$this->save()` directly; the original bottom action bar (Cancel,
Create & create another, etc.) is unchanged.

**Blog post page (`BlogPostPage.tsx`) redesigned end-to-end** after several rounds of live user
feedback against the first real published post: real post tags now come from the API (`tags` field
added to `PostResource`, was previously a hardcoded 3-tag array regardless of the actual post);
Share buttons (Facebook + Pinterest real share-intent links, Copy Link with clipboard feedback) and
the newsletter box (wired to the existing `/api/newsletter/subscribe`) went from pure decoration
with no `href`/`onClick`/`onSubmit` to fully functional; "More Like This"/"Recommended for You"
now fall back to `/dogs`+`/solutions` explore cards instead of rendering nothing when there's only
one post in the database (also fixed a related-post link bug, `/blog/{id}` instead of
`/blog/{slug}`, that had been masked until this fallback shipped); layout widened to the existing
1400px design token and body font trimmed slightly to reduce mid-sentence line wraps; CTA buttons
inside the post's own rich-text content got hover states (embedded scoped `<style>` block, since
inline-style HTML has no `:hover` on its own) and better spacing/flex-wrap grouping; a `Share:`
label/tag-row vertical-alignment bug (`items-center` centering a 1-row block against a 2-row
wrapped-tags block) was also caught and fixed from a live screenshot.

Also discovered mid-session: the frontend Docker image was stale by one deploy cycle (still
expecting the old `?signature=` preview query param from an abandoned earlier design, not the
final `?preview_token=`), which was the *actual* cause of an early "Preview still 404s" report —
not a code bug. Lesson generalized into `ARCHITECTURE.md`: renaming a query param requires a full
frontend image rebuild, not just a backend redeploy, or the deployed frontend silently keeps
sending the old name.

# Handoff — 2026-08-13

## Test suite fully green, Cloudflare `/checkout` cache root-caused, admin↔storefront contact-info sync, footer icon fix, single-product Shipping & Returns summary, 2 unguarded-email fixes, Anthropic key set (blocked on billing)

Started from a review of outstanding items from `RULES.md`/`ARCHITECTURE.md`/`handoff.md`, then a
follow-up batch of storefront/admin fixes requested directly. Everything below is verified
(PHPStan clean, `php artisan test` green, `tsc --noEmit`/`eslint` clean, and UI changes checked in
a real browser at mobile/tablet/desktop) but **not yet deployed as of this entry** — that's the
next step.

**Two unguarded `Mail::send()` calls fixed** (same bug class as the earlier Newsletter fix):
`AuthController::register()`'s `WelcomeEmail` send is now wrapped in try/catch + `Log::error()` —
an SMTP failure no longer blocks the whole registration response/token issuance. Homepage's
`EmailCta` ("Get 10% Off Your First Order") had a fake submit handler that only set local state —
now actually calls `POST /api/newsletter/subscribe` with loading/error states, matching the
`Newsletter.tsx` component's real implementation.

**`ANTHROPIC_API_KEY` set on the VPS** — added to `backend/.env`, but `env_file:` values only load
at container *start*, not live, so the backend container had to be recreated
(`up -d --force-recreate backend`) and the 5-minute `anthropic_api_key` cache flushed
(`cache:clear`) before it took effect. Verified end-to-end by calling
`AiSeoGeneratorService::generate()` directly (not just checking `isConfigured()`): the key
authenticates successfully, but the Anthropic account has **no credit balance** — every request
fails with a billing error. The "Generate with AI" button will keep erroring until the Anthropic
Console account is topped up; nothing further to fix on the code side.

**Backend test suite: 21 pre-existing failures → 0**, root-caused (see `ARCHITECTURE.md` for the
full technical writeup): a seeding collision (tests using `Role::create()`/
`Language::factory()->create()`/`Currency::factory()->create()` unconditionally, colliding with
migration-seeded rows) was masking 3 further real, independent bugs — a Lunar morph-map mismatch
in `CartApiTest`'s price fixture (`MissingCurrencyPriceException`), several stale `CheckoutApiTest`
assertions (money fields asserted as strings against now-float responses, an `order_events`
assertion against a resource that deliberately excludes it, an invalid direct state-machine
transition, an off-by-one shipments-array index, a payload missing the now-required `items`
field). All fixed; full suite now 116 passing, 0 regressions. New `RULES.md` entries document both
the seeding pattern and the morph-map gotcha so they don't get reintroduced.

**Cloudflare `/checkout` stale-cache mystery, open since 2026-07-26, finally root-caused and
fixed**: not the documented `/api/*` Cache Rule (never the cause) — a separate, previously-
undocumented zone-wide "Cache HTML pages" Cache Settings rule caches any non-`/api/` path whose
origin sends a cacheable `Cache-Control` header. `/checkout` and `/checkout/success` had no
`export const dynamic = 'force-dynamic'`, so Next statically prerendered them with
`Cache-Control: s-maxage=3600` — confirmed via `curl -I` on the VPS (`x-nextjs-prerender: 1`).
Since `dynamic` can't be exported from a `"use client"` file (both pages had it at the top level),
fixed by moving each page's content unchanged into `components/CheckoutPage.tsx`/
`CheckoutSuccessPage.tsx` and replacing `app/checkout/page.tsx`/`app/checkout/success/page.tsx`
with thin server wrappers exporting `force-dynamic` — same "thin page, real component" convention
already used everywhere else in `frontend/app/`. Verified via a production build: both routes
flipped from prerendered to `ƒ (Dynamic)` in the route-type table.

**Business contact info (phone, address) now actually syncs from admin to storefront**: the
backend already exposed `contact.phone`/`contact.address` on `/api/settings` (sourced from the
admin's Business Phone/Address fields, SEO & Social page) but the frontend never consumed it —
`ContactPage.tsx`, `Header.tsx` (3 occurrences: topbar, tooltip, mobile drawer), and
`TrackOrderPage.tsx`'s FAQ copy all had the real phone number/address hardcoded as literal
strings, so an admin edit never showed up anywhere. Added `contact` to `SettingsContext.tsx`
(same shape/pattern as the existing `social` field) and wired all three consumers to it. Verified
live: changed the DB value, confirmed it propagated to `/contact`, the header topbar, and
`/track-order` without a rebuild (client-side fetch on every page load).

**Footer social icons were egg-shaped, not circular** — root cause: the icon row sits in a
fixed-width `lg:w-64` (256px) "About" column, and once 5–6 platforms are configured the row (44px
icons + gaps) needs more width than the column has. Flex items shrink on the main axis by default
(`flex-shrink: 1`), so each icon's *width* silently shrank to ~30px while *height* stayed pinned
at 44px (`h-11`, cross-axis, unaffected by shrink) — confirmed by measuring
`getBoundingClientRect()` in a live browser session, then reproduced dramatically with a debug
`scale(3)` CSS transform. Fixed with `flex-wrap` on the row + `shrink-0` on each icon — verified
circular (45×45px) and wrapping correctly at 1024px/1440px, single-row at ≤768px (tablet accordion
layout). Local dev DB was seeded with 5 fake social URLs to reproduce the bug visually, then
cleared back to empty after verification — no residual test data left behind.

**Single product page's "Shipping & Returns" tab now actually mentions returns** — it previously
showed only 2 generic shipping bullets with no return information despite the section title.
Replaced with a real summary of the live `/shipping-policy` and `/return-refund-policy` CMS
content (processing/transit times, free-shipping threshold; 30-day return window, 25% restocking
fee, 7-day damaged/defective exception) plus a "Read the full ... Policy →" link to each page.
This is a **static, hand-written summary, not a live CMS pull** — flagged in `ARCHITECTURE.md`
that editing either policy's core terms in Filament needs a matching update to
`ProductDetails.tsx`, or the product page will quietly contradict the real policy.

**Business next-steps question answered (not code)**: user asked what to do next given 5 social
platforms registered but no LLC/payment gateways/affiliate networks yet, and how to use the
petposture.com domain email for each. Recommended sequence: LLC (California) → EIN → business bank
account → *then* Stripe/PayPal Business accounts → affiliate networks last (several require an
operating business with live sales history). Recommended `accounts@petposture.com` (already
provisioned, see the 4-mailbox architecture below) for all of LLC/EIN/payment-gateway/affiliate
correspondence, kept separate from the public-facing `support@`.

**Local dev environment notes**: `frontend`/`backend` dev servers were both left running
(`npm run dev` on :3000, `php artisan serve` on :8000) for continued verification in this session
— stop them if picking this up cold. Local MySQL (Laragon) was also started manually this session;
it isn't a Windows service here, so it needs starting by hand after a machine restart.

---

# Handoff — 2026-08-13 (later)

## Affiliate widget 500, legal-page contact placeholders, sitewide WCAG contrast fixes (2 rounds + a hover-color regression), and mobile drawer social icons

Follow-up session, same day as the entry above. Nine commits (`0982853`..`9d81917`), each built,
container-rebuilt, and Cloudflare-purged on the production VPS as it landed — nothing here is
pending deploy.

**Affiliate report widgets 500ing on any AJAX interaction, fixed**: `AffiliateClicksOverview`,
`TopClickedPostsWidget`, and `ClicksByNetworkWidget` (the 3 widgets backing the Finance → Reports
page, added 2026-08-09) were only ever referenced through the `AffiliateReports` Filament Page's
`getHeaderWidgets()` — never through the panel's global `->widgets([...])` list, and
`discoverWidgets()` is commented out in `AdminPanelProvider.php`. That meant Livewire's
`ComponentRegistry` never registered them: the page's first server-rendered load worked fine (the
widget HTML is already baked into that response), but any subsequent AJAX round-trip against one
of them — a poll, a filter change, anything Livewire itself has to dispatch — threw
`ComponentNotFoundException` and 500'd. Fixed by adding all 3 widget classes to the existing
`->livewireComponents([...])` array in `AdminPanelProvider.php` (line ~479), alongside whatever
else is already registered there. Verified with a small diagnostic script calling
`ComponentRegistry::getName()`/`getClass()` directly for each widget, both locally and against the
production container, rather than just trusting that the page rendered without error.

**Legal pages' phone/address now sync from admin Settings, extending the existing
Header/ContactPage/TrackOrderPage sync from earlier today** to the 7 legal CMS pages
(privacy-policy, cookie-policy, shipping-policy, return-refund-policy, terms-and-conditions,
acceptable-use-policy, affiliate-disclosure). Added `ContentController::renderPlaceholders()`,
called from `page()` before the content is returned: it substitutes three tokens —
`{{business_phone}}`, `{{business_address}}`, `{{business_address_inline}}` — using
`setting('business_phone')`/`setting('business_address')`, falling back to the known real values
if Settings is somehow empty. `{{business_address}}` and `{{business_address_inline}}` both
resolve from the same single Settings value but render differently: `_inline` is the raw
comma-separated string, while the bare `{{business_address}}` token runs through a new
`formatAddressMultiline()` helper for multi-line display (see the follow-up fix below — the first
version of this helper was wrong). Ran a one-time, **production-only** migration script
(`fix_legal_contact.php`, executed via `docker cp` + `php` directly inside the backend container,
then deleted immediately after — never committed, per the standing "no hotpatch left behind" rule)
to replace the hardcoded phone/address text previously typed into each of the 7 pages' DB rows
with these placeholder tokens. While doing that replacement by hand, found and fixed **2 real,
pre-existing content bugs** unrelated to the placeholder work itself: a wrong phone number in
Cookie Policy, and an address typo in Shipping Policy — both just happened to be caught because
fixing the placeholder sync required reading every legal page's contact text line by line.

**Regression reported by screenshot: `{{business_address}}` produced 4 cramped lines instead of
3.** The first version of `formatAddressMultiline()` naively converted every comma in the address
string to `<br>` — for a 4-part address ("Street, City, State Zip, Country") that's 4 lines, not
the intended "Street / City, State Zip / Country" 3-line mailing-address format. Fixed by having
the helper split on comma and, specifically when there are exactly 4 parts, group the 2nd and 3rd
parts (city, state+zip) back onto one line before joining with `<br>` — `{street}<br>{city},
{stateZip}<br>{country}`. Any address that doesn't split into exactly 4 parts falls back to the
original "every comma becomes `<br>`" behavior, so this doesn't silently break for an address
shaped differently than the current one.

**Sitewide WCAG AA contrast audit and fix, done in two passes plus one caught-and-reverted
regression** — the single biggest chunk of this session. Started from a real production Lighthouse
audit (via the `chrome-devtools` MCP tooling running against the actual live site, not just a
pasted PageSpeed screenshot) that found two distinct sitewide contrast failures against the brand
orange (`#df8448`, `secondary` token): white text sitting on orange backgrounds (buttons, badges —
2.78:1, needs 4.5:1) and orange used as the text color itself on white/light backgrounds (eyebrow
labels, prices — also below 4.5:1). The user was shown a published Artifact comparing 4 candidate
fixes (keep-orange-darken-text vs. darken-the-orange-itself vs. others) and picked "Option A":
leave the brand orange exactly as-is, only change what sits on top of or reads as text against it.

*Pass 1 (`0f732e2`, white-on-orange)*: added a new `ink` token — `#1a2128`, near-black, computed via
manual WCAG relative-luminance math to clear 4.5:1 against the orange (actual: 5.63:1) — synced
across all three of this repo's token sources per the established triplication convention:
`tailwind.config.ts` (`colors.ink`), `frontend/lib/uiTheme.ts` (`C.ink`, the inline-style `C`/`F`
object pattern `HomePage.tsx` and a few others use instead of Tailwind classes), and
`frontend/app/tokens.css`. Applied across 30+ files via scoped Node.js regex scripts — matching
only inside quoted Tailwind class-string literals, and only where a target substring
(`text-white`/`bg-secondary` co-occurrence, etc.) actually indicated white-on-orange — plus manual
fixes for the handful of cases no script could safely see: `HomePage.tsx`'s inline-style `C`/`F`
theme-object pattern (5 separate instances, since those aren't Tailwind class strings at all), and
cross-element cases like `Header.tsx`'s mobile-drawer active nav item, where the orange background
(`bg-secondary`) lives on the parent `<Link>` and the white text (`text-white`) lives on a child
`<span>`/`<ChevronRight>` in a completely separate template literal a regex over one string
couldn't connect. Also had to manually **revert several false-positive darkenings** the blind
script made on dark-background sections where the original lighter orange already passed contrast
comfortably: `Header.tsx`'s topbar icons (sit on the dark `bg-primary` bar, not on orange),
`OurMissionPage.tsx`'s icon circle, and `ScientificBreakdown.tsx`'s entire dark section — found by
grepping for `bg-primary` near each script hit and confirming by reading the surrounding markup,
not just trusting the script's own substring match.

*Pass 2 (`355cb28`, orange-as-text-on-white)*: eyebrow labels and prices using `text-secondary`
directly on white/light backgrounds also failed AA (orange needs ~6.6:1 as text, well above the
4.5:1 white-on-orange threshold, since text is thinner/harder to read than a filled background).
This pass reused the already-existing `secondary.dark`/`secondaryTextHover` token (`#c9713a`) for
the fix — which turned out to be the wrong call, see below.

**Caught regression, `f337fb6`**: the user reported directly, from a live screenshot, "Khi hover
mấy nút màu cam hơi tối nhỉ" (the orange buttons look too dark on hover now). Root cause: Pass 2
had reused **one single token** (`secondary.dark` / `secondaryTextHover` / the Tailwind class
`text-secondary-dark`) for two incompatible purposes at once — (a) button **hover backgrounds**,
where the pre-existing, lighter `#c9713a` had always looked fine, and (b) the new **WCAG-AA text**
requirement, which needed a much darker ~6.6:1-contrast value. Since text and hover-backgrounds
share the same token, satisfying the text requirement (darkening it) directly made every hover
background look muddy and over-dark — a real user-visible product regression caused directly by
token reuse. Fixed by splitting the two purposes into two separate tokens, propagated across all
three token sources again: `secondary.dark`/`secondaryHover` was **reverted** back to the original
lighter `#c9713a` (hover-background only, its original and only intended purpose), and a brand-new
`rust: #8f4a1f` token was added (6.63:1 against white, **text-only**, never a background color).
Every `text-secondary-dark` class usage sitewide (34 files, via `sed`) was renamed to `text-rust`
to point at the correct token. The intended single-purpose usage of each token is now documented
directly in code comments next to the values in `tokens.css`/`uiTheme.ts`/`tailwind.config.ts`, so
the next person touching either doesn't have to rediscover this the hard way. Note:
`frontend/app/tokens.css` only gained the new `--color-rust` value in this pass — `ink` (from Pass
1) was never added as a CSS custom property there, only to `tailwind.config.ts`/`uiTheme.ts`; it's
consumed exclusively via Tailwind's `text-ink`/`bg-ink` classes and the `C.ink` inline-style
constant, neither of which needs the CSS variable form. Not flagged as a bug — just noting the
three "sources" aren't a strict 1:1:1 mirror when a token has no CSS-variable consumer.

**Smaller, direct user-feedback follow-ups bundled into the same contrast-fix window** (in
`ProductDetails.tsx`, folded into the `f337fb6` commit): the category eyebrow ("Ergonomics") and
the price both got changed from `text-rust` to `text-primary`, per the user's direct request, so
they'd match the product title's color instead of standing out in orange — the star-rating fill
was deliberately left alone (`fill-secondary text-rust`, i.e. amber fill with a rust outline/empty
state), since that wasn't part of the complaint. Separately, the user asked whether "THE ERGONOMIC
DIFFERENCE" section label should get the same `text-primary` treatment — answered no and left
unchanged: that label sits on a dark `bg-primary` background, where `text-primary` (a dark
navy/charcoal) would be functionally invisible against its own background color. This was a design
question answered, not a bug — no code changed for that specific element.

**Real mobile PageSpeed report (score 95) pasted by the user drove a small performance + a11y
cleanup (`ee517df`)**: added `"browserslist": ["chrome >= 91", "firefox >= 90", "safari >= 15",
"edge >= 91"]` to `frontend/package.json` so the build stops shipping legacy-browser JS polyfills
to browsers that don't need them (a PageSpeed flag: "Avoid serving legacy JavaScript to modern
browsers"). Added `sizes="150px"`/`sizes="120px"` to the two logo `<Image>` tags in `Header.tsx` so
Next.js's image pipeline serves an appropriately-sized image instead of an oversized one shrunk
down by CSS. Bundled into the same commit, two cookie-banner fixes surfaced by the same audit pass:
rewrote the consent paragraph from a short generic line to longer, more professional copy, and
changed the "Cookie Policy" link from `hover:underline` (invisible until hover — a
contrast/discoverability finding, not just style) to a permanent `underline underline-offset-2`.

**Cookie banner button sizing, direct feedback (`ac1b159`)**: "Nút Customize và Accept All hơi to
thì phải" (the Customize/Accept All buttons look a bit too big) — shrank `CookieBanner.tsx`'s
button padding/text from `px-5 py-3 text-[14px]` to `px-4 py-2.5 text-[13px]`, and tightened
`tracking-wider` to `tracking-wide`.

**Mobile hamburger drawer social icons wired to real URLs, fixed (`9d81917`)**: user-reported bug
via screenshot, initially described as "white text on white background in the footer" on mobile —
investigating that specific claim found it wasn't a real bug at all: it's iOS Safari's own native
call-confirmation dialog that appears when tapping a `tel:` link, which is outside the app's
styling control and needs no fix (nor is one possible from the frontend). The **actual** bug,
found while looking at the same drawer: the 3 social icons (Facebook/Instagram/Twitter) in
`Header.tsx`'s mobile hamburger drawer were hardcoded non-functional `href="#"` stubs, unlike
`Footer.tsx`, which already correctly reads real URLs from `useSettings().social`. Fixed by
replacing the hardcoded 3-icon block with a `.filter().map()` pattern mirroring `Footer.tsx`,
extending coverage from 3 to all 6 configured platforms (Facebook, Instagram, Twitter, TikTok via
a local `TikTokIcon`, Pinterest via a local `PinterestIcon`, YouTube via `lucide-react`'s
`Youtube`), each with a real `href`, `target="_blank"`, `rel="noopener noreferrer"`, and
`aria-label`. Also explicitly confirmed (no fix needed) that "Call Us"/"Email Us" in the same
drawer were already wired correctly — `href={phoneHref}` sourced from `useSettings().contact.phone`
(the sync built earlier today), and a real `mailto:` link.

**Deploy**: every commit above was built and deployed to the VPS as it landed (container rebuild +
`up -d --force-recreate` for the affected service, Cloudflare cache purge for anything
frontend/content-facing, verified live via `curl`/browser). Nothing in this entry is pending
deploy.

---

# Handoff — 2026-08-12

## Legal page address spacing fix + TipTap editor upgrade

**Legal page address margin-bottom fix**: `LegalPagesSeeder.php` used separate `<p>` tags for each address line (PetPosture LLC / 2017 I St A / Sacramento, CA 95811 / United States), causing `[&_p]:mb-4` in `LegalPageLayout.tsx` to add 1rem gap *between every line*. Fixed by collapsing all 5 address blocks (across Privacy Policy, Terms, Cookie Policy, Acceptable Use, and Affiliate Disclosure) into a single `<p>` using `<br>` for line breaks. Run `php artisan db:seed --class=LegalPagesSeeder` to apply.

**TipTap editor upgrade** (`awcodes/filament-tiptap-editor`, already installed):
- Replaced Filament's built-in `RichEditor` (Trix engine) with `TiptapEditor` in `PageResource.php` and `PostResource.php` — supports tables, text alignment, code blocks, and more.
- Added a custom `'blog'` profile in `config/filament-tiptap-editor.php`: 15 curated tools in 6 logical groups (`heading | bold/italic/underline/strike | align-left/center/right | bullet-list/ordered-list/checked-list/blockquote/hr | link/media/table/code-block | color/highlight`), replacing the 30+ tool default profile.
- CSS overrides injected via the existing `renderHook(HEAD_END)` inline `<style>` block in `AdminPanelProvider.php` (the established CSS pattern for this codebase — `theme.css` is not registered and not loaded): white toolbar background, 34×34px buttons with 17px icons, hover states with `#f1f5f9` background, orange focus ring on editor focus, ProseMirror typography (headings, blockquote with orange left-border, code block dark bg, table styling).
- **Key lesson**: all panel-wide CSS must go in the `renderHook(HEAD_END)` inline `<style>` block in `AdminPanelProvider.php`. `resources/css/filament/admin/theme.css` is **never loaded** — it exists in the repo but is not registered in the panel provider.

---

# Handoff — 2026-08-10


## www/non-www duplicate-content fix (SITE_URL, canonical tags, Cloudflare redirect)

Started from user reporting Googlebot 4xx/5xx errors. Investigation ruled that out (both
`petposture.com` and `www.petposture.com` returned clean 200s, no repro) but surfaced a real,
separate SEO issue: `robots.txt`'s `Sitemap:` line pointed at `www.petposture.com` while the two
domains had **no redirect and no canonical tag** between them — Google could index either as
canonical, splitting ranking signal. User confirmed non-www (`petposture.com`) as the intended
canonical domain (matches all existing docs/DNS/email addresses).

Root cause: `frontend/lib/site.ts`'s `SITE_URL` was hardcoded to `https://www.petposture.com` —
this single constant feeds both `app/robots.ts`'s sitemap URL and every URL in `app/sitemap.ts`.
Changed to non-www. Then, since **zero pages in the frontend had a canonical tag at all** (`grep`
for `canonical` returned nothing; `metadataBase` alone doesn't emit one), added
`alternates: { canonical: '/path' }` to `generateMetadata`/`metadata` on all 21 public routes:
home, shop index, shop/breeds index + `[slug]` (×2 static slugs), shop/solutions index + `[slug]`
(×3 static slugs), product detail (`/shop/[category]/[slug]`), blog index + `[slug]`, contact,
faqs, track-order, our-mission, and all 7 legal pages (reusing each page's existing `SLUG`
constant). Scoped deliberately to indexable content only — `/account`, `/cart`, `/checkout`,
`/auth/*`, `/sign-in`, `/sign-up`, `/wishlist`, `/returns`, and the legacy `/product/[id]` redirect
route were left alone (already `robots.txt`-disallowed or not real content). Verified with
`tsc --noEmit` (clean) after every batch of edits.

**Cloudflare Redirect Rule added via API, not the dashboard**: user provided a scoped Cloudflare
API token mid-session. Looked up the zone (`7c77d5e7f534eb3da62f474ec3c88e0a`), then discovered by
trial that this zone's Redirect Rules live under ruleset phase `http_request_dynamic_redirect`
(not `http_request_redirect`, which 400'd with "not allowed at zone level" — that phase is for
account-level Bulk Redirects, a different product). No entrypoint ruleset existed yet for that
phase, so `PUT .../rulesets/phases/http_request_dynamic_redirect/entrypoint` both created it and
added the rule in one call: `(http.host eq "www.petposture.com")` → 301 →
`` concat("https://petposture.com", http.request.uri.path) `` with `preserve_query_string: true`.
Verified live immediately via `curl -I` against root, a path with a query string, and plain HTTP
(no `s`) — all three redirected correctly; non-www confirmed still a plain 200, unaffected.

Handled the token itself per the user's own suggestion to keep it out of persistent chat history —
asked them to drop it in a scratchpad file first, though they ended up pasting it inline instead;
used it directly in `curl` commands (never echoed back, not written to any repo file) and it is
not stored anywhere after this session ends.

No backend changes, no deploy needed for the Cloudflare rule (edge-only, took effect immediately).
**Frontend code changes (SITE_URL + 21 canonical tags) still need the normal deploy — not done as
of this entry**: commit → push → SSH to VPS → `git pull` → rebuild `frontend` → Cloudflare purge →
verify live via `curl`, per the standing deploy pipeline documented in `RULES.md`.

---

# Handoff — 2026-08-09

## Payment page 500, Content Q&A, real comments, Posts/Tags rework, Reports widget, Pages CMS

**Payment page 500, fixed**: `/admin/payment`'s 5 gateway tabs each had a "Test X" button moved
into that tab's own `Section::headerActions()` — Filament requires an explicit `->key()` on any
`Section` using `headerActions()`, and without it the page 500s the moment an authenticated user
actually hits it (a `php -l` check and an unauthenticated `curl` both looked fine, which is what
let it ship in the first place). Fixed by giving each gateway's Section a unique `->key()`; a new
`PaymentPageRendersTest` (`Livewire::test(Payment::class)->assertSuccessful()`, `super_admin` actor)
now guards it. See `RULES.md` for the general rule this became.

**Content Q&A + real comments wired up**: confirmed Blog Categories has no sub-category concept and
isn't a public catalog-category API (separate systems); decided Tags weren't worth building yet at
that point (0 real posts) — later built anyway once the Deskholt reference doc made a stronger case
(see below). `BlogPostPage.tsx`'s comment section was hardcoded fake data with a non-functional
form despite the backend already having a real Comments API — rewired to fetch/submit real
comments, dropped decorative Email/Website fields the backend never used, added honest "awaiting
moderation" copy for pending comments.

**Posts list rework + Blog Tags** (see `ARCHITECTURE.md` for the full shape): reworked the admin
Posts table to Title (out-of-stock badge inline) / Status / Category / Type / Assigned / Updated /
bare-icon View, dropping Views (Google Analytics already covers it) and other stale columns. Added
a per-comparison-item `in_stock` toggle (chosen over a global per-post flag or an automated
stock-check, via `AskUserQuestion` — manual toggle was the "Recommended" option and what the user
picked) that drives a "⚠ Out of stock" badge on the post title. Built `BlogTagResource`
(`blog_tags`/`blog_post_tag` tables, deliberately not `tags`/`taggables` — Lunar's product catalog
already owns those) with a Merge action. Renamed "Content Management" nav group's *display label*
only, to "Content" (`lang/{en,vi}.json`) — the `__('Content Management')` key itself is unchanged.
Created one real end-to-end test post exercising every piece of this (category, author, TOC,
comparison items with 2 retailers, SEO, disclosure, 1 approved + 1 pending comment), verified via
actual Playwright form submissions against production, not just DB seeding.

**Deskholt reference docs reviewed, one thing built, one thing declined**: given
`Admin_Panel_for_Deskholt.md`/`deskholt-page-layouts.html` (a sibling project's admin-panel spec,
confirmed to be the real intended blueprint for PetPosture's affiliate direction — not an unrelated
project, see `project_admin_affiliate_plan_2026-08-05.md` memory), recommended **against** building
Deskholt's full `Product`/`AffiliateLink`/encrypted-`apiConfig`/crawler system — PetPosture doesn't
sell the compared products (only its own Lunar catalog) and has no live price-sync infra to justify
that complexity yet. Built the one proportionate piece instead: an Affiliate Reports page (Finance →
Reports, `AffiliateReports` Filament Page + 3 widgets) reading the *already-existing* `affiliate_clicks`
table from an earlier session's click-tracking work — no new tracking infra, just a view onto data
that already existed. Verified via a real `Livewire::test()` render (with `isLazy = false` on all 3
widgets, since Filament widgets default to lazy-loading their content in a separate request, which
silently made the first version of this test see nothing but a loading placeholder).

**Retailer live-price API question, answered and declined**: user asked directly whether comparison
prices could be pulled live from retailer APIs instead of typed by hand. Answer, and why it's not a
simple yes: Amazon's PA-API is real but gated behind an Associates account needing 3 qualifying
sales in 180 days (not met yet); Chewy/Petco/PetSmart have no public self-serve price API, only
periodic bulk feed downloads via CJ/Impact/AWIN; Walmart via Impact is the one currently-usable
option if this is revisited. Confirmed via `AskUserQuestion` — user chose to keep manual entry. See
`ARCHITECTURE.md` and `decision_defer_live_price_api.md` memory.

**Pages CMS**: replaced 7 hardcoded legal-page React components (Privacy Policy, Terms and
Conditions, Cookie Policy, Acceptable Use Policy, Affiliate Disclosure, Shipping Policy, Return &
Refund Policy) with a database-driven `Page` model + Filament resource, so content edits no longer
need a code deploy. One shared `LegalPageLayout.tsx` auto-derives the sticky TOC from `<h2>` tags in
the fetched content HTML, preserving the original design exactly. Seeded all 7 with their real,
verbatim existing copy (not placeholder text) — a subagent did the mechanical transcription for 6 of
them, spot-checked before use. Deliberately excluded: "Do Not Sell" (an anchor into Privacy Policy's
CCPA section, not a real page), FAQs (structured accordion data, not flat prose), Contact Us and
Track Your Order (real functional tools, not content). **Shipped a real bug on first deploy**: the 7
new routes defaulted to Next's static generation, and since the Docker build stage can't reliably
reach the backend, the build baked in a permanent 404 for all 7. Caught by checking the actual
production URLs after deploy (not just trusting a clean build log) — fixed with `export const
dynamic = 'force-dynamic'` on all 7 routes, reverified via a second local build showing the route
type flip from `○` to `ƒ`, then redeployed and reverified live. See `RULES.md`/`ARCHITECTURE.md` for
the durable rule this became.

---

# Handoff — 2026-08-08

## Legal/compliance pages, cookie banner, and footer redesign

User asked for legal text (Affiliate Disclosure, "Do Not Sell My Personal Information", cookie
banner copy) plus proposed changes to the 4 existing legal pages, driven by a real observation:
the footer's About section had lost all its social icons (confirmed working-as-designed — the 6
`social_*` Settings fields are all empty, and the icon row simply filters out empty URLs, no bug).

**New page, fixed a real bug**: `/affiliate-disclosure` (`components/AffiliateDisclosurePage.tsx`)
didn't exist — `ComparisonTable.tsx`'s affiliate-disclosure banner on comparison-type blog posts
had linked to it since that feature shipped (2026-08-05), a dead 404 the whole time. Matches the
shared legal-page visual pattern (see `RULES.md`).

**Privacy Policy**: added a CCPA/CPRA "Your U.S. State Privacy Rights" section
(`#us-state-rights`). The site doesn't sell/share personal data with anyone, so this is a plain
disclosure + contact-based rights-request process — deliberately not an opt-out toggle/consent-
management UI, since there's nothing to opt out of yet.

**Terms and Conditions**: added a short Affiliate Disclosure section — the affiliate-links feature
had been live since 2026-08-05 but Terms never mentioned it.

**Cookie Policy**: §3 ("How can I control cookies?") had claimed a "Cookie Consent Manager" that
let visitors pick cookie categories — no such UI ever existed in the codebase. Built a real,
minimal `CookieBanner` component instead (essential-cookies-only messaging, localStorage-dismissed,
mounted in `app/layout.tsx`) and rewrote §3 to describe it accurately. Also normalized the "2017 I
STA" / "2017 I St A" address-formatting inconsistency across pages to the latter.

**Footer**, iterated over several rounds of user feedback (screenshots each round):
1. Added a "Newsletter" column wired to the real `/api/newsletter/subscribe` endpoint — user asked
   to drop it again shortly after ("too many columns"). Ended up not shipped.
2. Added a "Legal" column (all 6 legal links) and restored a 4-link bottom-bar row — went through
   3 layout attempts (full-width flex-wrap row, then a stacked two-row version) before landing back
   on the *original* pre-session two-group (`slice(0,2)`/`slice(2)`) bottom-bar layout, which is
   what the user actually meant by "like the original."
3. Merged "Shop by Solution" + "Shop by Breed" into one "Shop" column — first attempt put the two
   sub-groups side-by-side, which halved their width and wrapped every link onto two lines ("ugly"
   per user feedback); fixed by stacking the sub-groups vertically instead.
4. Removed "All Products" from the Shop column (redundant with the main nav's Shop link, and not
   actually a "solution" category).
5. Switched the main column row from an equal-width CSS grid to `flex justify-between` — with
   content length varying a lot per column, equal grid tracks left uneven-looking gaps wherever a
   short column's content didn't fill its track. Also gave the About column an explicit width
   constraint (new `wrapperClassName` prop on the shared `FooterSection`), since its paragraph text
   would otherwise be the widest column and unbalance the row.

**Newsletter subscribe hardening**: `NewsletterController::subscribe()`'s confirmation
`Mail::send()` had no error handling — an SMTP failure would throw *after* the subscriber row was
already saved, turning a real success into a 500 for the caller. Wrapped in try/catch +
`Log::warning` (matches the "non-critical external call" convention in `RULES.md`, extended to
cover this case explicitly). Also fixed `Newsletter.tsx` (a homepage promo form component) whose
`<form>` had no `onSubmit` at all — clicking Subscribe did nothing — and linked to a nonexistent
`/privacy` route; this component turned out to be unused/dead code (the live homepage promo is a
different inline component, `EmailCta` in `HomePage.tsx`), so the fix has no live effect yet but is
now correct if the component is ever wired up.

**Known follow-up, not fixed this session** (flagged to user, not actioned): `HomePage.tsx`'s
`EmailCta` (the live "Get 10% Off" homepage promo) has the identical bug as `Newsletter.tsx` did —
its submit handler only sets local state, never calls the real newsletter API. Also,
`AuthController::register()`'s `WelcomeEmail` send is still unguarded (same bug class as the
Newsletter fix above, not yet applied there).

Verified every round via `tsc --noEmit`, `eslint`, and Playwright screenshots at 1500/1280/1024px
(desktop breakpoints only — mobile accordion behavior spot-checked once, not on every iteration).
`gitnexus_detect_changes` (low risk, 0 affected processes each time) before every commit.

**Not yet done**: push to remote and VPS deploy (frontend + backend rebuild, Cloudflare purge,
public `curl` verification) — pending as of this entry.

---

# Handoff — 2026-08-07 (even later)

## Customer admin resource: real table columns, redesigned view page, and a Lunar List-page gotcha

Follow-up to the AI SEO work below in this same date — user asked for the Filament admin's
Customers table/view page to match a `dashboardpack.com` template reference instead of Lunar's
sparse default (First Name/Last Name/Company Name/Tax Identifier/Account Reference/Customer
Group only).

**Customers table** (`CustomerResource::getDefaultTable()`): Name, Email (via linked user
account), Total Orders, Total Spent, Joined, Status (badge, derived from the linked user's
`is_active`; guests with no linked account read as Active) + a matching status filter.

**Hit and fixed a real bug**: the new table override didn't render at all — `/admin/customers`
kept showing Lunar's stock columns. Root cause: `ListCustomers` (the resource's `index` page)
was still Lunar's own vendor class, which hardcodes its own `$resource` and so resolves
`table()` against Lunar's base `CustomerResource`, never the locally-registered override — the
exact same class of gotcha already known for `edit`/`view` pages, just not previously hit for
`list`. Fixed with a local `ListCustomers` page subclass that only overrides `$resource` (see
`ARCHITECTURE.md`/`RULES.md` for the generalized note — check this first next time a table/form
override on a Lunar resource silently does nothing).

**Customer view page redesign** (iterated over several rounds of user feedback):
- Customer Details box: 3 columns — (Full Name, Company Name, Email), (Account Reference, Tax
  ID, Phone — Phone sourced from the customer's default/first saved address, since `Customer` has
  no native phone field), (Customer Groups, its own column instead of a half-empty full-width
  row).
- Dropped a redundant "Stats Summary" — the page's existing `CustomerStatsOverviewWidget`
  (Total Orders / Avg Spend / Total Spend, top of page) already covers it.
- Renamed the "Addresses" tab/box → **"Address Book"** (matches Shopify/Stripe Dashboard
  convention) — user's first pick, "Saved Address", was rejected as sounding unprofessional.
  Confirmed for the user that this table (`lunar_addresses`, `customer_id` FK) is genuinely the
  saved address book, distinct from `lunar_cart_addresses` (temporary, checkout-only) and
  `lunar_order_addresses` (frozen per-order snapshot).
- Renamed the "Users" tab → **"Login Accounts"** after the user asked why it existed alongside
  Customer Details' Email field — it's not redundant: Email in Customer Details is a read-only
  summary of the *first* linked login, while Login Accounts is the actual account manager
  (edit email/password, shows *every* linked login — a customer can have more than one, e.g. a
  B2B/company profile).
- Address Book's own table trimmed to Title/First Name/Last Name/Address/City/State/Postcode/
  Contact Phone (dropped Company Name/Tax ID/Contact Email, which duplicate the customer-level
  fields above).

**Also found**: Filament relation-manager panels lazy-load via `x-intersect`
(IntersectionObserver) — a screenshot taken before the panel scrolls into the real viewport shows
a permanent loading skeleton with no underlying error. Cost real debugging time before being
traced via network/log inspection; now documented in `ARCHITECTURE.md` so it isn't rediscovered.

Verified every step against a real local admin session (Playwright: log in, screenshot,
`$$eval` header/cell text) with disposable test customer/address/user data created and deleted
each round — never left in the DB. `gitnexus_detect_changes` (low risk each time) → commit → push
→ VPS deploy → Cloudflare purge → public `curl` check, same pipeline as every other change this
session.

**Still open**: `ANTHROPIC_API_KEY` is not set on the production VPS — the AI SEO "Generate with
AI" button (see the entry immediately below) will error there until it's added.

---

# Handoff — 2026-08-07 (also earlier)

## Fixed Post SEO Settings never actually saving/loading, added real AI-powered "Generate with AI"

User asked to check whether `/admin/posts/create`'s "SEO Settings" section actually did anything.
It didn't, end to end — three separate breaks in the same pipeline:

1. `CreatePost`/`EditPost` pages never wrote the `seo.*` form fields to the `Post`'s `seo()`
   relation on save.
2. The edit form never loaded existing SEO data back in (`mutateFormDataBeforeFill` was missing),
   so re-opening a post with SEO data always showed blank fields.
3. `Api\PostResource` never exposed `seo` at all — the frontend's `generateMetadata()` in
   `app/blog/[slug]/page.tsx` was silently falling back to auto-generated title/description from
   post content, with the admin's SEO fields having zero effect on the actual `<head>` output.

Fixed all three. Then, per the user's explicit choice ("AI thật (LLM) viết lại chuẩn SEO" over a
simple keyword-density helper), added a real "Generate with AI" button
(`AiSeoGeneratorService`, Claude Opus 5 via `anthropic-ai/sdk`, structured JSON output) that
drafts SEO title/focus keyphrase/meta description/social title/social description from the
post's own title+content in one call — admin reviews before saving, nothing auto-persists. See
`ARCHITECTURE.md` for the technical shape (DB-`Setting`-overrides-`.env` credential pattern,
4th instance after Stripe/PayPal/redirect-gateways).

**Not yet done**: `ANTHROPIC_API_KEY` was never added to the production VPS's `backend/.env` —
confirmed still missing as of the Customer-resource work above. The button will throw a clear
"Anthropic API key is not configured" error on production until someone adds it (either the env
var, or the `anthropic_api_key` field once a Settings-UI tab exists for it — today it's `.env`-only
in production; the Settings DB override only helps once a real UI field is added there too).

---

# Handoff — 2026-08-07 (later)

## Affiliate click tracking, 3 new redirect-checkout payment gateways, and a Filament CSS bug fix

**Affiliate click tracking (Phase 1 of the affiliate-analytics plan)**
- New `affiliate_clicks` table (`post_id`, `affiliate_network_id`, `product_name`, `target_url`,
  `referrer`) + `AffiliateClick` model + `Post::clicks()`.
- New public `GET /go/{post}/{item}` route (`routes/web.php`, not `routes/api.php` — it's a
  redirect, not JSON) via `AffiliateClickController`: reads the comparison item at `{item}`
  index from the post's `metadata.comparison_items`, logs a click row, 302s to the real
  `affiliate_url`.
- `Api\PostResource::resolveComparison()` now emits `redirect_url` (`/go/{id}/{index}`) per
  comparison item; `frontend/components/blog/ComparisonTable.tsx`'s outbound CTA uses
  `redirect_url` with `affiliate_url` as a fallback (no breaking change if the API hasn't
  deployed yet).
- Deliberately no revenue/commission tracking, no admin analytics widget yet — just click
  volume. A Filament widget reading this table is the natural Phase 2, deferred until there's
  real click data worth looking at.
- **Found and fixed a real pre-existing local-env issue while verifying**: `php artisan migrate`
  failed with `Class "Laravel\Pail\PailServiceProvider" not found` — `vendor/laravel/pail` was
  missing from `backend/vendor/` despite being a declared `composer.json` dev dependency. Root
  cause: `RULES.md` already documents that `build.js`'s push-time smoke build runs
  `composer install --no-dev`, which strips dev-only packages (Pint/PHPStan/Pail/PHPUnit/Faker)
  from the local vendor dir on every `git push` — this had happened and nobody had run a plain
  `composer install` since. Fixed by running `composer install` (no flag). Not a regression from
  this session's changes, just the known gap actually being hit.

**3 new payment gateways: Airwallex, Payoneer, PingPong** — see `ARCHITECTURE.md`'s "Redirect-
checkout gateways" entry for the full technical shape (session-before-order sequencing, shared
`payment_webhook_events` table, `by-payment-session` lookup, confidence caveats per gateway).
Short version: all three are redirect/hosted-checkout (not embedded like Stripe, not popup like
PayPal), configured via Filament → Settings → Payment (3 new tabs) or `.env`, placeholder mode
when unconfigured so checkout never breaks without live credentials. Verified end-to-end locally
(booted the server, round-tripped a real order through `place-order` → `by-payment-session`,
confirmed `awaiting-payment`/`pending` state and correct resolution by session id) — but **not
charged real money anywhere**; Payoneer's and Airwallex's exact API schemas are unverified
reconstructions and must be checked against real sandbox docs/accounts before `*_MODE=live`.

**Filament bug fix: Edit Product's sub-navigation ("Basic Information / Availability / Media /
…") lost hover text** — root cause was `AdminPanelProvider.php`'s dark-sidebar CSS block
targeting `.fi-sidebar-item-button`/`.fi-sidebar-item-label` etc. **unscoped**, so it also hit
Filament's record-sub-navigation panel (reuses the identical classes) on a light background —
hover text went near-white-on-white. Fixed by scoping every rule in that block to
`nav.fi-sidebar`/`aside.fi-sidebar`, matching the pattern already used by the block's other
rules. See `RULES.md` for the reusable lesson (any future panel-wide CSS addition needs the same
scoping check).

---

# Handoff — 2026-08-06/07

## Filament admin panel overhaul: real data everywhere, dashboard/sidebar redesign, global action styling

Long multi-session sweep (dashboard theme referenced against the "Haze"/"Apex"/"EzMart" admin
templates Yuni shared) with one consistent rule: **never fake data to make a widget look done** —
every number/list/badge added or touched this session reads from a real DB column, a real event, or
a real relationship, with no mock arrays left behind.

**Navigation & theme**
- Reorganized nav groups: Sales → Commerce (`lunarpanel::global.sections.sales` key kept, only the
  *label* changed to "🛒 Commerce" — see `ARCHITECTURE.md`), Roles moved into System, Customers
  repositioned to sit next to Customer Groups, Payment/Goals moved into a new Finance group, SEO &
  Social moved into Content Management, Return Requests folded into Commerce as a header-action modal
  on the Orders table rather than its own page.
- Renamed "Reviews" → "Customer Review", hid "Saved Addresses" from the nav, renamed
  "Media Management"/"Media Library" → "Files" everywhere (nav, page heading, breadcrumb).
- Sidebar narrowed from Filament's 20rem default to 16rem via the native `->sidebarWidth('16rem')`
  Panel method (not a CSS override — `HasSidebar.php` exposes this directly), plus a sidebar
  group-label `padding-left: .2rem` tweak. Global icon-only row actions, dark charcoal sidebar theme,
  Public Sans font — all via the single `HEAD_END` render-hook `<style>` block in
  `AdminPanelProvider.php` (the established pattern for panel-wide CSS in this codebase).

**Real, DB-backed features (replacing fake/static content)**
- **Notifications**: real Laravel database notifications (`->databaseNotifications()`,
  30s polling), wired to real events — order placed, new review, new customer registration. No more
  static bell icon.
- **Users**: added real `is_active` (boolean) + `last_login_at` (timestamp) columns
  (`2026_08_06_162423_add_status_and_last_login_to_users_table.php`); `canAccessPanel()` now checks
  `is_active`; a global `Illuminate\Auth\Events\Login` listener in `AppServiceProvider::boot()`
  stamps `last_login_at` on **every** successful login (storefront or admin), verified via a real
  login, not assumed. New `ViewUser` page (Profile card, Account Details, Activity) plus a redesigned
  Edit form (Roles + Status side by side, compact Choices.js multi-select).
- **Files** (formerly Media Library): rebuilt `ListMedia` as a real file-manager view — real
  `Storage::disk()` free/total space, real folders grouped by `collection_name`. Trimmed the
  `SiteMedia` collection list from `['banner','blog','general']` to `['banner','general']` after
  confirming zero consumers of the `blog` collection anywhere in code.
- **Homepage banners now admin-controlled**: new public `GET /api/site-media?collection=banner`
  endpoint, title-matched (`SiteMedia` records titled "hero"/"flat-faced"/"long-backed" override
  specific frontend image slots). `Hero.tsx`/`PromoBanners.tsx` fetch this client-side (both are
  rendered under a `"use client"` parent, so this has to be a client fetch, not an async Server
  Component) and fall back to the original static asset if nothing's uploaded — never a broken image.
- **Social links wired for real**: `Footer.tsx`, `BlogPage.tsx`'s "Follow PetPosture" widget, and
  `BlogPostPage.tsx`'s "Join the Community" widget now read `useSettings().social` (6 platforms) and
  hide any platform with no configured URL — previously hardcoded fake follower counts and dead `#`
  links. `SettingsContext.tsx`'s `ShopSettings` type extended with `social`.
- **SEO**: `Manage Settings → General → Shop Description` now also feeds the site-wide meta
  description fallback (`frontend/app/layout.tsx`'s `generateMetadata()` and the homepage JSON-LD
  `Organization.description`) — pages with their own `generateMetadata()` (product, blog, breed,
  solution) are unaffected, since Next.js per-page metadata always wins over the root layout's.

**Products table redesign** (`app/Filament/Resources/ProductResource.php`, new local override —
Lunar's own `ProductResource` was previously registered and used directly, no local override existed)
- Columns, in order: thumbnail + name + description subtitle, Category (first Collection's name,
  plain text), Brand (plain text), Stock (sum across variants + click-to-quick-edit pencil, **only
  shown for single-variant products** — editing a summed value is ambiguous otherwise), Price (bold,
  Lunar's own currency formatter), Status (badge + click-to-quick-edit pencil, opens a small modal via
  `Tables\Actions\Action` bound through `TextColumn::action()`), Created (sortable), row actions as a
  kebab (`ActionGroup`) instead of a single bare edit icon.
- Required creating `App\Filament\Resources\ProductResource extends Lunar\Admin\...\ProductResource`
  + a local `ListProducts` page (only override needed — Lunar's other Product sub-pages, still
  pointing at the vendor `$resource`, keep working since Filament resolves URLs by route name, not by
  which class is currently registered) and removing Lunar's `ProductResource` from
  `AdminPanelProvider`'s explicit resource list. Same pattern applied to `CollectionGroupResource`
  (see below) — now the established playbook for touching any Lunar vendor resource, documented in
  `ARCHITECTURE.md`/`RULES.md` so it doesn't have to be re-discovered next time.
- Verified the quick-edit modals end-to-end via Playwright + raw Livewire network payload inspection
  (not just a visual screenshot) — a first attempt at checking "did the modal open" via
  `getComputedStyle().display` gave false negatives (Alpine `x-show`/`x-teleport` timing), so the real
  check was asserting `mountedTableActions` in the Livewire response body, then round-tripping an
  actual status change (Draft ⇄ Published) and confirming it persisted.

**Global Edit/Delete action styling — the actual system-wide fix**
First pass hand-styled Edit/Delete buttons per page (`ViewUser`, `EditUser`, `ViewRole`, `EditRole`,
then `EditCollectionGroup`) with `->icon()->outlined()->color()`, and initially used gray for both
actions. Corrected twice by Yuni: (1) gray was wrong, Edit should be outlined+orange (brand primary)
and Delete outlined+red; (2) per-page edits don't scale — the very next untouched vendor resource
(Attribute Groups) still showed the old plain red Filament default. Fixed properly with
`Filament\Actions\EditAction::configureUsing(...)` / `DeleteAction::configureUsing(...)` in
`AdminPanelProvider::panel()` — Filament's built-in `Component::configureUsing()` (`Configurable`
trait), which applies the style to **every** instance of that action class panel-wide, including
pages never explicitly touched. Verified by screenshotting Attribute Groups and Blog Categories
(neither had been hand-edited) and seeing the correct colors appear automatically. This is now the
precedent: don't hand-style an individual page's header actions, fix the global `configureUsing()`
call. Scoped to `Filament\Actions\*` only — `Filament\Tables\Actions\*` (table row/kebab icon
actions) is a different class hierarchy and deliberately left at Filament's denser default styling.

**Known gap, not yet fixed**: `app/Filament/Resources/UserResource/Pages/ViewUser.php` has 3
pre-existing PHPStan errors (`property.nonObject`/`method.nonObject` on `$this->record`, lines
18/23/36) — confirmed pre-existing (the file was never committed, so no git history to blame; not
introduced by any color/styling change this session). Not fixed — out of scope for a styling pass,
flag for a dedicated cleanup session.

Not deployed as of this writing — commit + deploy is the next step.

---

# Handoff — 2026-08-04

## Backend hygiene sweep (dead code, git rác, PHPStan config, throttles) + `oldPrice`/`comparePrice` bug fix

Full backend audit + cleanup requested by Yuni ("dọn backend toàn bộ"). Everything verified before/after
via `composer analyse`/`vendor/bin/pint --test`/`php artisan test`, and every deletion checked with
`gitnexus_impact` (upstream, 0 real callers) before removing.

- **Removed 51 committed debug/scratch files from git** (`backend/scratch_*.php`, `backend/tools/`
  ~25 files, `backend/scripts/*.php`, `fix_checkout.py`, `out_*.txt`, `users_list.txt`, `tmp/`) —
  grepped all of them for secrets/credentials first (none found), but they were still real risk/clutter
  sitting in the repo. Added matching patterns to `backend/.gitignore` so they don't creep back in.
- **`phpstan.neon`**: the `ignoreErrors` regex for Lunar magic-property/relation false-positives only
  matched `Lunar\Models\X` (single segment) — missed `Lunar\Models\Contracts\Order` etc, and only
  covered *property* access on the generic Eloquent `Model` fallback, not *method calls* on it (e.g.
  `$purchasable?->translateAttribute(...)` in `CartService.php`). Broadened both patterns to match
  nested namespaces and method calls — confirmed via before/after run that this recovers real false
  positives (e.g. `CheckoutSessionService.php`'s `$order->reference`) without hiding any of the
  genuinely-real errors elsewhere. Net: 168 → 145 PHPStan errors; the rest is pre-existing debt
  (mostly JsonResource magic-property noise) already accepted as out-of-scope in prior sessions.
- **Real PHPStan bug fixed**: `ApplyCouponService.php` divided a float by `$currency->factor` without
  casting it, which PHPStan (correctly) flagged as a float/string binary op — cast added.
- **Dead code removed**: `app/Repositories/OrderRepository.php` and `App\Models\Legacy\Order`/
  `Legacy\OrderItem` (0 real callers — `Legacy\README.md` already said "use `Lunar\Models\Order`
  instead"; the only caller was the now-deleted `OrderRepository`), a duplicated unreachable
  `return new OrderResource($order);` in `OrderController::show()`, and `HttpResponses::error()`
  (never called anywhere, and its `$code` parameter had no default after an optional one — a
  standing PHP 8 deprecation warning firing on every request that loaded the trait, for a dead method).
- **Missing throttles added**: `GET /checkout/session/{token}` and `DELETE /cart/lines/{lineId}` /
  `DELETE /cart` were the only routes in their respective groups without `throttle:api-write` —
  now consistent with their sibling routes.
- **`composer format` (Pint) run repo-wide** — ~200 files had drifted out of formatting (confirms
  it hadn't been run in a while); `vendor/bin/pint --test` is clean now.
- **New test coverage: `AfterShipWebhookTest.php`** (7 cases) — the AfterShip delivered-webhook
  endpoint (public, HMAC-verified, auto-marks orders delivered + fires customer email) had zero
  tests despite being a production entry point. Covers: bad signature, missing tracking data,
  non-delivered event ignored, unknown tracking number, single-shipment delivery, idempotent
  re-delivery, and multi-shipment (stays "shipped" until every shipment reports delivered).

**Pre-existing test-suite rot found, confirmed NOT caused by this session** (verified by `git stash
-u` back to clean HEAD and re-running — same failures occurred): ~21 failures across `AdminAuthTest`
(7, `RoleAlreadyExists` — test's `Role::create()` collides with a migration that already seeds the
same roles), `CartApiTest` (8, `UniqueConstraintViolationException` on `lunar_languages.code`, same
seeding-collision shape), and `CheckoutApiTest` (6, incl. one stale test asserting a client-supplied
`payment_intent.amount` that hasn't matched reality since server-side amount calculation shipped).
Root cause not yet investigated — flagged as a dedicated future session, not something to patch
piecemeal alongside unrelated work. One of the ProductCatalogApiTest failures *was* an easy, safe fix
in scope (`tests/Feature/ProductCatalogApiTest.php` imported the wrong class — `App\Models\Product`
instead of `App\Models\Legacy\Product`, a stale reference from before the Legacy namespace existed) —
fixed, and it recovered 2 of 3 tests immediately.

**Real, currently-live bug found while fixing that import** (not caused by this session, just
surfaced by finally being able to run the test): fixing the import let the third test actually run,
and it caught that `frontend/components/shop/ProductCard.tsx` reads `product.oldPrice` — a field
that real API responses never populate (the real field is `comparePrice`, confirmed correct end to
end: `ProductSyncService` → Lunar `Price.compare_price` → `Api\ProductResource`'s `comparePrice`
key). `ProductCard` is used everywhere a product tile renders (Home, Wishlist, Shop grid, Related
Products), so the strikethrough "was $X" price has never rendered for any real product, site-wide.
Same shape as the earlier `reviewCount`/`reviews` mismatch (2026-08-02/03 session) — mock data and
the real API drifted on a field name and nothing caught it because local dev leaned on mock data.
Fixed: `ProductCard.tsx` now reads `product.comparePrice ?? product.oldPrice` (matching the fallback
`ProductDetails.tsx` already used), and `types/shop.ts`'s `Product` interface now declares
`comparePrice` (it only had the mock-only `oldPrice` before, so TypeScript couldn't have caught the
mismatch even with strict mode). `tsc --noEmit` and `next lint` both clean.

Not deployed as of this writing — commit + deploy is the next step.

## Shop by Breed / Shop by Solution — new taxonomy + 2 landing-page trees — commits `6dc4ccf`..`9fe4326`

Started from Yuni's IA question ("Shop by Solution / Shop by Breed" mockup already existed on the homepage as dead-end panels) and ended up building the real feature: `breed_tags`/`solution_tags` Lunar attributes, `?breed=`/`?solution=` API filters, matching sidebar facets in `ShopPage`/`useShopLogic`/`ProductFilterBar` (orthogonal to the existing category facet — a product can be tagged with both a breed and a solution), and two route trees: `/shop/breeds/[slug]` + `/shop/solutions/[slug]` (dedicated landing copy per variant, reusing `ShopPage`) and `/shop/breeds` + `/shop/solutions` (picker index pages, added later — see below). `frontend/lib/shopData.ts`'s `BREED_CONTENT`/`SOLUTION_CONTENT` are the single source of truth for each variant's title/description/image, imported by both the index and `[slug]` pages.

Real bugs found and fixed along the way, not part of the original ask:
- **MySQL/Postgres cast mismatch**: the new `breed`/`solution` filters (and the pre-existing `badge`/`q` filters, copied as the pattern) used `CAST(attribute_data AS TEXT)` — Postgres-only syntax — against a MySQL database. Silently 500'd every filtered request. Fixed to `AS CHAR` in all 4 places.
- **`reviewCount` vs `reviews` field mismatch**: `ProductResource` only ever returned `reviewCount`, but `ProductCard`/`ShopPage`/`ProductDetails` all read `product.reviews` — always `undefined` against real API data, only "worked" against mock data that happened to use that key. Added `reviews` alongside `reviewCount`.
- **Fake 5-star default rating**: `ProductResource` defaulted `rating` to `5` when a product had no rating attribute set, so a genuinely unrated product (0 reviews) displayed 5 full stars next to an honest "(0 Verified)" — self-contradictory. Defaulted to `0` instead; frontend (`ProductCard`, `ProductDetails`, `ProductReviews`) now only renders filled stars when `reviews > 0`, otherwise "No reviews yet" with empty stars.
- **Sitemap edit landed in the wrong place first**: initially added the new URLs to `backend/SitemapController.php` (`api.petposture.com/sitemap.xml`) — turns out that endpoint is orphaned; the sitemap `robots.txt` actually references, and that Google would crawl, is Next.js's own `frontend/app/sitemap.ts` on the frontend domain. Re-added there; left the backend one as-is (harmless, just unused).
- **Two more 404-producing dead links found via PageSpeed Insights** (`/shop-by-solution`, `/shop-by-breed`, no leading path segment) in `Hero.tsx`'s homepage CTAs — pre-existing links to routes that never existed. Since neither CTA is breed/solution-specific, built real picker index pages (`/shop/breeds`, `/shop/solutions`, card-grid pattern matching the rest of `/shop/*`) rather than pointing a generic CTA at one arbitrary specific variant. `Categories.tsx`/`PromoBanners.tsx` have the same broken hrefs but are dead code (not imported anywhere reachable) — left alone.

Renamed `/shop/flat-faced` → `/shop/breeds/[slug]` and `/shop/solutions/[slug]` stayed as originally built, for route-tree symmetry — done immediately after the first deploy (zero real traffic/backlinks yet) specifically to avoid needing a 301 later once the pages are actually indexed.

## Mobile UI polish sweep, iterative against Yuni's real-device screenshots — commits `6dc4ccf`..`745b131`

Long back-and-forth against real iPhone Safari screenshots (not just Playwright/Chromium — see gotcha below). Highlights:
- **Letter-spacing sweep**: multiple eyebrow/label elements at `tracking-[0.2em]`–`[0.4em]` (`Patient Feedback`, `Ergo-Care Science`, shop filter labels, breadcrumb, product category eyebrow, several CTA buttons) read too spaced out — brought down to a `0.12em`–`0.18em` range to match the standard already set by two prior sessions' wishlist/topbar fixes. `HARNESSES ERGONOMICS` (product page category eyebrow) was missed in the first pass and caught in a follow-up round.
- **Mobile filter toggle was decorative**: the "Left sidebar filters" pill in `ShopPage`'s hero had no `onClick` — looked like a control, did nothing. Wired it up to show/hide `ProductFilterBar` on mobile (sidebar stays always-visible on desktop).
- **iOS Safari repaint ghosting bug on that same toggle**: switching "Show Filters" ⇄ "Hide Filters" left a stale shadow/border edge from the pre-resize frame behind the new one — a known WebKit issue (a rounded+shadowed element resizing without its own compositing layer). `transition-colors` (narrowing which properties animate) did *not* fix it — the real fix needed both a `key` keyed on open/closed state (forces full DOM remount instead of an in-place patch) and `[transform:translateZ(0)]` (forces a dedicated GPU layer). Also simplified the active-filter dot indicator from an orange pill-containing-a-bullet-character to a plain 6px dot — the pill read as visually heavier/wider than the plain button on `/shop` (no filter preset), which is what read as "inconsistent" across `/shop` vs `/shop/breeds/*` vs `/shop/solutions/*`.
- **Single product page** (`ProductDetails.tsx` + `Breadcrumbs.tsx`/`TrustBadgeBar.tsx`/`ScientificBreakdown.tsx`/`ProductReviews.tsx`): breadcrumb separators existed but were `opacity-30` on already-light gray text (functionally invisible) — darkened, and switched the product-name truncation from a hardcoded `max-w-[200px]` to `min-w-0 truncate` on a flex-1 span so it uses whatever space is actually left after the earlier (now `shrink-0`) crumbs. Description/Technical Specs/Shipping & Returns converted from a single-active-tab strip to a Plus/Minus accordion, reusing the same interaction pattern as the mobile footer accordion rather than inventing a new one. Trust badge grid switched from icon-left/text-right to icon-top/text-centered (2-column mobile grid was misaligned row-to-row since badge labels wrap to different line counts). "The Biology of Comfort" 4-card grid now scroll-snaps horizontally on mobile with scroll-synced pagination dots, mirroring the homepage's existing "Why Choose PetPosture" carousel pattern instead of stacking vertically. Mobile Add to Cart row: quantity stepper had no explicit height (button was `h-[54px]`) so the two sat at visibly different heights — matched; then iterated twice more on Yuni's direct feedback (stepper padding `px-4`→`px-3`→`px-2`, quantity span `w-12`→`w-9`, CTA text `text-sm`→`text-base`, CTA tracking `0.2em`→`0.12em`) to grow the button's share of the row and make the label read less cramped.

**Gotcha for next session: Playwright/Chromium ≠ real Safari, and dev-mode HMR in this session was unreliable enough to produce false negatives.** Two separate false alarms this session: (1) the accordion's `aria-expanded` toggle appeared broken under `next dev` + Playwright — turned out to be this session's dev server stuck in a broken HMR state (persistent `WebSocket handshake failed` console errors); a clean `next build && next start` test showed it working correctly. (2) Framer Motion's `initial`/`animate` wrapper divs rendered stuck at `opacity: 0` in headless full-page screenshots — a real Chromium-headless quirk (not a code bug; forcing `opacity: 1` via `page.evaluate` before screenshotting confirmed the underlying markup was correct). When Playwright output contradicts what looks like straightforward code, re-verify against a production build before concluding it's a real bug — and the Safari-only ghosting bug above never reproduced in Playwright at all, only on Yuni's real device.

## Deploy process, established/corrected this session

Prior assumption (from `backend/railway.json`/`nixpacks.toml` in the repo) was that this deploys via Railway — wrong, confirmed by Yuni: Railway was dropped a while ago, `railway.json` is stale. Real deploy target is a **LaNIT VPS** (`94.72.123.183`, SSH key at `C:\Users\YUNI-SS980\.ssh\vps_key`), matching what `ARCHITECTURE.md`/`RULES.md` already documented (single VPS, `docker-compose.prod.yml`, host nginx, no CI) — this session just re-confirmed it after initially guessing wrong.

Deploy loop used all session (repeated ~10 times): SSH in → `git pull` → `docker compose -f docker-compose.prod.yml build <service>` → `up -d <service>` → **manually purge Cloudflare** (`docker exec petposture-backend php -r '... app(App\Services\CloudflareCacheService::class)->purgeAll(); ...'`, plain `php -r` bootstrapping Laravel rather than `artisan tinker --execute`, which choked on escaping through nested SSH/bash quoting) → verify the live public URL with `curl`. Skipping the Cloudflare purge step was the direct cause of one real user-visible bug this session (a stale HTML+JS version mismatch produced the Safari "badge ghosting" symptom above, initially misdiagnosed) — `RULES.md` already called this out as a known gap before this session; this session is a second confirmation that skipping it isn't safe to do "just this once."

---

# Handoff — 2026-08-01/02

## New Wishlist feature (page was 404, header linked nowhere) — commit `986e0d1`

Yuni's screenshot showed `/wishlist` 404ing off the header's heart icon — a link with no page behind it since the icon was added, apparently never built. Built the real feature rather than just hiding the link:

- Backend: `user_wishlist_items` (`user_id` + `lunar_product_id`, unique pair) + `WishlistService` + `WishlistController`, `GET/POST/DELETE /api/me/wishlist` inside the existing `auth:sanctum` group, returning the same `ProductResource` shape `/api/products` already uses.
- Frontend: `WishlistContext` forks entirely on login state — **guest wishlist is localStorage-only, no server sync, no merge-on-login** (same shape as checkout's guest "save address" from a prior session — now a repeated, real pattern, not a one-off). Heart toggle added to `ProductCard`, count badge added to `Header`'s wishlist icon, new `/wishlist` page reusing `ProductCard`/grid styling from the shop page.
- Caught along the way: the frontend `Product.productId` field is never populated by `ProductResource` (only `.id` is) — anywhere else in the frontend filtering by `.productId` is silently comparing `undefined`. Used `.id` for wishlist identity instead of propagating the bug; didn't fix the existing call sites (`RelatedProducts.tsx`, `shop/[category]/[slug]/page.tsx`) since that's a separate, pre-existing, out-of-scope gap.
- Verified via Playwright against the dev server (backend unavailable locally, so this exercised the guest/localStorage path only, not the logged-in/server path): add → header badge → `/wishlist` shows the product → remove → badge clears, empty state returns. `tsc`/`lint` clean. Backend verified via `php -l` only — no local MySQL and VPS `composer install` for Pint/PHPStan was blocked by the auto-mode classifier (running installs against the production host); migration itself ran clean and automatically on the next container start, confirmed via `docker logs`.

## Header polish, two rounds — commits `7765467`, `04fc88e`

Round 1: desktop nav bar's two link groups had mismatched font sizes (main links `text-[13px]`, utility links/Support/hours/phone `text-sm`/14px) — right side visibly larger. Matched both to `13px`.
Round 2, from Yuni's follow-up screenshot: announcement bar ("Free Shipping…") desktop letter-spacing `tracking-[0.2em]` felt too wide → `0.1em`; desktop logo `60px` felt slightly oversized → `52px`. Both eyeballed/confirmed via Playwright screenshot before deploy, not measured against a spec.

## Hostinger security-scan fix: unused `@google/design.md` dependency — commit `d51ec68`

Hostinger flagged 1 High-severity finding across "143 packages scanned." Traced it to `ws` (memory-exhaustion DoS), pulled in transitively via `ink` via `@google/design.md` — a dependency that's been sitting in the **root** `package.json` since the very first commit of the repo and is never imported anywhere in the codebase (confirmed via repo-wide grep). `npm uninstall` removed exactly 143 packages, matching Hostinger's scan count exactly, and dropped `npm audit` to 0 vulnerabilities. `build.js` re-verified clean afterward.

Separately, while checking for more of the same: `backend/package.json` (the Vite build for the Filament admin theme) had its own unrelated 5 findings (3 high, 2 critical — axios, form-data, postcss, shell-quote via `concurrently`) — commit `ba59e7e`. `axios` is real (imported in `resources/js/bootstrap.js`), but turned out to have **no actual runtime exposure**: the backend `Dockerfile` never runs `npm install`/`npm run build` for this theme, and `public/build/` is gitignored, so the compiled bundle has never shipped to production at all. Laravel's own default `welcome.blade.php` scaffold already has a graceful `@if (file_exists(public_path('build/manifest.json')) …)` fallback to inline static CSS when the build doesn't exist — which is why `api.petposture.com/` was still returning 200 despite the missing manifest, not a bug. Fixed the dependency versions anyway (`npm audit fix` + widening `axios`'s pinned range to `^1.19.0`) for hygiene/future-proofing, but there was nothing to redeploy for this one specifically — the fix never touches the running container.

## Checkout guest email defaulted to a fake address — commit `b6ba1f6`

Yuni asked why the checkout Contact field defaulted to `guest@petposture.com`. Root cause: `frontend/app/checkout/page.tsx`'s initial form state (`email: user?.email || 'guest@petposture.com'`) — leftover from the very first scaffolding commit (`0967857`), never a real placeholder (it was a live input `value`, so it silently satisfied the `required` check and the gray "Email" placeholder never showed). Backend had no independent safety net either: `CheckoutController`'s email fallback only fires for authenticated users (`if (empty(...) && $userId)`), so a guest's already-non-empty fake value passed straight through into `lunar_orders.customer_reference`.

Checked production impact before fixing: exactly one real order (`#00000012`) had shipped with `customer_reference = 'guest@petposture.com'` — Yuni confirmed it's a test order, not a real customer, so no follow-up contact was needed. Fixed both places the default is set (initial state + the login-sync `useEffect`) to fall back to `''` instead, so the real placeholder shows and the browser's required-field validation forces a genuine email. Verified via Playwright (`input.value === ''`, placeholder renders) before deploy.

## Documentation

Added a Wishlist bullet to `ARCHITECTURE.md`'s Backend section (mirrors the Return Requests/PayPal bullet style) documenting the guest-local/logged-in-server split and the `Product.id` vs `.productId` gotcha, so the next session doesn't have to re-derive it from the diff.

---

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
  (card payments) stays on the `h-full`/`items-stretch` baseline permanently — Yuni decided
  not to pursue a fix (would need a custom Blade view override to distribute space between
  fields, not reachable through Filament's normal component API). Don't re-propose.
- **A real carrier delivery scan reaching our webhook is still unconfirmed** — the entire *our-side*
  pipeline (signature verify → shipment match → status update → email) is now verified end-to-end
  against production with a simulated-but-correctly-signed webhook call (see above); the only thing
  left unconfirmed is whether AfterShip itself reliably calls our webhook when a real UPS/USPS/
  FedEx/DHL scan happens — that's outside our code, can only be observed, not tested.
- Carried over from 2026-07-24, still open: **Hostinger Mail trial expires 2026-08-15** — must
  upgrade before then; the full guest-return happy path through `https://petposture.com/returns`
  (Playwright is fine for this — the blocker isn't the testing tool) is still untested end-to-end
  because it needs a real order that's actually eligible (delivered, within the 30-day window,
  real email) to submit against — pending Yuni pointing at a suitable order.

## Immediate follow-ups (next session)

1. Watch for the next real "delivered" AfterShip webhook hit to confirm the new per-shipment
   matching logic end-to-end with real carrier data (not test tracking numbers).
2. Still pending from before: upgrade Hostinger Mail before 2026-08-15; run the full guest return
   submission (Playwright against a real eligible order is fine) once Yuni has a suitable
   order+email on hand.

## Backlog / bigger asks (need scoping before starting)

- **Return Request Phase 3** — auto-generated prepaid return shipping label via a carrier API.
  The low-value no-return-required rule it was waiting on (auto-waive, above) has since shipped,
  but Phase 3 itself is deliberately deferred until the site scales — don't re-propose without a
  fresh ask.
- **Support helpdesk tooling** (Zendesk/Freshdesk/shared inbox) for `support@petposture.com` — only worth it once there's more than one person handling customer replies.

(Shop by Solution/Breed re-think — done, see the 2026-08-02/03 entry at the top of this file.)


## Handoff & Memory (2026-08-22)

### T�m t?t ti?n d? h�m nay
- **Ki?n tr�c UI chung:** �� chuy?n d?i Admin layout sang d?ng "Full-height Sidebar (Slate 800) + White Topbar". Sidebar du?c fix chi?u cao 100vh, topbar cu?n d?c l?p.
- **Form UI (PostFormPage, SeoSettings, ComparisonDetails, ComparisonItemRepeater):** 
  - �p d?ng tri?t d? phong c�ch "UI/UX Pro Max": R?ng r�i, thanh l?ch, chuy�n nghi?p.
  - Chu?n ho� to�n b? Card b?ng `className="space-y-4 p-5"`.
  - Chu?n ho� to�n b? Heading b?ng `<h3 className="text-lg font-semibold text-slate-800">`.
  - Chu?n ho� to�n b? Label b?ng `<label className="block text-sm font-medium text-slate-700 mb-1">`.
- **Dropdowns:** �� thay th? giao di?n m?c d?nh x?u x� c?a <select> b?ng giao di?n custom (xo� mui t�n m?c d?nh, thay b?ng icon Chevron, th�m padding).
- **Comparison Items:** �� chia l?i b? c?c th�nh d?ng Bento Grid (c?t tr�i 6 - c?t ph?i 6). C�c th? nh?p li?u b�n trong du?c chia d�ng h?p l� (Highlight + Rating 1 d�ng, Price 1 d�ng).
- **Badges:** G?p to�n b? c�c Type, Status Badge l?i d�ng chung 1 component v?i style ounded-md (bo g�c nh?, thay v� bo tr�n xoe) d? tr�ng c?ng c�p v� hi?n d?i hon.

### C�c quy t?c chu?n Design (R?t quan tr?ng, KH�NG �U?C QU�N)
- **TH? CARD:** Lu�n d�ng <Card className="space-y-4 p-5">. Kh�ng t? � nh�t th�m p-4 hay c�c l?p padding ch?ng ch�o.
- **TI�U �? TRONG CARD:** Lu�n d�ng <h3 className="text-lg font-semibold text-slate-800">. Kh�ng d�ng 	ext-sm font-bold.
- **NH�N (LABEL):** Lu�n d�ng <label className="block text-sm font-medium text-slate-700 mb-1">. Kh�ng d�ng 	ext-xs font-semibold text-primary-light (b? ch� l� x?u v� l?ch t�ng).
- **RESPONSIVE:** M?i lu?i n?i b? trong form ph?i d�ng grid-cols-1 sm:grid-cols-2 d? tr�n mobile t? d?ng r?t xu?ng 1 c?t.
- **N�T DROPDOWN:** B?t bu?c d�ng class ppearance-none v� t? custom icon mui t�n, tuy?t d?i kh�ng d? UI m?c d?nh c?a tr�nh duy?t.

### C�c task c?n l�m ti?p theo
- Ki?m tra l?i lu?ng t�nh nang Create/Edit/Update Post sau khi d� l�m m?n giao di?n xem API ho?t d?ng mu?t m� kh�ng.
- �?ng b? ti?p phong c�ch UI n�y sang c�c trang kh�c nhu Settings, Category, v.v. n?u c?n thi?t.


## Handoff & Memory (2026-08-23)

### Tóm tắt tiến độ hôm nay — Migration mail: Hostinger → Cloudflare Email Routing + Resend

Đóng hẳn 2 việc carry-over lâu ngày trong file này ("Hostinger Mail trial expires 2026-08-15 —
must upgrade before then" — mục Known gaps/Immediate follow-ups ở entry trước): **Hostinger mail
hosting đã bị huỷ hẳn hôm nay**, thay bằng kiến trúc mới, verify đầy đủ 2 chiều trên production.

- **Nhận mail**: bật Cloudflare Email Routing (Cloudflare dashboard, không phải DNS record) —
  `support@`, `no-reply@`, `accounts@`, `hello@`, `finance@`, `admin@`, `social@`, và **catch-all
  cho toàn domain** — tất cả forward về `petposture@gmail.com`.
- **Gửi mail transactional (Laravel)**: chuyển `MAIL_MAILER` từ `smtp` (Hostinger) sang
  `resend`. Cài `composer require resend/resend-php` (v1.10.0, trước đó chỉ nằm trong
  `composer.lock` như dependency của `laravel/framework`, chưa thực sự là app dependency thật).
  Verify domain trên Resend dashboard: DKIM (`resend._domainkey` TXT), SPF + MX trên subdomain
  `send.petposture.com` (chạy trên hạ tầng Amazon SES). Cập nhật cả local `backend/.env` lẫn
  production `.env` (VPS, qua SSH) — rebuild + redeploy container `backend`.
- **Gmail "Send mail as" cho `support@petposture.com`**: đổi từ SMTP Hostinger (đã chết) sang
  relay qua `smtp.resend.com:587` (user `resend`, password = Resend API key).
- **Fix bug hiển thị sender name**: `PasswordResetEmail`/`WelcomeEmail` trước đó set
  `from` bằng string thuần (`'accounts@petposture.com'`) nên mất display name, mail client fallback
  hiện local-part (`accounts`/`hello`) thay vì "PetPosture". Sửa cả 2 dùng
  `new Address('...@petposture.com', config('app.name'))`. Đã verify lại email test hiện đúng
  "PetPosture" sau fix.
- **Dọn SPF record gốc**: sau khi Hostinger huỷ, user tự sửa TXT record `petposture.com` từ
  `v=spf1 include:_spf.mx.cloudflare.net include:_spf.mail.hostinger.com ~all` thành
  `v=spf1 include:_spf.mx.cloudflare.net ~all` — verify qua `nslookup`, đã sạch.
- **Docs**: cập nhật `README.md` (section "Email deliverability & branding (DNS)" viết lại toàn
  bộ theo kiến trúc mới) và `RULES.md` (thêm rule về `Address` object cho Mailable `from`/`replyTo`).

### Verify 2 chiều trên production (2026-08-23)
- Gửi: test email production qua Resend nhận được ở Gmail, sender hiện đúng "PetPosture".
- Nhận: email test gửi tới `support@petposture.com` forward về Gmail đúng qua Cloudflare Email Routing.
- Gmail "Send mail as" `support@petposture.com` gửi thành công qua Resend SMTP, hiện đúng tên
  "PetPosture <support@petposture.com>".

### Known gaps / not done
- Email hiển thị "Petposture Support" trên Yahoo hoá ra là **Yahoo cache theo Contact của người
  nhận cụ thể đó** (Gmail Send-As settings đã đúng "PetPosture" từ trước) — không phải lỗi cấu
  hình, user đã xác nhận bỏ qua, không cần sửa gì thêm.
- Resend API key hiện tại (`re_PDZ8UL...`) **không rotate** — user chủ động quyết định giữ
  nguyên key cũ, chỉ yêu cầu đảm bảo key không bị lưu ở bất kỳ đâu ngoài `backend/.env`
  (local + production VPS). Đã xác nhận đúng vậy — đừng tự ý đề xuất rotate lại trừ khi user
  yêu cầu.
- mail-tester.com DKIM/spam-score check — vẫn chưa chạy, optional, không gấp.

### Task cần làm tiếp theo
- Không có việc bắt buộc nào còn treo cho migration mail — coi như đã đóng hoàn toàn.
- (Optional, không ưu tiên) chạy thử mail-tester.com nếu muốn đo điểm spam/DKIM chính xác hơn.

## Handoff & Memory (2026-08-23, phần 2) — Admin content chuyển hẳn sang localhost:5173

Toàn bộ mục Content (Posts/Pages/Blog Categories/Tags/Comments) đã chuyển hẳn từ Filament
(`localhost:8000/admin`) sang admin app mới (Vite/React, `localhost:5173`). Đã kiểm tra không có
gì cần sửa: `backend/config/cors.php` (`ADMIN_URL`) đã có sẵn `http://localhost:5173`,
`admin/vite.config.ts` serve đúng port 5173, `admin/src/lib/api.ts` vẫn trỏ đúng backend
`localhost:8000`. Build admin (`npm run build`) sạch, `tsc --noEmit` sạch, backend PHPUnit chỉ có
2 test fail — cả 2 đều pre-existing từ trước (không liên quan việc hôm nay), đã xác nhận bằng
`git stash` rồi chạy lại: `Tests\Feature\ExampleTest` (route `/` redirect 302 thay vì 200 — test
mẫu mặc định của Laravel chưa update theo app) và `ProductCatalogApiTest::product index only
returns published synced products` (field `oldPrice` null thay vì 129.99 — gap ánh xạ field có
từ trước).

### Việc đã làm trong phiên (ngoài phần mail hôm nay, xem entry phía trên)
- **Highlight ở Comparison Items**: đổi từ `<select>` dropdown enum cứng (`best_overall`,
  `best_value`, `budget_pick`) sang free-text badge input giống hệt UX Pros/Cons (gõ, Enter ra
  badge, có nút `×` xoá) — không giới hạn 3 giá trị nữa, màu badge style vẫn giữ nguyên trên site
  public. Sửa xuyên suốt: `admin/src/features/posts/ComparisonItemRepeater.tsx`,
  `admin/src/features/posts/postSchema.ts` (zod: enum → `string().max(40)`),
  `backend/app/Http/Controllers/Api/PostController.php` (validation rule tương tự), site public
  `frontend/components/blog/ComparisonTable.tsx` (bỏ `HIGHLIGHT_LABEL` dictionary cứng, render
  thẳng text). Cập nhật test cả 2 phía (`postSchema.test.ts`, `PostControllerComparisonTest.php`)
  theo behavior free-text mới. Locale keys mới: `posts.comparison.add_highlight`,
  `posts.comparison.errors.highlight_too_long` (en+vi).
- **Route mới trong `backend/routes/api.php`**: đổi `blog/categories`, `blog/tags` từ route rời
  rạc trong `PostController`/`BlogTagController` sang `Route::apiResource(...)` đầy đủ CRUD +
  `bulk-delete`; thêm mới `comments` (CRUD + `approve` + `bulk-delete`), `pages` (CRUD +
  `bulk-delete`), `seo-social` (index/store) — đều là admin-only route, controller tương ứng nằm ở
  `backend/app/Http/Controllers/Api/Admin/{BlogCategoryController,CommentController,
  PageController,SeoSocialController}.php` (file mới, chưa commit).

### Task cần làm tiếp theo
- Chưa commit các file mới liên quan Content admin rebuild (`admin/src/features/{blog-categories,
  comments,pages,settings,tags}/`, các Controller/Resource mới ở backend, migration
  `2026_08_23_001959_add_status_to_pages_table.php`). Sẽ commit cùng đợt hôm nay theo yêu cầu.
- 2 test fail nói trên (`ExampleTest`, `ProductCatalogApiTest`) vẫn còn tồn đọng — không phải việc
  hôm nay, nhưng nên dọn ở phiên sau nếu rảnh (không gấp, đã pre-existing từ trước phiên này).
