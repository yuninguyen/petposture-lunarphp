# Comparison Details Repeater — Admin Post Form

**Date:** 2026-08-22
**Status:** Approved, ready for implementation plan
**Scope:** `admin/` (Vite/React admin app) Post form, `backend/` (`Admin\PostController`,
`Admin\MediaController`, new `Admin\AffiliateNetworkController`) — Post resource only.

## Goal

Bring the retailer price-comparison repeater from the legacy Filament `PostResource` into the new
Vite/React admin, so editors can build "Comparison" type blog posts (product vs. product retailer
price tables) without touching Filament. This is the largest remaining functional gap identified
during the prior audit (`docs/superpowers/specs/2026-08-21-admin-post-list-form-redesign-design.md`,
"Explicitly OUT of scope" list).

## Why this scope

Per standing practice (audit before coding), the full legacy implementation was read before writing
this spec:
- `backend/app/Filament/Resources/PostResource.php` — `comparisonDetailsSection()`, the Repeater
  field definitions, and the `type` select that gates its visibility.
- `backend/app/Models/Post.php` — `TYPE_ARTICLE`/`TYPE_GUIDE`/`TYPE_COMPARISON` constants,
  `HasMetadata` trait usage.
- `backend/app/Traits/HasMetadata.php` — polymorphic metadata storage (no dedicated relational
  table).
- `backend/app/Http/Resources/Api/PostResource.php` (public-facing) — **already fully supports**
  `type` and comparison rendering via `resolveComparison()`/`resolveAssetUrl()`. No public-facing
  changes are needed; this spec is admin-side only.
- `backend/app/Http/Controllers/Api/Admin/MediaController.php` and
  `backend/app/Support/ImageUploadResizer.php` — confirmed the new admin's Curator-based media
  upload (`MediaController::store`) currently does **zero** resize/WebP conversion, unlike the old
  Filament `ImageUploadResizer`. This was a previously undocumented gap discovered during this
  design's audit, not just a "reuse vs. rebuild" question.

**Hard dependency confirmed:** the Comparison repeater cannot function without the `type` field,
since visibility is gated on `type === 'comparison'` both in the old Filament form and in this new
design. The `type` field (previously deferred in the prior spec) is bundled into this spec rather
than split into a separate one — confirmed with the user.

**Out of scope (unchanged from the prior spec):** `breeds`/`solutions`/`tags` relationships,
`featured_image_alt`, SEO Settings section, Duplicate/replicate action. None of these should be
started as a side effect of this work.

## What already works today (do NOT rebuild)

- Post create/edit: title, content, category, status, author, featured image — all functional
  (see prior spec, merged to `main` in commit range `739d2d8..53b438a`, 2026-08-21/22).
- Public-facing `Api\PostResource::resolveComparison()` — already reads `comparison_items` /
  `comparison_intro` / `disclosure_shown` from metadata and renders them correctly, including
  resolving both full URLs and relative storage paths via `resolveAssetUrl()`. No changes needed
  here.
- `HasMetadata` trait (`setMeta`/`getMeta`/`getAllMeta`) — reused as-is for storage; no new table.
- Curator media library + `MediaPicker.tsx` — reused as-is for the item image field's picker UI;
  only the underlying `MediaController::store` gains resize/WebP logic (see Backend API section).

## Section 1 — Scope

**In scope:**
- `type` field (`article` / `guide` / `comparison`) on the Post form, admin API, and admin list
  (bundled in per dependency above; list/filter UI for `type` is NOT required by this spec — only
  the form field and API support, matching what's needed to make Comparison posts creatable).
- Comparison Details section on the Post form: `comparison_intro`, `disclosure_shown`, and the
  `comparison_items` repeater (product_name, image, retailer, highlight, in_stock, price_display,
  price_cents, rating, affiliate_url, pros, cons, in_house_match_url) — full field parity with the
  legacy Filament repeater.
- Retailer options sourced from `AffiliateNetwork` (new `GET /admin/affiliate-networks` endpoint),
  matching the legacy Filament `Select::options(fn () => AffiliateNetwork::where('active', true)...)`.
- Image upload for repeater items reuses the existing Curator `MediaPicker` flow, with
  `MediaController::store` upgraded to resize + convert to WebP (parity with the legacy
  `ImageUploadResizer`, extracted into a plain Laravel-native helper since the old one is tightly
  coupled to Filament's `BaseFileUpload`).

**Explicitly out of scope:** everything listed under "What already works today" and "Out of scope"
above. If any of these turn out to be required as a side effect, stop and report back rather than
building them silently.

## Section 2 — Storage

No new migration, no new table. Reuses the existing polymorphic `HasMetadata` pattern already used
by `Post`:
- `comparison_intro` — string, stored via `setMeta('comparison_intro', $value)`.
- `disclosure_shown` — bool, stored via `setMeta('disclosure_shown', $value)`, default `true`.
- `comparison_items` — array of objects, stored via `setMeta('comparison_items', $value)`
  (JSON-encoded automatically by the trait's `type` discriminator).
- `type` — **not** metadata; it's a real column already present on `posts` (confirmed via
  `Post::TYPE_*` constants and the public `PostResource`'s existing read of `$post->type`). The
  admin API simply wasn't validating/accepting it yet — no migration needed.

## Section 3 — Backend API

### `backend/app/Http/Controllers/Api/PostController.php` (Admin)
- `store`/`update` validation: add `type` (`in:article,guide,comparison`, default `article`),
  `comparison_intro` (nullable string), `disclosure_shown` (nullable bool, default true),
  `comparison_items` (nullable array) with per-item rules:
  - `comparison_items.*.product_name` — required string
  - `comparison_items.*.image_url` — nullable string (path/URL from MediaPicker)
  - `comparison_items.*.retailer` — required string (must match an `AffiliateNetwork.slug`)
  - `comparison_items.*.highlight` — nullable, `in:best_overall,best_value,budget_pick`
  - `comparison_items.*.in_stock` — nullable bool, default true
  - `comparison_items.*.price_display` — required string
  - `comparison_items.*.price_cents` — required integer, `min:0`
  - `comparison_items.*.rating` — nullable numeric, `between:0,5`
  - `comparison_items.*.affiliate_url` — required, valid URL
  - `comparison_items.*.pros` / `cons` — nullable array of strings
  - `comparison_items.*.in_house_match_url` — nullable, valid URL
- After validated `store`/`update`, write `comparison_intro`/`disclosure_shown`/`comparison_items`
  via `setMeta()` (mirrors legacy `EditPost::afterSave()` behavior), and set the `type` column
  directly (it's a real column, not metadata).
- `show`/`index` (admin `Api\PostResource`): add `type` and the three comparison metadata fields to
  the response so the form can populate on edit, mirroring the legacy `mutateFormDataBeforeFill()`
  behavior.

### New: `backend/app/Http/Controllers/Api/Admin/AffiliateNetworkController.php`
- `index()`: returns `AffiliateNetwork::where('active', true)->select(['name', 'slug'])->get()` —
  no other fields (never expose `api_key`/`api_secret`/`merchant_id` to the admin frontend).

### `backend/routes/api.php`
- Add inside the existing `/admin` group (same `auth:sanctum` + `role:super_admin|admin|staff`
  middleware as all other admin routes):
  ```php
  Route::get('/affiliate-networks', [AffiliateNetworkController::class, 'index']);
  ```

### `backend/app/Http/Controllers/Api/Admin/MediaController.php`
- `store()`: after computing `$path = $file->store($directory, $disk)`, add resize + WebP
  conversion equivalent to the legacy `ImageUploadResizer`, extracted into a new plain helper class
  `backend/app/Support/ImageOptimizer.php` (framework-agnostic, no Filament dependency — takes a
  `SplFileInfo`/uploaded file path + max width/height, returns the processed file path):
  - Resize to fit within max dimensions (same GD-based `imagecopyresampled` approach as the legacy
    resizer) if the image exceeds them.
  - Convert JPEG/PNG to WebP at 85% quality, **except** animated GIFs (detected via the same
    frame-count heuristic used in `ImageUploadResizer`), which are preserved as GIF.
  - Preserve the original filename's base name (only the extension changes when converting to
    WebP) — this was an explicit UX requirement from the design discussion ("giữ name image").
  - `MediaController::store()` calls this helper before creating the `CuratorMedia` record, so
    `path`/`ext`/`width`/`height`/`size` reflect the final, optimized file.

## Section 4 — Frontend

### `admin/src/features/posts/PostFormPage.tsx`
- `type` `<select>` (article/guide/comparison) added to the existing "Post Settings" section,
  alongside Category/Status.
- New `ComparisonDetailsSection.tsx` component, rendered only when `watch('type') === 'comparison'`
  (parity with legacy `->visible(fn (Get $get) => $get('type') === Post::TYPE_COMPARISON)`):
  - `comparison_intro` textarea
  - `disclosure_shown` toggle, default `true`
  - `ComparisonItemRepeater` using React Hook Form `useFieldArray`, layout = **"B + collapsible"**
    (decided via visual companion mockup comparison):
    - Default collapsed row: small image (32px) + `product_name` + `price_display` + `rating` +
      "Sửa ▾" expand button (parity with legacy `itemLabel()` summary behavior — sourced live from
      current form state, no extra fetch).
    - Expanded view: larger image via reused `MediaPicker` component, then sub-sections with
      headers (parity with legacy field grouping):
      - **Thông tin cơ bản**: `product_name`, `retailer` (`<select>`, options from
        `useAffiliateNetworks()`), `highlight` (`<select>`), `in_stock` (toggle)
      - **Giá & Đánh giá**: `price_display`, `price_cents`, `rating`
      - **Ưu / nhược điểm**: `pros`/`cons` tag inputs (check `admin/src/components` for an existing
        tag-input component before writing a new one)
      - `affiliate_url`, `in_house_match_url` — URL-validated text inputs
    - "Thêm sản phẩm" button to append; per-item delete with confirm.

### `admin/src/features/posts/postsApi.ts`
- `useAffiliateNetworks()` hook — `GET /admin/affiliate-networks`, React Query, same caching
  pattern as the existing `useCategories()`.

### `admin/src/features/posts/postSchema.ts`
Add to the Zod schema:
```ts
type: z.enum(['article', 'guide', 'comparison']).default('article'),
comparison_intro: z.string().optional(),
disclosure_shown: z.boolean().default(true),
comparison_items: z.array(z.object({
  product_name: z.string().min(1),
  image_url: z.string().optional(),
  retailer: z.string().min(1),
  highlight: z.enum(['best_overall', 'best_value', 'budget_pick']).optional(),
  in_stock: z.boolean().default(true),
  price_display: z.string().min(1),
  price_cents: z.coerce.number().int().nonnegative(),
  rating: z.coerce.number().min(0).max(5).optional(),
  affiliate_url: z.string().url(),
  pros: z.array(z.string()).default([]),
  cons: z.array(z.string()).default([]),
  in_house_match_url: z.string().url().optional().or(z.literal('')),
})).default([]),
```

### i18n (`admin/src/locales/en.json` / `vi.json`)
Add both languages (per standing bilingual-UI requirement): `posts.type.*`, `posts.comparison.*`
(section title, intro label, disclosure label, add/remove product, expand/collapse labels, all
field labels and section sub-headers listed above).

## Section 5 — Testing

### Backend
- `tests/Feature/Admin/PostControllerTest.php` (extend): `type` accepted with correct default;
  `comparison_items`/`comparison_intro`/`disclosure_shown` round-trip through `store`/`update` →
  `show`/`index` via metadata; validation rejection tests for each required/typed field listed in
  Section 3; confirm `type != comparison` still works without comparison fields.
- `tests/Feature/Admin/AffiliateNetworkControllerTest.php` (new): only `active=true` networks
  returned; only `name`+`slug` exposed (no secrets); 401/403 enforcement matches other admin routes.
- `tests/Feature/Admin/MediaControllerTest.php` (extend): JPEG/PNG → WebP conversion; animated GIF
  preserved as GIF; oversized image resized to max dimensions; original filename base preserved
  across extension change.

### Frontend
- `postSchema.test.ts` (extend): all new Zod fields — `type` default, required-field rejections in
  `comparison_items`, `price_cents` coercion, `rating` range rejection.
- `postsApi.test.ts` (extend): `useAffiliateNetworks()` query behavior (mocked response, cache key).
- No component-level test runner currently exists for this admin app beyond schema/api unit tests
  (confirmed from prior audit) — `ComparisonItemRepeater`/collapsible behavior/`MediaPicker` reuse
  is verified **manually** via the dev server: add/remove/expand/collapse items, save→reload
  round-trip (no data loss), and confirm uploaded images are served as WebP.
