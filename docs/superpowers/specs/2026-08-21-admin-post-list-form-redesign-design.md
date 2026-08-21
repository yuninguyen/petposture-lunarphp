# Admin Post List/Form UI Redesign + Functional Gap Closing

**Date:** 2026-08-21
**Status:** Approved, ready for implementation plan
**Scope:** `admin/` (Vite/React admin app), Post resource only (List + Form + AppShell)

## Goal

Redesign the visual layout of the Post List and Post Form pages in the new Vite/React admin
(plus light `AppShell` polish), and close the small functional gaps versus the old Filament admin
that are cheap to add (backend already supports them or requires only a trivial addition).

## Why this scope, not full Filament parity

The old Filament `PostResource` (`backend/app/Filament/Resources/PostResource.php`) has
significantly more functionality than the new admin's `Admin\PostController` API exposes. A full
audit was done before writing this spec (per user instruction: audit everything, report before
coding, don't silently narrow scope). Result — split into "cheap, do now" vs. "expensive, separate
spec":

**In scope now (cheap — backend already supports it, or trivial addition):**
- Delete a post (backend `DELETE /admin/posts/{id}` already exists, just never wired into the UI)
- Filter by Status / Category (backend `index()` already accepts `?status=` and `?category=`
  query params, just never wired into the UI)
- Search by title (needs a small backend addition: `LIKE` on `title` in `PostController::index`)
- Pagination (backend currently returns *all* posts via `->get()`; switching to `->paginate(20)`
  is a small, contained change)
- `Author` field (backend `store`/`update` already accept `author`, form just doesn't expose it)
- `updated_at` on the list (DB column already exists via Eloquent timestamps, just not in
  `Api\PostResource::toArray()`)
- "View" link to the live published post (frontend-only, uses existing `slug` + known frontend
  URL pattern, no backend change)

**Explicitly OUT of scope — deferred to a future, separate spec:**
- `type` field (Article / Guide / Comparison) and the type badge/filter in the list
- `breeds` / `solutions` / `tags` multi-select relationships
- `featured_image_alt` field
- **Comparison Details** repeater (retailer price comparison — product name, image, retailer,
  price, rating, pros/cons, affiliate URL, in-stock toggle). This is the single largest chunk of
  the old Filament form and deserves its own spec.
- **SEO Settings** section (Google Search preview tab, Social Media tab, "Generate with AI"
  button). Note: the AI generation feature was already built once at the backend/infra level
  (Anthropic key configured and verified working on the VPS 2026-08-13) but the Anthropic account
  is currently out of credit, so it can't be exercised end-to-end yet even if the admin API/UI for
  it existed. See memory `project_ai_seo_anthropic_key_2026-08-07`.
- **Duplicate** (replicate) action — no backend endpoint exists for this yet.

None of the out-of-scope items should be started as part of implementing this spec. If any of
them turn out to be required as a side effect of the in-scope work, stop and report back rather
than building them silently.

## What already works today (do NOT rebuild)

- Auth (Bearer token via Sanctum personal access token), login/logout, language switcher — all
  working, out of scope for this redesign entirely.
- Post create/edit: title, content (TipTap rich text), category select, status select, featured
  image upload/picker (via `MediaPicker` + Curator media library) — all functional as of commit
  `fa782e5` (2026-08-21), which fixed:
  - Post form state no longer leaks across `/posts/new` ↔ `/posts/:id` navigation (`key={location.pathname}`
    remount in `App.tsx`)
  - Upload Image button no longer double-triggers the file picker (removed redundant `<label>`
    wrapper in `MediaPicker.tsx`)
- Backend `Admin\PostController` (`backend/app/Http/Controllers/Api/PostController.php`):
  `index` (with `status`/`category` filtering already, just unused by the frontend), `store`,
  `show`, `update`, `destroy` — all implemented and working, `destroy` just isn't called from the
  UI yet.

## Backend changes

File: `backend/app/Http/Controllers/Api/PostController.php`

- `index()`: add `search` query param — `->where('title', 'like', "%{$request->search}%")` when
  present. Combine with existing `category`/`status` filters (all optional, AND'd together).
- `index()`: switch `$query->get()` → `$query->paginate(20)`. `PostResource::collection()` on a
  paginator automatically produces the standard Laravel `{data, links, meta}` envelope — no manual
  reshaping needed.

File: `backend/app/Http/Resources/Api/PostResource.php`

- Add `'updated_at' => optional($this->updated_at)?->toISOString(),` to the returned array.

No migration needed — `updated_at` already exists on the `posts` table via standard Eloquent
timestamps.

## Frontend changes

### `admin/src/features/posts/postsApi.ts`
- `usePosts()` takes `{ search, status, category, page }` params, sends them as query string.
- Return type changes from `Post[]` to the paginated envelope (`{ data: Post[]; meta: {...} }`).
- Add `useDeletePost()` mutation (`DELETE /admin/posts/{id}`, invalidates `['posts']` query).
- Add `updated_at: string` to the `Post` interface.

### `admin/src/features/posts/PostsListPage.tsx`
- Toolbar row above the table: search input (debounced ~400ms), Status `<select>`, Category
  `<select>` (reuse categories already fetched for the form, or fetch once here).
- New `Updated` column (formatted date).
- New actions column: `View` (external link, only rendered when `status === 'published'`,
  `href` built from slug + frontend URL) and `Delete` (confirm dialog via a small inline
  confirm — no new dependency needed — then calls `useDeletePost()`).
- Pagination controls below the table, driven by `meta.current_page` / `meta.last_page`.
- Empty state: when `data.length === 0`, show a message distinguishing "no posts match your
  filters" (search/filter active) from "no posts yet" (no filters active).

### `admin/src/features/posts/PostFormPage.tsx`
- Add `Author` text input (register `author` in the form schema/values).
- Restructure the two-column card layout into two `Section`-style groups (reuse the existing
  `Card` primitive as the section container, just consolidate the six current single-field cards
  into two: "Content" — title + content editor; "Post Settings" — category, status, author,
  featured image). Keep the Save button at the top (existing behavior, matches prior feedback on
  primary actions).

### `admin/src/features/posts/postSchema.ts`
- Add optional `author` field to the Zod schema.

### `admin/src/layouts/AppShell.tsx`
- Visual polish only (spacing/active-state refinement) — no structural or nav-item changes. Do
  not add nav items for resources that don't exist yet (YAGNI).

## Testing

- Backend: extend/add Feature tests for `PostController::index` covering `search`, pagination
  shape (`data`/`meta`/`links` present), and confirm existing `status`/`category` filter tests
  still pass with pagination enabled.
- Backend: add a Feature test for `destroy` if one doesn't already exist (confirm 204 + record
  gone).
- Frontend: manual verification via the existing dev server (no frontend test runner currently
  wired for this app beyond `postSchema.test.ts`) — search, filter, delete (with confirm-cancel
  and confirm-accept paths), pagination, and the new Author field round-tripping through
  save/reload.
