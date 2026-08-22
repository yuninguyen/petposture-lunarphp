# Admin Post Parity — Remaining Gaps vs. Legacy Filament

**Date:** 2026-08-22
**Status:** Approved, ready for implementation
**Scope:** `admin/` (Vite/React admin app) Post list + form, `backend/` (`Api\PostController`,
new `Api\Admin\BlogTagController`, `Api\Admin\AiSeoController`) — Post resource only.
**Intended implementer:** external agent (Deepseek), not a Claude Code subagent — this document
is a self-contained requirements spec, not a Claude bite-sized TDD checklist.

## Goal

Close every remaining functional gap between the legacy Filament `PostResource`
(`backend/app/Filament/Resources/PostResource.php`) and the new Vite/React admin, so the old
Filament Post editor can eventually be retired. This is the "next phase" explicitly deferred by
`docs/superpowers/specs/2026-08-21-admin-post-list-form-redesign-design.md` (its "Explicitly OUT
of scope" list), now that the pilot (list/form redesign) and the Comparison Details repeater
(`docs/superpowers/specs/2026-08-22-comparison-details-repeater-design.md`) are both merged to
`main`.

## Why this scope / audit method

Per standing project practice (audit real code before writing scope, don't trust prior summaries),
every claim below was verified directly against the current `main` branch, not against memory or
prior chat summaries:
- `backend/app/Filament/Resources/PostResource.php` — full legacy form + table (source of truth
  for every field, action, and badge listed below).
- `backend/app/Models/Post.php` — `breeds()`/`solutions()`/`tags()` relationships and
  `hasOutOfStockComparisonItems()` **already exist on the model**, just unused by the new admin's
  controller.
- `backend/app/Http/Controllers/Api/PostController.php` — current `index`/`store`/`update`
  validation and query filtering (confirms exactly what's missing, not guessed).
- `backend/app/Http/Resources/Api/PostResource.php` (public + admin read resource) — **already
  returns `seo` and `tags`** in every response. Read-side plumbing for those two is done; only
  write-side (validation + persistence) and the admin form UI are missing.
- `backend/app/Services/AiSeoGeneratorService.php` — existing, working service (Anthropic
  `messages.create` with structured JSON schema output). No changes needed to this file — it just
  isn't wired to any admin route yet.
- `backend/app/Traits/HasSeo.php` — `seo()` is a polymorphic `morphOne(SeoMetadata::class,
  'seoable')`. `SeoMetadata` fillable: `title`, `description`, `keyphrase`, `og_title`,
  `og_description`, `og_image`, `canonical_url`, `is_indexable`, `is_followable`.
- `backend/app/Http/Controllers/Api/BreedController.php` / `SolutionController.php` — public
  `GET /breeds` and `GET /solutions` **already exist and are unauthenticated** (they power public
  breed/solution hub pages), returning `{data: [{id, name, slug, ...}]}`. This is public,
  non-sensitive catalog data — the admin form reuses these two endpoints directly instead of
  building new `/admin/*` duplicates.
- No equivalent public endpoint exists for `BlogTag` (`app/Models/BlogTag.php`, fillable `name`,
  `slug`) — a new lightweight admin endpoint is needed, mirroring the existing
  `PostController::categories()` pattern (`GET /admin/blog/categories`, returns a bare array).
- `admin/src/features/posts/*` (`PostFormPage.tsx`, `PostsListPage.tsx`, `postSchema.ts`,
  `postsApi.ts`) and `admin/src/components/ui/*` (`card`, `input`, `textarea`, `button`,
  `tag-input` — **no `select`/`toggle`/`checkbox`/`datetime` primitives exist**, confirming the
  established convention of plain native `<select>`/`<input type="checkbox">`/`<input
  type="datetime-local">` elements styled inline, same as the Comparison Details work).
- **Bonus bug found during audit (not in any prior spec's scope list):** legacy `CreatePost`/
  `EditPost` Filament hooks call `Post::estimateReadTime($content)` to auto-fill `read_time`
  (format: `"3 min read"`, a string — see `read_time` migration column type `string`). The new
  `PostController::store()`/`update()` never calls this helper, **and** its validation rule
  (`'read_time' => 'nullable|integer|min:0'`) is actively wrong for the string format the helper
  produces. Every post created via the new admin currently gets `read_time = null`. Fixed in
  Section G below.

## What already works today (do NOT rebuild)

- Post list: delete, status/category filter, search, pagination, author, `updated_at`, view link
  (spec 2, merged).
- Post form: title, content, category, status, author, featured image, `type` selector, full
  Comparison Details repeater (spec 3, merged).
- `Api\PostResource` (`backend/app/Http/Resources/Api/PostResource.php`) already reads and returns
  `seo` (all 6 fields) and `tags` (`name`+`slug`) on every `show`/`index` response — **no backend
  read-side changes needed for SEO or tags.** Only `store`/`update` (write side) and the frontend
  form UI are missing.
- `AiSeoGeneratorService::generate(string $title, ?string $content): array` — fully working,
  returns `seo_title`/`focus_keyphrase`/`meta_description`/`social_title`/`social_description`.
  Reused as-is, just needs a controller action + route to expose it to the new admin.
- `MediaController::store()` (already WebP/resize-optimized per spec 3) + `MediaPicker.tsx` —
  reused as-is for the `seo.og_image` field.
- Public `GET /breeds` / `GET /solutions` — reused as-is for admin multi-select options.

## Global Constraints

(Same conventions established by specs 2 and 3 — repeated here since this doc stands alone.)

- All new/modified admin API routes live under the existing `['auth:sanctum',
  'role:super_admin|admin|staff']` group in `backend/routes/api.php` (currently lines 121-142).
- `PostController` actions call `$this->authorizeAdmin()` as their first line — preserve this in
  every new/modified method.
- Backend tests: namespace `Tests\Feature\Api\Admin`, `use RefreshDatabase;`,
  `Role::firstOrCreate(['name' => 'admin', 'guard_name' => 'web']);`,
  `User::factory()->create()->assignRole('admin')`, `Sanctum::actingAs($user)`.
- Frontend: React Hook Form (`useForm`, `useFieldArray`, `useWatch`, `Controller`) +
  `zodResolver`, React Query, reuse `admin/src/components/ui/*` primitives (`forwardRef` + `clsx`
  pattern) — **do not introduce a new component library**; follow the plain-native-element
  convention for select/checkbox/date inputs (no toggle/select/datetime primitive exists).
  `admin/src/lib/api.ts` (`fetchApi`/`fetchJson`).
  i18next flat dot-notation keys added to **both** `admin/src/locales/en.json` and `vi.json`
  (standing bilingual-UI requirement).
- Zod version is 3.23.8 — `.url(message)` takes a plain string argument, not an options object.
- No new database migrations required anywhere in this spec — every field/relationship already
  exists in the schema (`posts` table columns, `post_breed`/`post_solution`/`blog_post_tag` pivot
  tables, `metadata`/`seo_metadata` polymorphic tables all pre-exist).
- Every changed/created line must trace to this spec; no speculative abstractions, no unrelated
  refactors. If something outside this spec's sections turns out to be required as a side effect,
  stop and report back rather than building it silently.

---

## Section A — Taxonomy relationships (breeds / solutions / tags)

**Scope:** multi-select fields on the Post form; persisted via `belongsToMany` sync; shown as
chips/tags in the edit form on load.

**Backend:**
- New: `backend/app/Http/Controllers/Api/Admin/BlogTagController.php` — `index()`:
  `BlogTag::orderBy('name')->get()` (bare array response, matching
  `PostController::categories()`'s existing precedent — no `{data: [...]}` envelope).
- `backend/routes/api.php`: add inside the existing `/admin` group:
  ```php
  Route::get('/blog/tags', [BlogTagController::class, 'index']);
  ```
- `PostController::validationRules()`: add
  - `'breeds' => 'nullable|array'`, `'breeds.*' => 'integer|exists:breeds,id'`
  - `'solutions' => 'nullable|array'`, `'solutions.*' => 'integer|exists:solutions,id'`
  - `'tags' => 'nullable|array'`, `'tags.*' => 'integer|exists:blog_tags,id'`
- `PostController::extractComparisonData()` is comparison-specific; add a **separate** small
  private helper `extractTaxonomyData(array &$validated): array` that pulls `breeds`/`solutions`/
  `tags` out of `$validated` (they aren't `Post` columns) the same way, called from both `store()`
  and `update()`.
- After `Post::create($validated)` / `$post->update($validated)`, call:
  ```php
  $post->breeds()->sync($taxonomy['breeds'] ?? []);
  $post->solutions()->sync($taxonomy['solutions'] ?? []);
  $post->tags()->sync($taxonomy['tags'] ?? []);
  ```
- `Api\PostResource::toArray()`: add `breeds`/`solutions` to the response (mirrors the existing
  `tags` mapping already there):
  ```php
  'breeds' => $this->breeds->map(fn ($b) => ['id' => (string) $b->id, 'name' => $b->name])->values(),
  'solutions' => $this->solutions->map(fn ($s) => ['id' => (string) $s->id, 'name' => $s->name])->values(),
  'tags' => $this->tags->map(fn ($t) => ['id' => (string) $t->id, 'name' => $t->name, 'slug' => $t->slug])->values(),
  ```
  (note: `tags` currently omits `id` — add it, since the form needs it for the multi-select's
  selected-value list; this is additive, not breaking, for any existing consumer.)
- `PostController::index()`: eager-load `breeds`/`solutions` alongside the existing
  `['blogCategory', 'metadata', 'tags', 'seo', 'featuredMedia']` in the `Post::with([...])` call,
  so `show()`/`index()` don't N+1.

**Frontend:**
- `admin/src/features/posts/postsApi.ts`: add `useBreeds()` and `useSolutions()` hooks —
  `GET /breeds` / `GET /solutions` (public, no admin prefix), unwrap `res.data`, React Query,
  cached like `useAffiliateNetworks()`. Add `useBlogTags()` — `GET /admin/blog/tags`, unwrapped
  bare array (matches `categories` fetch pattern already in `PostFormPage.tsx`).
- `admin/src/features/posts/postSchema.ts`: add
  ```ts
  breeds: z.array(z.string()).default([]),
  solutions: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  ```
  (string IDs, matching how `blog_category_id` is already handled as a string in this schema.)
- `PostFormPage.tsx`: three new `<select multiple>` fields in the "Post Settings" card (below
  `type`), each a plain multi-select styled like the existing single `<select>` (per the
  no-component-library convention) with the query results as `<option>`s, wired via `Controller`
  (multi-select needs array value handling, not plain `register()`).
- On `reset()` (edit-load effect), map `existingPost.breeds`/`.solutions`/`.tags` (`{id, name}[]`)
  to `string[]` of ids for the three new fields, same pattern as `comparison_items` mapping above
  it.

**Testing:**
- Backend: extend `backend/tests/Feature/Api/Admin/PostControllerComparisonTest.php`'s sibling
  test file (or a new `PostControllerTaxonomyTest.php` in the same namespace) — round-trip
  `breeds`/`solutions`/`tags` through `store`→`show` and `update`→`show`; confirm `sync()`
  replaces (not appends) on update; confirm invalid ids (`exists:` rule) are rejected.
  New `BlogTagControllerTest.php`: 401/403 enforcement matches other admin routes; returns all
  tags with `id`/`name`/`slug`.
- Frontend: extend `postSchema.test.ts` for the three new array fields' defaults; extend
  `postsApi.test.ts` for `useBreeds`/`useSolutions`/`useBlogTags` (mocked response, cache key,
  `.data` unwrapping for the first two vs. bare array for the third).

---

## Section B — Featured Image Alt Text

**Scope:** single text field, already fully supported end-to-end except the form UI.

**Backend:** none — `featured_image_alt` is already fillable on `Post`, already validated
(`'featured_image_alt' => 'nullable|string|max:255'` already present in
`PostController::validationRules()`), already returned by `Api\PostResource`.

**Frontend:**
- `postSchema.ts`: `featured_image_alt` is already `z.string().optional()` — no schema change.
- `PostFormPage.tsx`: add a single `<Input {...register('featured_image_alt')} />` directly under
  the `MediaPicker` for `featured_media_id`, labeled via new i18n key
  `posts.form_label_featured_image_alt`.
- On `reset()`, add `featured_image_alt: existingPost.featured_image_alt ?? ''`.

**Testing:** no new backend test needed (already covered by existing store/update tests via the
pre-existing validation rule — confirm with a quick grep that a round-trip assertion exists; if
not, add one line to the existing `PostControllerTest`/`PostControllerComparisonTest`). Frontend:
none beyond the existing schema test suite (optional string field, nothing to validate).

---

## Section C — Published At

**Scope:** optional datetime field, mirroring the legacy `DateTimePicker::make('published_at')`.
Note the current auto-behavior (`PostController` sets `published_at = now()` automatically the
first time `status` becomes `published`) stays as the default; this field lets an editor override
it (e.g., backdate an import, or schedule by setting a future timestamp — note: this spec does
**not** add scheduled-publish enforcement/cron, it only makes the column editable, matching what
the legacy Filament field did — it was a plain editable `DateTimePicker`, no scheduling logic
either).

**Backend:** none for the field itself — `published_at` is already fillable, already validated
(`'published_at' => 'nullable|date'`), already cast to `datetime`, already returned by
`Api\PostResource`. One real fix needed: `store()` currently **unconditionally** overwrites
`published_at` with `now()` whenever `status === 'published'`, regardless of what the client sent —
change
`if ($validated['status'] === 'published') { $validated['published_at'] = now(); }`
to
`if ($validated['status'] === 'published' && empty($validated['published_at'])) { $validated['published_at'] = now(); }`
so an editor can set a specific past/future timestamp on create too. `update()`'s existing guard
(`! $post->published_at`) already only auto-sets when truly empty — no change needed there.

**Frontend:**
- `postSchema.ts`: `published_at` is already `z.string().nullable().optional()` — no change.
- `PostFormPage.tsx`: add `<input type="datetime-local" {...register('published_at')} />` in Post
  Settings, labeled `posts.form_label_published_at`. Datetime-local inputs need
  `YYYY-MM-DDTHH:mm` format — on `reset()`, convert the ISO string from the API:
  `published_at: existingPost.published_at ? existingPost.published_at.slice(0, 16) : ''`. On
  submit, an empty string must become `null` (not sent as `""`, which fails the `nullable|date`
  rule) — add a small transform in `onSubmit`: `published_at: values.published_at || null`.

**Testing:**
- Backend: one new test asserting `store()` respects an explicit `published_at` even when
  `status === 'published'` (the fix above), plus the existing implicit-now-on-publish behavior
  still passes for the no-value case.
- Frontend: extend `postSchema.test.ts` for the nullable/optional field (already covered
  structurally — just confirm empty string doesn't fail `.nullable().optional()`, which it doesn't
  since Zod's `.optional()` doesn't validate format here — no `.datetime()` refinement is used).

---

## Section D — SEO Settings + AI Generate

**Scope:** the single largest remaining chunk. Two sections' worth of fields
(`seo.title`/`seo.keyphrase`/`seo.description`, `seo.og_title`/`seo.og_description`/`seo.og_image`)
plus a "Generate with AI" button that calls the existing `AiSeoGeneratorService`.

**Backend:**
- `PostController::validationRules()`: add
  ```php
  'seo' => 'nullable|array',
  'seo.title' => 'nullable|string|max:60',
  'seo.keyphrase' => 'nullable|string|max:255',
  'seo.description' => 'nullable|string|max:160',
  'seo.og_title' => 'nullable|string|max:255',
  'seo.og_description' => 'nullable|string|max:500',
  'seo.og_image' => 'nullable|string|max:2048',
  ```
- Add a private helper (same pattern as `extractComparisonData`) `extractSeoData(array &$validated): ?array`
  that pulls `seo` out of `$validated` and returns it (or `null` if absent), called from both
  `store()`/`update()`.
- After `Post::create()`/`$post->update()`, if SEO data present:
  ```php
  $post->seo()->updateOrCreate([], $seoData);
  ```
  (`updateOrCreate([], ...)` on a `morphOne` relation creates-or-updates the single related row —
  matches the legacy Filament behavior of one `SeoMetadata` row per post.)
- New: `backend/app/Http/Controllers/Api/Admin/AiSeoController.php`:
  ```php
  public function generate(Request $request): JsonResponse
  {
      $validated = $request->validate([
          'title' => 'required|string|max:255',
          'content' => 'nullable|string',
      ]);

      try {
          $result = app(AiSeoGeneratorService::class)->generate($validated['title'], $validated['content'] ?? null);
      } catch (\Throwable $e) {
          return response()->json(['message' => $e->getMessage()], 422);
      }

      return response()->json($result);
  }
  ```
  Relies solely on route middleware for auth (matches `AffiliateNetworkController`'s existing
  precedent — the newest controller in this codebase). Takes `title`/`content` directly from the
  (possibly-unsaved) form state — mirrors the legacy Filament action's signature exactly
  (`$get('title')`, `$get('content')`), so it works on both create and edit before the post has
  been saved.
- `backend/routes/api.php`: add inside the `/admin` group:
  ```php
  Route::post('/posts/generate-seo', [AiSeoController::class, 'generate']);
  ```
  (Route is `/posts/generate-seo`, not `/posts/{post}/generate-seo` — it must work for unsaved
  new posts, same as the legacy in-form action.)

**Frontend:**
- `postSchema.ts`: add
  ```ts
  seo: z.object({
    title: z.string().max(60).optional(),
    keyphrase: z.string().optional(),
    description: z.string().max(160).optional(),
    og_title: z.string().optional(),
    og_description: z.string().max(500).optional(),
    og_image: z.string().nullable().optional(),
  }).optional(),
  ```
- New `admin/src/features/posts/SeoSettingsSection.tsx`: a `Card` with two stacked labeled
  sub-sections (no tab primitive exists in this codebase, per the plain-native-element convention)
  — "Google Search" (`seo.title`, `seo.keyphrase`, `seo.description` as `Textarea`) and "Social
  Media" (`seo.og_title`, `seo.og_description` as `Textarea`, `seo.og_image` via the existing
  `MediaPicker`, same reuse pattern as `featured_media_id`/comparison item images — **note:**
  `MediaPicker` returns a Curator media `id`, but `SeoMetadata.og_image` is a plain string
  path/URL column, not a `featured_media_id` foreign key — store the picked media's resolved `url`
  string into `seo.og_image`, not its id). A "Generate with AI" button at the top of the card,
  calling a new `useGenerateSeo()` mutation (`POST /admin/posts/generate-seo` with
  `{title, content}` from current form values via `getValues()`), which on success calls
  `setValue()` for all 5 text fields (`seo.title` through `seo.og_description`) and shows a
  success/error message inline (mirrors the legacy Filament Notification behavior, adapted to this
  admin's existing inline-error pattern already used for `mutation.isError` in
  `PostFormPage.tsx`).
- `postsApi.ts`: add
  ```ts
  export function useGenerateSeo() {
    return useMutation({
      mutationFn: (payload: { title: string; content: string }) =>
        fetchJson<{ seo_title: string; focus_keyphrase: string; meta_description: string; social_title: string; social_description: string }>(
          '/admin/posts/generate-seo',
          { method: 'POST', body: payload }
        ),
    });
  }
  ```
- `PostFormPage.tsx`: render `<SeoSettingsSection control={control} register={register} setValue={setValue} getValues={getValues} />` after the Comparison Details section (unconditional — SEO applies to all post types, not just comparisons).
- On `reset()`, map `existingPost.seo` (already returned by the API per the audit above) into the
  form's `seo.*` fields, defaulting each to `''`/`null` if the post has no SEO row yet.

**Testing:**
- Backend: extend the Post controller test suite — `seo.*` round-trips through `store`/`update` →
  `show`; a second `update()` call **updates** the existing row rather than creating a duplicate
  (`updateOrCreate` semantics); `max:60`/`max:160` validation rejections.
  New `AiSeoControllerTest.php`: mock/fake `AiSeoGeneratorService` (bind a test double in the
  container) to assert the controller returns its output verbatim; 422 on service exception;
  401/403 enforcement; `title` required, `content` optional.
- Frontend: extend `postSchema.test.ts` for the new nested `seo` object's field-level constraints;
  new `postsApi.test.ts` case for `useGenerateSeo()` (mocked POST, success payload shape). No
  component test for `SeoSettingsSection` (no test-library infra, per established precedent) —
  verified manually: generate → fields populate → save → reload round-trip.

---

## Section E — Duplicate (Replicate) Action

**Scope:** one new list-row action that clones a post (all fields + metadata + SEO), matching the
legacy `ReplicateAction`'s exact behavior: title gets `" (Copy)"` appended, slug gets a random
suffix, status resets to `draft`, `published_at` resets to `null`.

**Backend:**
- `PostController`: new method (read `app/Traits/HasMetadata.php` first to confirm its actual
  `getAllMeta()`/`setMeta()` signatures before implementing — don't guess):
  ```php
  public function duplicate(Post $post): JsonResponse
  {
      $this->authorizeAdmin();

      $replica = $post->replicate();
      $replica->title = $post->title.' '.__('(Copy)');
      $replica->slug = \Illuminate\Support\Str::slug($replica->title).'-'.\Illuminate\Support\Str::random(6);
      $replica->status = 'draft';
      $replica->published_at = null;
      $replica->save();

      foreach ($post->getAllMeta() as $key => $value) {
          $replica->setMeta($key, $value);
      }

      $replica->breeds()->sync($post->breeds->pluck('id'));
      $replica->solutions()->sync($post->solutions->pluck('id'));
      $replica->tags()->sync($post->tags->pluck('id'));

      if ($post->seo) {
          $replica->seo()->create($post->seo->only([
              'title', 'keyphrase', 'description', 'og_title', 'og_description', 'og_image',
          ]));
      }

      return (new PostResource($replica->fresh()))->response()->setStatusCode(201);
  }
  ```
- `backend/routes/api.php`: add inside the `/admin` group:
  ```php
  Route::post('/posts/{post}/duplicate', [PostController::class, 'duplicate']);
  ```

**Frontend:**
- `postsApi.ts`: add
  ```ts
  export function useDuplicatePost() {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: (id: string) => fetchJson<{ data: Post }>(`/admin/posts/${id}/duplicate`, { method: 'POST' }),
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ['posts'] }),
    });
  }
  ```
- `PostsListPage.tsx`: add a "Duplicate" button next to the existing Delete button in the actions
  column, calling `useDuplicatePost().mutate(post.id)`, new i18n key `posts.action_duplicate`.

**Testing:**
- Backend: new test asserting the replica has the modified title/slug/status/published_at, that
  metadata/breeds/solutions/tags/seo are all copied, and that editing the replica afterward doesn't
  mutate the original (basic non-shared-reference sanity check).
- Frontend: no new schema/api unit test infra beyond confirming the mutation function shape (add
  one case to `postsApi.test.ts` mirroring `useDeletePost`'s existing test).

---

## Section F — List: Type badge/filter, Out-of-stock badge, Bulk delete

**Scope:** three independent, small list-page additions.

**F1. Type filter + column**
- Backend: `PostController::index()` — add
  `if ($request->filled('type')) { $query->where('type', $request->type); }`, same pattern as the
  existing `status`/`category` filters.
- Frontend: `postsApi.ts` `PostsFilters`/`buildPostsQuery` — add
  `type?: 'article' | 'guide' | 'comparison'` and its query param. `Post` interface — add
  `type: 'article' | 'guide' | 'comparison'`. `PostsListPage.tsx` — add a `type` filter `<select>`
  next to the status/category ones (options: All/Article/Guide/Comparison, i18n reuses the
  existing `posts.type.*` keys from spec 3), and a new table column rendering a colored badge
  (reuse the same badge style already used for `status`, with `article`→gray, `guide`→blue,
  `comparison`→amber, matching the legacy Filament color mapping `warning`/`info`/`gray`).

**F2. Out-of-stock badge**
- Backend: `Api\PostResource::toArray()` — add
  `'has_out_of_stock_comparison_items' => $this->hasOutOfStockComparisonItems()` (method already
  exists on the model per the audit above — zero new backend logic, just expose it).
- Frontend: `Post` interface — add `has_out_of_stock_comparison_items: boolean`.
  `PostsListPage.tsx` — in the `title` column's cell renderer, append a small red "⚠ Out of stock"
  badge span when true, matching the legacy Filament badge's text/color exactly
  (`bg-danger-100 text-danger-700`, translated via new i18n key `posts.badge_out_of_stock`).

**F3. Bulk delete**
- Backend: new method on `PostController`:
  ```php
  public function bulkDestroy(Request $request): JsonResponse
  {
      $this->authorizeAdmin();
      $validated = $request->validate(['ids' => 'required|array', 'ids.*' => 'integer|exists:posts,id']);
      Post::whereIn('id', $validated['ids'])->delete();
      return response()->json(null, 204);
  }
  ```
  Route: `Route::post('/posts/bulk-delete', [PostController::class, 'bulkDestroy']);` inside the
  `/admin` group (POST, not DELETE, since DELETE-with-body is unreliable across HTTP
  clients/proxies — matches how most Laravel APIs handle this).
- Frontend: `PostsListPage.tsx` — add a checkbox column (TanStack Table row selection via
  `getRowModel`'s built-in selection state — no new dependency needed, `@tanstack/react-table`
  already ships this), a header checkbox for select-all-on-page, and a "Delete selected (N)"
  button above the table that appears only when `Object.keys(rowSelection).length > 0`, calling a
  new `useBulkDeletePosts()` mutation (`postsApi.ts`, `POST /admin/posts/bulk-delete` with
  `{ids: string[]}`), with the same `window.confirm` pattern as the existing single-delete.

**Testing:**
- Backend: extend `PostControllerTest`/index tests for the `type` filter; one-line assertion for
  `has_out_of_stock_comparison_items` true/false in the comparison test file; new `bulkDestroy`
  test (deletes exactly the given ids, leaves others untouched, 403 for non-admin, validation
  rejection for non-existent ids).
- Frontend: extend `postsApi.test.ts` for the `type` query param and `useBulkDeletePosts()`.

---

## Section G — Bonus fix: `read_time` auto-compute

**Scope:** restore parity with the legacy behavior where `read_time` is server-computed from
`content`, not left null.

**Backend:**
- `PostController::validationRules()`: change `'read_time' => 'nullable|integer|min:0'` to
  `'read_time' => 'nullable|string|max:64'` (matches the actual `string` column type and the
  `"N min read"` format `Post::estimateReadTime()` produces — the `integer` rule was simply wrong
  and would currently reject any client that tried to send the real format).
- `store()`: after building `$validated` (before `Post::create()`), add
  `$validated['read_time'] = Post::estimateReadTime($validated['content']);` — always
  server-computed, ignoring any client-sent value (matches legacy: the Filament hook always
  overwrites it, it's never user-editable).
- `update()`: same, after validation —
  `if (isset($validated['content'])) { $validated['read_time'] = Post::estimateReadTime($validated['content']); }`
  (only recompute when content actually changed, since `update()` uses `sometimes` rules).

**Frontend:** none — `read_time` is never form-editable in the legacy UI either; no field to add.

**Testing:** one backend test asserting a created/updated post's `read_time` matches
`Post::estimateReadTime()`'s output for its content.

---

## Section H — Bonus fix: Comparison item `highlight` free-text → enum

**Scope:** `comparison_items[].highlight` is currently a free-text `<Input>` in the admin form
(`admin/src/features/posts/ComparisonItemRepeater.tsx`), but both the legacy Filament
`PostResource` (`Select::make('highlight')` with exactly 3 options) and the already-approved
`docs/superpowers/specs/2026-08-22-comparison-details-repeater-design.md` (Section 3, line 98:
backend `in:best_overall,best_value,budget_pick`; line 176: frontend
`z.enum(['best_overall', 'best_value', 'budget_pick'])`) specify a 3-value enum. The public
frontend (`frontend/.../ComparisonTable.tsx`) has a hardcoded `HIGHLIGHT_LABEL` map for exactly
these 3 values — any other string saved via the free-text input renders as blank/no badge on the
live site. This is a real production bug (silent data-quality issue), not a style nit, found during
this audit while re-confirming spec 3's approved shape against current code.

**Backend:**
- `backend/app/Http/Controllers/Api/PostController.php`, `validationRules()`: change
  `'comparison_items.*.highlight' => 'nullable|string|max:255'` to
  `'comparison_items.*.highlight' => 'nullable|in:best_overall,best_value,budget_pick'`.

**Frontend:**
- `admin/src/features/posts/postSchema.ts`: change the `highlight` field from `z.string().optional()`
  (or equivalent free-text shape) to
  `z.enum(['best_overall', 'best_value', 'budget_pick']).optional().or(z.literal(''))` (allow empty
  string for "no highlight selected", matching the nullable-on-backend semantics — confirm the
  exact current type before editing, since it must round-trip cleanly with `''` as the unset state
  used elsewhere in this form).
- `admin/src/features/posts/ComparisonItemRepeater.tsx`: replace the current
  `<Input {...register(`comparison_items.${index}.highlight`)} />` (line ~97) with a plain
  `<select {...register(...)}>` offering: empty/"None" option + the 3 enum values, labeled via
  i18n keys matching the legacy option labels (`posts.comparison.highlight.best_overall` = "Best
  Overall", `.best_value` = "Best Value", `.budget_pick` = "Budget Pick" — add both `en.json` and
  `vi.json` entries).
- **Data migration note:** any already-saved posts with a free-text `highlight` value outside the 3
  enum values will fail validation on their next `update()` unless the field is also touched/reset
  in the UI. This spec does not include a database backfill script — flag any existing
  out-of-enum values found in production `metadata` rows (query:
  `SELECT post_id, value FROM metadata WHERE key = 'comparison_items'` and inspect the JSON) back to
  the user before deploying this fix, rather than silently dropping/coercing them.

**Testing:**
- Backend: extend the existing comparison controller test — assert an out-of-enum `highlight` value
  is rejected with a 422; assert the 3 valid values and empty/null all pass.
- Frontend: extend `postSchema.test.ts` for the enum constraint (valid values pass, arbitrary string
  fails or is coerced to invalid per the chosen schema shape above).

---

## i18n

Add both `en.json` and `vi.json` keys for every new label referenced above: taxonomy field labels
(`posts.form_label_breeds`/`_solutions`/`_tags`), `posts.form_label_featured_image_alt`,
`posts.form_label_published_at`, the full SEO section (`posts.seo.*` — section title, sub-section
headers, all 6 field labels, generate button + loading/error states), `posts.action_duplicate`,
`posts.badge_out_of_stock`, `posts.filter_type_all`, `posts.header_type`,
`posts.bulk_delete_selected` (with a `{{count}}` interpolation), `posts.bulk_confirm_delete`,
`posts.comparison.highlight.best_overall`/`.best_value`/`.budget_pick`.

## Testing summary (full list, for planning purposes)

Backend: `PostControllerTaxonomyTest`, `BlogTagControllerTest`, `AiSeoControllerTest`, plus
extensions to the existing Post controller test file(s) for: featured_image_alt round-trip (if
missing), published_at explicit-value-on-create fix, SEO round-trip + upsert semantics, duplicate
action, type filter, out-of-stock flag exposure, bulk delete, read_time auto-compute, highlight
enum validation.
Frontend: extensions to `postSchema.test.ts` and `postsApi.test.ts` per section above. No new
component-test infra (confirmed absent, per established precedent from spec 3's plan) — all new UI
(`SeoSettingsSection`, taxonomy multi-selects, bulk-select checkboxes, duplicate button, highlight
select) verified manually via the dev server, same as the Comparison Details repeater was.
