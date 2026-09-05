# Google Favicon and Admin Branding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the storefront favicon reliably eligible for Google Search by serving a stable, same-origin PNG URL, then separate storefront and admin branding without breaking existing production settings.

**Architecture:** Keep the existing `shop_logo` and `shop_favicon` keys as the storefront branding contract for backward compatibility. Add `admin_logo` and `admin_favicon` for the Vite/React admin and legacy Filament panel. The storefront metadata must always point to `https://petposture.com/favicon.png`; a Next.js route will fetch the configured source, normalize it to a square PNG, and return a static fallback when the API or source asset is unavailable.

**Tech Stack:** Laravel/PHP 8.x, Filament, Livewire, Laravel feature tests, Next.js 16 App Router, TypeScript, React, `sharp`, Vite, Vitest, browser/HTTP verification, Google Search Console URL Inspection.

**Spec:** This document is the complete implementation specification, based on the verified production audit described below.

## Global Constraints

- Do not rename or delete `shop_logo` or `shop_favicon`; existing production data and API consumers depend on them.
- The storefront `<link rel="icon">` must never use the raw `api.petposture.com/storage/...` URL directly.
- The canonical storefront favicon URL is `/favicon.png` on the storefront hostname.
- The canonical storefront favicon response must be `image/png`, square, and normalized to 96×96 pixels.
- Storefront favicon uploads must reject SVG and must enforce a square source image or clearly document the server-side square crop behavior.
- `100×100` must not remain hard-coded in metadata when the returned asset is not guaranteed to be 100×100.
- Keep the storefront fallback available when the settings API, storage asset, image decode, or proxy fetch fails.
- Do not make the favicon proxy an unrestricted SSRF primitive: only fetch the configured API/storage host and explicitly permitted local/development API hosts.
- Preserve the existing `SettingsController` response keys; adding keys is allowed, changing existing key meaning is not.
- Before editing any existing function, class, or method, run GitNexus impact analysis and report direct callers, affected processes, and risk. Stop before editing if risk is HIGH or CRITICAL.
- Before committing, run GitNexus detect-changes and confirm that only the expected symbols, files, and execution flows changed.
- Do not use guessed Filament APIs. Inspect the installed Filament/vendor source or existing project usage before adding upload validation methods.
- Do not commit generated `admin/dist` or `.next` output unless the repository convention explicitly requires it.
- No robots.txt change is needed; the audit found no favicon or storage crawl block.

## Verified Current State and Root Cause

- `frontend/app/layout.tsx` reads `shop_favicon` from `https://api.petposture.com/api/settings` and injects that mutable cross-origin URL into metadata.
- The current metadata declares `sizes: '100x100'` and `type: 'image/png'` regardless of the uploaded asset's actual dimensions and format.
- `backend/app/Filament/Pages/ManageSettings.php` accepts PNG, ICO, and SVG for `shop_favicon`, but has no resize or aspect-ratio enforcement. `shop_logo` does use an upload resizer.
- `backend/app/Http/Controllers/Api/SettingsController.php` intentionally resolves relative settings paths to backend storage URLs.
- `frontend/public/favicon.ico`, `frontend/public/favicon.png`, and `admin/public/favicon.png` are currently the same 100×100 PNG bytes; the file named `.ico` is not an actual ICO container.
- `admin/index.html` has no explicit favicon link. The React admin currently uses static `/logo.png` in `admin/src/features/auth/LoginPage.tsx` and `admin/src/layouts/AppShell.tsx`.
- Google Search requires a square favicon of at least 8×8, recommends at least 48×48, supports PNG and ICO among other formats, requires Googlebot and Googlebot-Image access, and recommends a stable favicon URL. Google may take days or weeks to refresh the displayed favicon after recrawling.

---

## Phase A — Storefront Google Favicon Fix

### Task 1: Lock down the settings contract and upload rules

**Files:**
- Modify: `backend/app/Filament/Pages/ManageSettings.php:233-261`
- Modify: `backend/app/Http/Controllers/Api/SettingsController.php:8-61`
- Test: `backend/tests/Feature/SettingsApiTest.php`
- Test: `backend/tests/Feature/Filament/ManageSettingsTest.php`

**Interfaces:**
- Consumes: existing `shop_logo` and `shop_favicon` settings.
- Produces: unchanged `data.shop_logo` and `data.shop_favicon` API fields, plus `data.admin_logo` and `data.admin_favicon` fields for Phase B.

- [ ] **Step 1: Run required GitNexus impact analysis**

Run upstream impact analysis for `SettingsController::index`, `SettingsController::resolveAssetUrl`, and `ManageSettings::form`. Report direct callers, affected processes, and risk before editing.

- [ ] **Step 2: Add a failing API contract test**

Extend `SettingsApiTest` with a test that seeds all four branding keys and verifies that the endpoint returns resolved URLs while preserving the existing `shop_*` fields:

```php
public function test_settings_expose_storefront_and_admin_branding_urls(): void
{
    config(['app.url' => 'https://api.petposture.com']);

    Setting::set('shop_logo', 'settings/storefront-logo.png', 'string', 'general');
    Setting::set('shop_favicon', 'settings/storefront-favicon.png', 'string', 'general');
    Setting::set('admin_logo', 'settings/admin-logo.png', 'string', 'admin');
    Setting::set('admin_favicon', 'settings/admin-favicon.png', 'string', 'admin');

    $this->getJson('/api/settings')
        ->assertOk()
        ->assertJsonPath('data.shop_logo', 'https://api.petposture.com/storage/settings/storefront-logo.png')
        ->assertJsonPath('data.shop_favicon', 'https://api.petposture.com/storage/settings/storefront-favicon.png')
        ->assertJsonPath('data.admin_logo', 'https://api.petposture.com/storage/settings/admin-logo.png')
        ->assertJsonPath('data.admin_favicon', 'https://api.petposture.com/storage/settings/admin-favicon.png');
}
```

Import `App\Models\Setting` in the test file.

- [ ] **Step 3: Run the API test and verify it fails**

From `backend`:

```bash
php artisan test --filter=SettingsApiTest
```

Expected failure: `data.admin_logo` and `data.admin_favicon` are absent.

- [ ] **Step 4: Add the two admin settings to `SettingsController`**

Read `admin_logo` and `admin_favicon` through the same `resolveAssetUrl()` helper and add them to the returned top-level `data` object. Do not alter existing `shop_*` values or `frontend_url` behavior.

- [ ] **Step 5: Add admin upload fields without renaming storefront fields**

Keep the existing `shop_logo` and `shop_favicon` state paths. Change only their visible labels to `Storefront Logo` and `Storefront Favicon`. Add `admin_logo` and `admin_favicon` fields under an explicit Admin Branding section or tab, storing under `settings/admin`.

For storefront favicon validation:

- accept PNG as the canonical format;
- reject SVG;
- only allow ICO if the installed Filament version can validate and preserve a real ICO correctly;
- enforce a square image at the form-validation layer where supported;
- cap upload size to 512 KB;
- set helper text to `Upload a square PNG. It will be served as a normalized 96×96 storefront favicon.`

Inspect the installed Filament source before writing the method chain. If square validation cannot be expressed safely with the installed version, rely on the Next route normalization in Task 3 and add explicit server validation rather than silently trusting arbitrary files.

- [ ] **Step 6: Add a failing Livewire persistence test**

Add a test to `ManageSettingsTest` that saves separate storefront/admin paths:

```php
public function test_storefront_and_admin_branding_settings_persist_separately(): void
{
    Livewire::test(ManageSettings::class)
        ->set('data.shop_favicon', 'settings/storefront.png')
        ->set('data.admin_favicon', 'settings/admin/admin.png')
        ->call('save')
        ->assertHasNoFormErrors();

    $this->assertSame('settings/storefront.png', Setting::get('shop_favicon'));
    $this->assertSame('settings/admin/admin.png', Setting::get('admin_favicon'));
}
```

If the installed upload component rejects direct string state, use `UploadedFile::fake()->image()` and the component's established temporary-upload test pattern instead of weakening production validation.

- [ ] **Step 7: Run backend tests**

```bash
php artisan test --filter="SettingsApiTest|ManageSettingsTest"
```

Expected: all selected tests pass.

- [ ] **Step 8: Commit the isolated backend contract change**

```bash
git add backend/app/Filament/Pages/ManageSettings.php backend/app/Http/Controllers/Api/SettingsController.php backend/tests/Feature/SettingsApiTest.php backend/tests/Feature/Filament/ManageSettingsTest.php
git commit -m "fix: separate storefront and admin branding settings"
```

### Task 2: Create valid storefront fallback assets

**Files:**
- Create: `frontend/public/assets/branding/favicon-fallback.png`
- Create: `frontend/public/apple-touch-icon.png`
- Delete or replace: `frontend/public/favicon.ico`
- Delete: `frontend/public/favicon.png`

**Interfaces:**
- Consumes: the existing PetPosture paw-mark source image.
- Produces: a known valid PNG fallback and a valid 180×180 Apple touch icon.

- [ ] **Step 1: Inspect current binary assets**

Confirm dimensions and MIME signatures. Do not keep a PNG merely renamed to `.ico`.

- [ ] **Step 2: Generate fallback assets**

Create `favicon-fallback.png` as a square 96×96 PNG and `apple-touch-icon.png` as a square 180×180 PNG using the existing paw mark. Preserve transparency and do not redesign the mark.

- [ ] **Step 3: Make the fallback path private to the route**

Delete `frontend/public/favicon.png`. The public pathname `/favicon.png` must have exactly one owner: `frontend/app/favicon.png/route.ts`. Keep the fallback only at `frontend/public/assets/branding/favicon-fallback.png`; the route reads that file directly from the filesystem and serves its bytes through `/favicon.png` when the configured source is unavailable. Do not leave a public asset at `frontend/public/favicon.png`.

- [ ] **Step 4: Remove or replace the fake ICO**

Preferred: stop advertising `.ico` and remove the fake file. If `/favicon.ico` is retained, replace it with a genuine ICO container containing valid frames; never rename PNG bytes to `.ico`.

- [ ] **Step 5: Verify bytes and dimensions**

Verify with a trusted image tool:

```text
favicon-fallback.png: image/png, 96×96
apple-touch-icon.png: image/png, 180×180
```

### Task 3: Add the stable Next.js favicon route

**Files:**
- Create: `frontend/app/favicon.png/route.ts`
- Create: `frontend/app/favicon.png/route.test.ts` or the smallest compatible frontend test target
- Modify: `frontend/app/layout.tsx:22-84`
- Modify: `frontend/package.json` and its lockfile only if a test runner is genuinely required

**Interfaces:**
- Consumes: `GET {NEXT_PUBLIC_API_URL}/api/settings`, field `data.shop_favicon`.
- Produces: `GET https://petposture.com/favicon.png`, always returning normalized PNG bytes.
- Ownership: `frontend/app/favicon.png/route.ts` is the sole owner of the public `/favicon.png` pathname. `frontend/public/favicon.png` must be deleted and must not be recreated.

- [ ] **Step 1: Run required GitNexus impact analysis**

Run upstream impact analysis for `getShopSettings` and `generateMetadata`. Report blast radius before editing.

- [ ] **Step 2: Write route behavior tests first**

Cover all cases:

```text
valid configured source → 200 image/png, exactly 96×96
missing shop_favicon → 200 fallback PNG
settings API timeout/failure → 200 fallback PNG
source HTTP/decode failure → 200 fallback PNG
unapproved external host → fallback and no outbound request to that host
response cache policy permits stale serving and eventual refresh
```

Use the frontend's existing test setup if present. If none exists, add the smallest compatible Vitest setup rather than introducing a second framework.

- [ ] **Step 3: Run the focused test and verify it fails**

Expected failure: route/helper does not yet exist.

- [ ] **Step 4: Implement the route with a fixed response contract**

The route must:

1. use Node.js runtime because it relies on `sharp` and local fallback access;
2. resolve the fallback path directly with `join(process.cwd(), 'public/assets/branding/favicon-fallback.png')` and read it from the filesystem; do not fetch the fallback through an HTTP request to the same origin;
3. fetch `/api/settings` with a bounded timeout;
4. validate the source URL host against the configured API host before fetching it;
5. use `sharp` with `fit: 'cover'` to normalize output to exactly 96×96 PNG;
6. return `Content-Type: image/png` and `X-Content-Type-Options: nosniff`;
7. return the filesystem fallback for missing settings, timeout, HTTP failure, invalid host, or decode failure;
8. avoid exposing backend error bodies;
9. set `Cache-Control: public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400` or an equivalent documented policy.

Representative response:

```ts
return new Response(pngBytes, {
  status: 200,
  headers: {
    'Content-Type': 'image/png',
    'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
    'X-Content-Type-Options': 'nosniff',
  },
});
```

Use a `Buffer` or `Uint8Array` shape accepted by the installed Next.js 16 types. Do not hide errors with `any`.

- [ ] **Step 5: Make metadata use only stable same-origin URLs**

Remove dynamic `shopFavicon` selection from `generateMetadata()` and use truthful fixed metadata:

```ts
icons: {
  icon: [{ url: '/favicon.png', sizes: '96x96', type: 'image/png' }],
  shortcut: [{ url: '/favicon.png', sizes: '96x96', type: 'image/png' }],
  apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
},
```

Verify the exact `Metadata` object shape against the installed Next.js version. Keep the API field itself intact for the route and other consumers.

- [ ] **Step 6: Remove only dead local metadata plumbing**

If `generateMetadata()` no longer needs `shopFavicon`, remove that destructured local value. Do not delete `shop_favicon` from backend API or frontend settings contracts used elsewhere.

- [ ] **Step 7: Run focused tests, lint, and build**

Use the repository's established package manager:

```bash
cd frontend
npm test
npm run lint
npm run build
```

If the test script did not previously exist, use the exact script added in Step 2. Expected: tests, lint, and production build pass.

- [ ] **Step 8: Commit the storefront favicon fix**

```bash
git add frontend/app/favicon.png/route.ts frontend/app/favicon.png/route.test.ts frontend/app/layout.tsx frontend/public/assets/branding/favicon-fallback.png frontend/public/apple-touch-icon.png frontend/public/favicon.ico frontend/public/favicon.png frontend/package.json
git commit -m "fix(seo): serve storefront favicon from stable same-origin URL"
```

Include a lockfile only if dependencies changed. Do not stage nonexistent/deleted paths blindly; review `git status` first.

---

## Phase B — Vite/React and Filament Admin Branding

### Task 4: Add a shared admin branding loader

**Files:**
- Create: `admin/src/lib/branding.ts`
- Create: `admin/src/lib/branding.test.ts`
- Create: `admin/src/context/BrandingContext.tsx`
- Modify: `admin/src/App.tsx:1-120`
- Modify: `admin/src/main.tsx:1-18`
- Modify: `admin/index.html:3-9`

**Interfaces:**
- Consumes: `/api/settings` fields `admin_logo`, `admin_favicon`, and `shop_name`.
- Produces: typed `AdminBranding` state and one deterministic browser favicon link.

Use this contract:

```ts
export interface AdminBranding {
  name: string;
  logoUrl: string;
  faviconUrl: string;
}

export const DEFAULT_ADMIN_BRANDING: AdminBranding = {
  name: 'PetPosture',
  logoUrl: '/logo.png',
  faviconUrl: '/favicon.png',
};
```

- [ ] **Step 1: Write failing tests**

Test:

```text
successful response uses admin_logo/admin_favicon
missing fields retain static fallbacks
API failure retains fallbacks and does not block rendering
favicon effect creates or updates one link without duplicates under Strict Mode
```

- [ ] **Step 2: Implement `loadAdminBranding()`**

Use the existing `fetchJson('/settings')` helper. Do not duplicate API-base URL or credentials logic. Treat empty/malformed fields as missing.

- [ ] **Step 3: Implement and mount one provider**

Load branding once near the app root. Keep static fallbacks visible while pending. Do not fetch independently from login and shell components.

- [ ] **Step 4: Apply the favicon safely**

Ensure `admin/index.html` has a static fallback favicon link. The provider should update that same deterministic element, not append duplicate icon links.

- [ ] **Step 5: Run tests**

```bash
cd admin
npm test -- branding
```

Expected: all branding tests pass.

### Task 5: Replace static admin logo references

**Files:**
- Modify: `admin/src/features/auth/LoginPage.tsx:7-86`
- Modify: `admin/src/layouts/AppShell.tsx:18-245`
- Test: `admin/src/layouts/AppShell.test.tsx`
- Create or modify: `admin/src/features/auth/LoginPage.test.tsx`

**Interfaces:**
- Consumes: `useBranding()` from `BrandingContext`.
- Produces: login and shell using `admin_logo` with `/logo.png` fallback.

- [ ] **Step 1: Run GitNexus impact analysis**

Run upstream analysis for `LoginPage` and `AppShell`; report risk before editing.

- [ ] **Step 2: Add failing component assertions**

Assert configured `logoUrl` is rendered in both login and shell, and `/logo.png` remains the fallback.

- [ ] **Step 3: Replace only static logo sources**

Use the branding hook in both components. Preserve current sizing, alt text, responsive classes, authentication logic, and the recently completed mobile login polish.

- [ ] **Step 4: Run admin tests and build**

```bash
cd admin
npm test
npm run build
```

Expected: all tests and build pass.

- [ ] **Step 5: Commit admin branding**

```bash
git add admin/index.html admin/src/App.tsx admin/src/main.tsx admin/src/lib/branding.ts admin/src/lib/branding.test.ts admin/src/context/BrandingContext.tsx admin/src/features/auth/LoginPage.tsx admin/src/features/auth/LoginPage.test.tsx admin/src/layouts/AppShell.tsx admin/src/layouts/AppShell.test.tsx
git commit -m "feat(admin): load independent admin branding"
```

### Task 6: Align legacy Filament branding

**Files:**
- Modify: `backend/app/Providers/Filament/AdminPanelProvider.php:137-145`
- Create or modify: `backend/tests/Feature/Filament/AdminPanelBrandingTest.php`

**Interfaces:**
- Consumes: `admin_logo` and `admin_favicon`.
- Produces: Filament branding independent of storefront branding.

- [ ] **Step 1: Run GitNexus impact analysis for the provider configuration**

Report callers/processes/risk before editing.

- [ ] **Step 2: Add a failing observable panel test**

Verify configured admin assets are resolved and missing settings use valid static fallbacks. Avoid assertions tied to private implementation details.

- [ ] **Step 3: Update only branding callbacks**

Switch Filament's logo/favicon callbacks from `shop_*` to `admin_*`. Preserve navigation, authorization, colors, fonts, and middleware.

- [ ] **Step 4: Run backend tests**

```bash
cd backend
php artisan test --filter="ManageSettingsTest|Filament"
```

Expected: all selected tests pass.

- [ ] **Step 5: Commit the Filament branding change**

```bash
git add backend/app/Providers/Filament/AdminPanelProvider.php backend/tests/Feature/Filament/AdminPanelBrandingTest.php
git commit -m "fix(admin): use admin branding in legacy Filament panel"
```

Review `git status` before staging and do not include unrelated changes.

---

## Deployment and Live Verification

### Task 7: Verify production behavior and request recrawl

**Files:**
- Create: `docs/verification/google-favicon-2026-09-05.md`
- Modify: `README.md` only if deployment or infrastructure configuration changes; this project requires README updates for infra/deploy changes.

- [ ] **Step 1: Run full relevant verification before deploy**

```bash
cd backend && php artisan test --filter="SettingsApiTest|ManageSettingsTest|Filament"
cd ../admin && npm test && npm run build
cd ../frontend && npm test && npm run lint && npm run build
```

Use the actual test script established in Task 3.

- [ ] **Step 2: Run GitNexus detect-changes before any commit/deploy**

Confirm only expected settings, branding, metadata, favicon route, and related tests are affected. Resolve unexpected execution-flow changes.

- [ ] **Step 3: Verify live endpoint headers**

```bash
curl -I https://petposture.com/favicon.png
curl -I https://petposture.com/favicon.ico
curl -I https://petposture.com/apple-touch-icon.png
curl -s https://petposture.com | grep -iE 'rel="(icon|shortcut icon|apple-touch-icon)"'
```

Expected `/favicon.png` contract:

```text
HTTP 200
Content-Type: image/png
No redirect to api.petposture.com/storage/...
```

- [ ] **Step 4: Verify live dimensions**

Use `file`, ImageMagick, Python/Pillow, or another trusted image inspector. Confirm favicon is exactly 96×96 PNG and Apple icon is 180×180 PNG.

- [ ] **Step 5: Verify failure fallback**

In a safe local/staging environment, make the settings API unavailable or return an invalid source and confirm `/favicon.png` still returns the valid fallback with HTTP 200.

- [ ] **Step 6: Request Google recrawl**

Use Google Search Console URL Inspection on `https://petposture.com/` and request indexing. Record the request date. Do not claim the search result favicon is fixed immediately; Google may take days or weeks to refresh it.

- [ ] **Step 7: Remind the user to refresh the GitNexus index after deployment**

The user runs this locally:

```bash
npx gitnexus analyze
```

Do not run it on their behalf unless explicitly requested.

---

## Final Acceptance Criteria

- [ ] `https://petposture.com/favicon.png` returns HTTP 200 and `Content-Type: image/png`.
- [ ] The response is exactly 96×96 and square, including when the configured source is oversized or non-square.
- [ ] API/storage/decoding failure returns the static fallback rather than an error or redirect.
- [ ] Storefront metadata always references `/favicon.png`, never a raw storage URL.
- [ ] Apple icon is a separate valid 180×180 PNG.
- [ ] No fake PNG-as-ICO file remains advertised as an ICO.
- [ ] Storefront favicon upload rejects SVG and explains the 96×96 output.
- [ ] Existing `shop_logo` and `shop_favicon` values remain backward compatible.
- [ ] `admin_logo` and `admin_favicon` persist and are returned by the API.
- [ ] React admin login and shell use admin branding with static fallbacks.
- [ ] Filament uses admin branding instead of storefront branding.
- [ ] Backend tests, admin tests, frontend tests/lint/build, and live HTTP checks pass.
- [ ] Google Search Console re-indexing has been requested after deployment.

## Suggested Commit Sequence

1. `fix: separate storefront and admin branding settings`
2. `fix(seo): serve storefront favicon from stable same-origin URL`
3. `feat(admin): load independent admin branding`
4. `fix(admin): use admin branding in legacy Filament panel`

Do not squash or modify unrelated existing work. Do not commit until GitNexus detect-changes and all applicable verification commands have completed.
