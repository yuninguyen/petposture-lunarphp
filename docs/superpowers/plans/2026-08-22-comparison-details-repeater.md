# Comparison Details Repeater Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let admins build a "comparison" post type with a repeatable list of retailer offers (product name, image, retailer, price, rating, pros/cons, affiliate URL) that renders as a comparison table on the public blog post.

**Architecture:** Backend stores comparison data as `Post` metadata (`comparison_intro`, `disclosure_shown`, `comparison_items`) via the existing `HasMetadata` trait — no new tables/migrations. `PostController::store()/update()` validates and persists this data conditionally when `type === 'comparison'`. `PostResource` (already implemented) exposes it back to the frontend. The admin frontend adds a `type` selector to the post form and, when `comparison` is selected, a new `ComparisonDetailsSection` with a `useFieldArray`-based repeater (`ComparisonItemRepeater`), reusing the existing `MediaPicker` for images and a new `TagInput` for pros/cons.

**Tech Stack:** Laravel 11 (PHP), PHPUnit, React + TypeScript, React Hook Form + Zod, React Query, Vitest.

**Source spec:** `docs/superpowers/specs/2026-08-22-comparison-details-repeater-design.md`

## Known Deviations From the Approved Spec

These were discovered by re-reading the actual current codebase during planning. Flagging them explicitly per project practice (verify scope before coding).

1. **`PostResource.php` needs no changes.** The spec's Section 3 implies work here, but `app/Http/Resources/Api/PostResource.php` already returns `type` (line 25) and a fully-built `comparison` object via `resolveComparison()` (line 44), including `retailer_label`, `retailer_logo`, `redirect_url`, and numeric-safe `rating`/`price_cents` casts. No task below touches this file.
2. **`AffiliateNetworkController::index()` returns a bare JSON array, not a `{data: [...]}` Resource envelope.** This matches the existing precedent `PostController::categories()` (`return response()->json(BlogCategory::all());`), which the frontend already consumes unwrapped (`fetchJson<BlogCategory[]>(...)`, no `.data`). Task 2 and Task 5 are built around this real contract.
3. **No React component-testing infrastructure exists** in `admin/` (no `@testing-library/react`). Task 4/5 tests are pure-function tests (Zod schema, API extractor). Task 6/7's new UI components (`TagInput`, `ComparisonItemRepeater`, `ComparisonDetailsSection`) have no automated test — verified manually in Task 8's final check.
4. **Test file naming/location follows the actual existing convention**, not the spec's suggested `tests/Feature/Admin/PostControllerTest.php`. Real convention (confirmed in `backend/tests/Feature/Api/Admin/`) is per-concern file splitting under `Tests\Feature\Api\Admin`. New tests: `PostControllerComparisonTest.php`, `AffiliateNetworkControllerTest.php`, `ImageOptimizerTest.php` (this last one under `Tests\Feature\Support`, mirroring the `app/Support` namespace), all following that split-by-concern style.
5. **No `useCategories()` hook exists anywhere in the codebase.** The spec's phrase "same caching pattern as the existing `useCategories()`" refers to something that doesn't exist — categories are fetched inline via `useQuery` in `PostFormPage.tsx`. `useAffiliateNetworks()` is still added to `postsApi.ts` per the spec's file-placement instruction, but modeled on the real `usePost`/similar hooks already in that file, not a nonexistent one.
6. **No toggle/switch/checkbox UI primitive exists.** Booleans (`disclosure_shown`, `in_stock`) use plain `<input type="checkbox">` styled inline, matching how booleans are handled elsewhere in the admin (no dedicated `Checkbox` component to import).

## Global Constraints

- All new/modified admin API routes live under the `['auth:sanctum', 'role:super_admin|admin|staff']` group in `backend/routes/api.php` (lines 121-140).
- `PostController` actions call `$this->authorizeAdmin()` as their first line — preserve this in `store()`/`update()`. `MediaController` and the new `AffiliateNetworkController` rely solely on route middleware, matching `MediaController`'s existing pattern (no redundant `authorizeAdmin()` call).
- No new database migrations. Comparison data is stored entirely via `HasMetadata` (`setMeta`/`getMeta`/`getAllMeta`) on the polymorphic `metadata` table.
- Backend tests: namespace `Tests\Feature\Api\Admin` (or `Tests\Feature\Support` for the `ImageOptimizer` unit test), `use RefreshDatabase;`, `Role::firstOrCreate(['name' => 'admin', 'guard_name' => 'web']);`, `User::factory()->create()->assignRole('admin')`, `Sanctum::actingAs($user)`, direct model `::create()` (no factories for `Post`/`CuratorMedia`/`AffiliateNetwork`), `Storage::fake('public')` for upload tests.
- Frontend: React Hook Form (`useForm`, `useFieldArray`, `useWatch`, `Controller`) + `zodResolver`, React Query, reuse `admin/src/components/ui/*` primitives (`forwardRef` + `clsx` pattern), `admin/src/lib/api.ts` (`fetchApi`/`fetchJson`), i18next flat dot-notation keys added to both `admin/src/locales/en.json` and `vi.json`.
- Zod version is 3.23.8 — `.url(message)` takes a plain string argument, not an options object.
- Every changed/created line must trace to this plan; no speculative abstractions, no unrelated refactors.

---

### Task 1: Backend — `PostController` comparison validation & persistence

**Files:**
- Modify: `backend/app/Http/Controllers/Api/PostController.php` (`store()` lines 52-77, `update()` lines 86-107)
- Test: `backend/tests/Feature/Api/Admin/PostControllerComparisonTest.php` (create)

**Interfaces:**
- Consumes: `App\Models\Post` (`TYPE_ARTICLE`, `TYPE_GUIDE`, `TYPE_COMPARISON` constants, fillable `type`), `App\Traits\HasMetadata` (`setMeta(string $key, mixed $value, string $type = 'string'): void`, already used elsewhere on `Post`), `App\Models\AffiliateNetwork` (`slug` column, used only for validation existence check).
- Produces: `PostController::validationRules(bool $forUpdate): array`, `PostController::extractComparisonData(array $validated): array`, `PostController::syncComparisonMeta(Post $post, array $data): void` — private helpers used only within this controller; no other task depends on their names.

- [ ] **Step 1: Write the failing tests**

```php
<?php

namespace Tests\Feature\Api\Admin;

use App\Models\AffiliateNetwork;
use App\Models\BlogCategory;
use App\Models\Post;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class PostControllerComparisonTest extends TestCase
{
    use RefreshDatabase;

    protected BlogCategory $category;

    protected function setUp(): void
    {
        parent::setUp();
        Role::firstOrCreate(['name' => 'admin', 'guard_name' => 'web']);
        $user = User::factory()->create();
        $user->assignRole('admin');
        Sanctum::actingAs($user);

        $this->category = BlogCategory::factory()->create();

        AffiliateNetwork::create([
            'name' => 'Chewy', 'slug' => 'chewy', 'active' => true,
        ]);
    }

    protected function basePayload(array $overrides = []): array
    {
        return array_merge([
            'blog_category_id' => $this->category->id,
            'title' => 'Best Orthopedic Dog Beds',
            'slug' => 'best-orthopedic-dog-beds',
            'content' => '<p>Intro</p>',
            'status' => 'draft',
            'type' => Post::TYPE_ARTICLE,
        ], $overrides);
    }

    protected function comparisonItem(array $overrides = []): array
    {
        return array_merge([
            'product_name' => 'Orthopedic Bed',
            'image_url' => 'https://cdn.test/bed.webp',
            'retailer' => 'chewy',
            'highlight' => 'Best Value',
            'in_stock' => true,
            'price_display' => '$64.99',
            'price_cents' => 6499,
            'rating' => 4.7,
            'affiliate_url' => 'https://chewy.com/product/123',
            'pros' => ['comfy', 'washable'],
            'cons' => ['pricey'],
            'in_house_match_url' => null,
        ], $overrides);
    }

    public function test_type_defaults_to_article_when_not_provided(): void
    {
        $payload = $this->basePayload();
        unset($payload['type']);

        $response = $this->postJson('/api/admin/posts', $payload)->assertCreated();

        $this->assertSame(Post::TYPE_ARTICLE, $response->json('data.type'));
    }

    public function test_store_persists_type_and_comparison_items(): void
    {
        $payload = $this->basePayload([
            'type' => Post::TYPE_COMPARISON,
            'comparison_intro' => 'Here are our top picks.',
            'disclosure_shown' => true,
            'comparison_items' => [$this->comparisonItem()],
        ]);

        $response = $this->postJson('/api/admin/posts', $payload)->assertCreated();

        $this->assertSame(Post::TYPE_COMPARISON, $response->json('data.type'));
        $this->assertSame('Here are our top picks.', $response->json('data.comparison.intro'));
        $this->assertTrue($response->json('data.comparison.disclosure_shown'));
        $this->assertCount(1, $response->json('data.comparison.items'));
        $this->assertSame('Orthopedic Bed', $response->json('data.comparison.items.0.product_name'));
        $this->assertSame(4.7, $response->json('data.comparison.items.0.rating'));
        $this->assertSame(6499, $response->json('data.comparison.items.0.price_cents'));

        $post = Post::where('slug', 'best-orthopedic-dog-beds')->firstOrFail();
        $this->assertSame(Post::TYPE_COMPARISON, $post->type);
    }

    public function test_show_response_includes_comparison_data(): void
    {
        $post = Post::create([
            'blog_category_id' => $this->category->id,
            'title' => 'A Post', 'slug' => 'a-post', 'content' => '<p>x</p>',
            'status' => 'draft', 'type' => Post::TYPE_COMPARISON,
        ]);
        $post->setMeta('comparison_intro', 'Intro text');
        $post->setMeta('disclosure_shown', '1', 'bool');
        $post->setMeta('comparison_items', [$this->comparisonItem()], 'json');

        $this->getJson("/api/admin/posts/{$post->id}")
            ->assertOk()
            ->assertJsonPath('data.comparison.intro', 'Intro text')
            ->assertJsonPath('data.comparison.items.0.product_name', 'Orthopedic Bed');
    }

    public function test_update_overwrites_comparison_items(): void
    {
        $post = Post::create([
            'blog_category_id' => $this->category->id,
            'title' => 'A Post', 'slug' => 'a-post', 'content' => '<p>x</p>',
            'status' => 'draft', 'type' => Post::TYPE_COMPARISON,
        ]);
        $post->setMeta('comparison_items', [$this->comparisonItem(['product_name' => 'Old Item'])], 'json');

        $payload = $this->basePayload([
            'slug' => 'a-post',
            'type' => Post::TYPE_COMPARISON,
            'comparison_intro' => 'Updated intro',
            'disclosure_shown' => false,
            'comparison_items' => [$this->comparisonItem(['product_name' => 'New Item'])],
        ]);

        $response = $this->putJson("/api/admin/posts/{$post->id}", $payload)->assertOk();

        $this->assertCount(1, $response->json('data.comparison.items'));
        $this->assertSame('New Item', $response->json('data.comparison.items.0.product_name'));
        $this->assertFalse($response->json('data.comparison.disclosure_shown'));
    }

    public function test_article_type_post_does_not_require_comparison_fields(): void
    {
        $this->postJson('/api/admin/posts', $this->basePayload(['type' => Post::TYPE_ARTICLE]))
            ->assertCreated();
    }

    public function test_store_rejects_comparison_item_missing_product_name(): void
    {
        $payload = $this->basePayload([
            'type' => Post::TYPE_COMPARISON,
            'comparison_items' => [$this->comparisonItem(['product_name' => ''])],
        ]);

        $this->postJson('/api/admin/posts', $payload)
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['comparison_items.0.product_name']);
    }

    public function test_store_rejects_comparison_item_with_unknown_retailer_slug(): void
    {
        $payload = $this->basePayload([
            'type' => Post::TYPE_COMPARISON,
            'comparison_items' => [$this->comparisonItem(['retailer' => 'not-a-real-retailer'])],
        ]);

        $this->postJson('/api/admin/posts', $payload)
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['comparison_items.0.retailer']);
    }

    public function test_store_rejects_comparison_item_with_rating_out_of_range(): void
    {
        $payload = $this->basePayload([
            'type' => Post::TYPE_COMPARISON,
            'comparison_items' => [$this->comparisonItem(['rating' => 6])],
        ]);

        $this->postJson('/api/admin/posts', $payload)
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['comparison_items.0.rating']);
    }

    public function test_store_rejects_comparison_item_with_invalid_affiliate_url(): void
    {
        $payload = $this->basePayload([
            'type' => Post::TYPE_COMPARISON,
            'comparison_items' => [$this->comparisonItem(['affiliate_url' => 'not-a-url'])],
        ]);

        $this->postJson('/api/admin/posts', $payload)
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['comparison_items.0.affiliate_url']);
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && php artisan test --filter=PostControllerComparisonTest`
Expected: FAIL (route doesn't validate `type`/comparison fields yet; `type` isn't persisted from request).

- [ ] **Step 3: Read the current controller to get exact surrounding code**

Read `backend/app/Http/Controllers/Api/PostController.php` lines 1-117 before editing, to preserve `authorizeAdmin()`, imports, and untouched actions (`index`, `show`, `destroy`, `categories`) exactly as-is.

- [ ] **Step 4: Replace `store()` and `update()`, add private helpers**

Replace the existing `store(Request $request)` method (lines 52-77) and `update(Request $request, Post $post)` method (lines 86-107) with:

```php
    public function store(Request $request): JsonResponse
    {
        $this->authorizeAdmin();

        $validated = $request->validate($this->validationRules(forUpdate: false));
        $comparison = $this->extractComparisonData($validated);

        $post = Post::create($validated);

        if ($post->type === Post::TYPE_COMPARISON) {
            $this->syncComparisonMeta($post, $comparison);
        }

        return (new PostResource($post->fresh()))->response()->setStatusCode(201);
    }

    public function update(Request $request, Post $post): JsonResponse
    {
        $this->authorizeAdmin();

        $validated = $request->validate($this->validationRules(forUpdate: true));
        $comparison = $this->extractComparisonData($validated);

        $post->update($validated);

        if ($post->type === Post::TYPE_COMPARISON) {
            $this->syncComparisonMeta($post, $comparison);
        }

        return new PostResource($post->fresh());
    }

    protected function validationRules(bool $forUpdate): array
    {
        $slugRule = $forUpdate
            ? 'sometimes|required|string|max:255'
            : 'required|string|max:255';

        return [
            'blog_category_id' => 'required|exists:blog_categories,id',
            'title' => $forUpdate ? 'sometimes|required|string|max:255' : 'required|string|max:255',
            'slug' => $slugRule,
            'content' => $forUpdate ? 'sometimes|required|string' : 'required|string',
            'status' => 'nullable|in:draft,published,archived',
            'type' => 'nullable|in:'.implode(',', [Post::TYPE_ARTICLE, Post::TYPE_GUIDE, Post::TYPE_COMPARISON]),
            'featured_image_alt' => 'nullable|string|max:255',
            'featured_media_id' => 'nullable|exists:curator_media,id',
            'author' => 'nullable|string|max:255',
            'read_time' => 'nullable|integer|min:0',
            'published_at' => 'nullable|date',
            'comparison_intro' => 'nullable|string',
            'disclosure_shown' => 'nullable|boolean',
            'comparison_items' => 'nullable|array',
            'comparison_items.*.product_name' => 'required_with:comparison_items|string|max:255',
            'comparison_items.*.image_url' => 'nullable|string|max:2048',
            'comparison_items.*.retailer' => 'required_with:comparison_items|string|exists:affiliate_networks,slug',
            'comparison_items.*.highlight' => 'nullable|string|max:255',
            'comparison_items.*.in_stock' => 'nullable|boolean',
            'comparison_items.*.price_display' => 'nullable|string|max:64',
            'comparison_items.*.price_cents' => 'nullable|integer|min:0',
            'comparison_items.*.rating' => 'nullable|numeric|min:0|max:5',
            'comparison_items.*.affiliate_url' => 'required_with:comparison_items|url|max:2048',
            'comparison_items.*.pros' => 'nullable|array',
            'comparison_items.*.pros.*' => 'string|max:255',
            'comparison_items.*.cons' => 'nullable|array',
            'comparison_items.*.cons.*' => 'string|max:255',
            'comparison_items.*.in_house_match_url' => 'nullable|string|max:2048',
        ];
    }

    /**
     * Pull comparison-only fields out of the validated payload so they
     * aren't passed to Post::create()/update() (they aren't Post columns —
     * they're persisted separately via HasMetadata).
     */
    protected function extractComparisonData(array &$validated): array
    {
        $comparison = [
            'comparison_intro' => $validated['comparison_intro'] ?? null,
            'disclosure_shown' => $validated['disclosure_shown'] ?? true,
            'comparison_items' => $validated['comparison_items'] ?? [],
        ];

        unset($validated['comparison_intro'], $validated['disclosure_shown'], $validated['comparison_items']);

        return $comparison;
    }

    protected function syncComparisonMeta(Post $post, array $data): void
    {
        $post->setMeta('comparison_intro', $data['comparison_intro']);
        $post->setMeta('disclosure_shown', $data['disclosure_shown'] ? '1' : '0', 'bool');
        $post->setMeta('comparison_items', $data['comparison_items'], 'json');
    }
```

Also update the `store()` method to default `type` to `Post::TYPE_ARTICLE` when absent — insert this line right after `$validated = $request->validate(...)` in `store()` only:

```php
        $validated['type'] = $validated['type'] ?? Post::TYPE_ARTICLE;
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && php artisan test --filter=PostControllerComparisonTest`
Expected: PASS (9/9).

- [ ] **Step 6: Run the full existing Post test suite to check for regressions**

Run: `cd backend && php artisan test --filter=PostController`
Expected: PASS (all pre-existing `PostController*Test` files still green).

- [ ] **Step 7: Commit**

```bash
cd backend
git add app/Http/Controllers/Api/PostController.php tests/Feature/Api/Admin/PostControllerComparisonTest.php
git commit -m "feat(admin): validate and persist comparison items on posts"
```

---

### Task 2: Backend — `AffiliateNetworkController` (active retailers list)

**Files:**
- Create: `backend/app/Http/Controllers/Api/Admin/AffiliateNetworkController.php`
- Modify: `backend/routes/api.php` (admin group, after line 139)
- Test: `backend/tests/Feature/Api/Admin/AffiliateNetworkControllerTest.php` (create)

**Interfaces:**
- Consumes: `App\Models\AffiliateNetwork` (columns `name`, `slug`, `active`).
- Produces: `GET /api/admin/affiliate-networks` returning a bare JSON array `[{name, slug}, ...]`, filtered to `active = true`, ordered by `name`.

- [ ] **Step 1: Write the failing test**

```php
<?php

namespace Tests\Feature\Api\Admin;

use App\Models\AffiliateNetwork;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class AffiliateNetworkControllerTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Role::firstOrCreate(['name' => 'admin', 'guard_name' => 'web']);
        $user = User::factory()->create();
        $user->assignRole('admin');
        Sanctum::actingAs($user);
    }

    public function test_index_returns_only_active_networks(): void
    {
        AffiliateNetwork::create(['name' => 'Chewy', 'slug' => 'chewy', 'active' => true]);
        AffiliateNetwork::create(['name' => 'Retired Network', 'slug' => 'retired', 'active' => false]);

        $response = $this->getJson('/api/admin/affiliate-networks')->assertOk();

        $this->assertCount(1, $response->json());
        $this->assertSame('Chewy', $response->json('0.name'));
    }

    public function test_index_returns_bare_array_not_wrapped_in_data(): void
    {
        AffiliateNetwork::create(['name' => 'Chewy', 'slug' => 'chewy', 'active' => true]);

        $response = $this->getJson('/api/admin/affiliate-networks')->assertOk();

        $this->assertIsArray($response->json());
        $this->assertArrayNotHasKey('data', $response->json());
    }

    public function test_index_only_returns_name_and_slug(): void
    {
        AffiliateNetwork::create(['name' => 'Chewy', 'slug' => 'chewy', 'active' => true, 'api_key' => 'secret']);

        $response = $this->getJson('/api/admin/affiliate-networks')->assertOk();

        $this->assertSame(['name', 'slug'], array_keys($response->json('0')));
    }

    public function test_index_requires_authentication(): void
    {
        Sanctum::actingAs(new User());
        $this->withoutMiddleware();

        $this->assertTrue(true);
    }
}
```

Note on Step 1's 4th test: authentication/authorization is already covered globally by every other admin endpoint's route middleware and is not meaningfully re-testable per-endpoint without duplicating framework-level route tests; replace it with a simpler ordering test instead:

```php
    public function test_index_orders_by_name(): void
    {
        AffiliateNetwork::create(['name' => 'Walmart', 'slug' => 'walmart', 'active' => true]);
        AffiliateNetwork::create(['name' => 'Amazon', 'slug' => 'amazon', 'active' => true]);

        $response = $this->getJson('/api/admin/affiliate-networks')->assertOk();

        $this->assertSame(['Amazon', 'Walmart'], array_column($response->json(), 'name'));
    }
```

Use this `test_index_orders_by_name` test in place of `test_index_requires_authentication` in the final file.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && php artisan test --filter=AffiliateNetworkControllerTest`
Expected: FAIL with a 404 (route doesn't exist yet).

- [ ] **Step 3: Create the controller**

```php
<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\AffiliateNetwork;
use Illuminate\Http\JsonResponse;

class AffiliateNetworkController extends Controller
{
    public function index(): JsonResponse
    {
        $networks = AffiliateNetwork::where('active', true)
            ->orderBy('name')
            ->get(['name', 'slug']);

        return response()->json($networks);
    }
}
```

- [ ] **Step 4: Add the route**

In `backend/routes/api.php`, inside the admin group (after the `Route::post('/media', ...)` line, before the closing `});` at line 140), add:

```php
    Route::get('/affiliate-networks', [\App\Http\Controllers\Api\Admin\AffiliateNetworkController::class, 'index']);
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd backend && php artisan test --filter=AffiliateNetworkControllerTest`
Expected: PASS (4/4).

- [ ] **Step 6: Commit**

```bash
cd backend
git add app/Http/Controllers/Api/Admin/AffiliateNetworkController.php routes/api.php tests/Feature/Api/Admin/AffiliateNetworkControllerTest.php
git commit -m "feat(admin): add active affiliate networks endpoint"
```

---

### Task 3: Backend — `ImageOptimizer` + `MediaController` rewire

**Files:**
- Create: `backend/app/Support/ImageOptimizer.php`
- Modify: `backend/app/Http/Controllers/Api/Admin/MediaController.php` (`store()`, lines 20-49)
- Test: `backend/tests/Feature/Support/ImageOptimizerTest.php` (create)
- Test: `backend/tests/Feature/Api/Admin/MediaControllerTest.php` (extend)

**Interfaces:**
- Consumes: none beyond GD extension + Laravel's `Storage` facade.
- Produces: `App\Support\ImageOptimizer::optimize(string $disk, string $path, int $maxWidth = 1920, int $maxHeight = 1920): string` — static method, returns the (possibly new) relative path on the same disk. Used by `MediaController::store()`.

- [ ] **Step 1: Read `ImageUploadResizer.php` for the exact source algorithm**

Read `backend/app/Support/ImageUploadResizer.php` in full before writing `ImageOptimizer` — the resize math (`imagecopyresampled`), WebP quality (85), and the animated-GIF detection heuristic (`substr_count($raw, "\x00\x21\xF9\x04") > 1`) must match exactly.

- [ ] **Step 2: Write the failing unit test**

```php
<?php

namespace Tests\Feature\Support;

use App\Support\ImageOptimizer;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class ImageOptimizerTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('public');
    }

    protected function putJpegFixture(string $path, int $width, int $height): void
    {
        $image = imagecreatetruecolor($width, $height);
        imagefill($image, 0, 0, imagecolorallocate($image, 100, 150, 200));
        ob_start();
        imagejpeg($image, null, 90);
        $contents = ob_get_clean();
        imagedestroy($image);

        Storage::disk('public')->put($path, $contents);
    }

    protected function putGifFixture(string $path, int $width, int $height, bool $animated): void
    {
        $image = imagecreatetruecolor($width, $height);
        imagefill($image, 0, 0, imagecolorallocate($image, 200, 100, 50));
        ob_start();
        imagegif($image);
        $contents = ob_get_clean();
        imagedestroy($image);

        if ($animated) {
            // ImageOptimizer's animated-GIF branch only needs >=2 occurrences of
            // this 4-byte Graphic Control Extension marker anywhere in the file
            // (getimagesize() only reads the leading Logical Screen Descriptor,
            // and GD's decoder stops at the GIF trailer 0x3B, so appended bytes
            // are safely ignored by both).
            $marker = "\x00\x21\xF9\x04";
            $contents .= $marker.str_repeat("\x00", 4).$marker.str_repeat("\x00", 4);
        }

        Storage::disk('public')->put($path, $contents);
    }

    public function test_undersized_jpeg_is_converted_to_webp_without_resizing(): void
    {
        $this->putJpegFixture('uploads/small.jpg', 400, 300);

        $resultPath = ImageOptimizer::optimize('public', 'uploads/small.jpg');

        $this->assertStringEndsWith('.webp', $resultPath);
        $this->assertTrue(Storage::disk('public')->exists($resultPath));
        [$width, $height] = getimagesize(Storage::disk('public')->path($resultPath));
        $this->assertSame(400, $width);
        $this->assertSame(300, $height);
    }

    public function test_oversized_jpeg_is_resized_and_converted_to_webp(): void
    {
        $this->putJpegFixture('uploads/big.jpg', 3000, 2000);

        $resultPath = ImageOptimizer::optimize('public', 'uploads/big.jpg', 1920, 1920);

        $this->assertStringEndsWith('.webp', $resultPath);
        [$width, $height] = getimagesize(Storage::disk('public')->path($resultPath));
        $this->assertLessThanOrEqual(1920, $width);
        $this->assertLessThanOrEqual(1920, $height);
    }

    public function test_uploading_an_animated_gif_is_preserved_as_gif(): void
    {
        $this->putGifFixture('uploads/anim.gif', 400, 300, animated: true);

        $resultPath = ImageOptimizer::optimize('public', 'uploads/anim.gif');

        $this->assertStringEndsWith('.gif', $resultPath);
        $this->assertSame('uploads/anim.gif', $resultPath);
    }

    public function test_oversized_animated_gif_is_resized_but_stays_gif(): void
    {
        $this->putGifFixture('uploads/anim-big.gif', 3000, 2000, animated: true);

        $resultPath = ImageOptimizer::optimize('public', 'uploads/anim-big.gif', 1920, 1920);

        $this->assertStringEndsWith('.gif', $resultPath);
        [$width, $height] = getimagesize(Storage::disk('public')->path($resultPath));
        $this->assertLessThanOrEqual(1920, $width);
        $this->assertLessThanOrEqual(1920, $height);
    }

    public function test_static_gif_is_converted_to_webp(): void
    {
        $this->putGifFixture('uploads/static.gif', 400, 300, animated: false);

        $resultPath = ImageOptimizer::optimize('public', 'uploads/static.gif');

        $this->assertStringEndsWith('.webp', $resultPath);
    }
}
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd backend && php artisan test --filter=ImageOptimizerTest`
Expected: FAIL with "Class App\Support\ImageOptimizer not found".

- [ ] **Step 4: Write `ImageOptimizer`**

```php
<?php

namespace App\Support;

use Illuminate\Support\Facades\Storage;

class ImageOptimizer
{
    /**
     * Resize an already-stored image to fit within max dimensions and
     * convert it to WebP, unless it's an animated GIF (which is resized
     * in place but kept as GIF to preserve animation). Returns the
     * relative path of the resulting file on the same disk.
     */
    public static function optimize(string $disk, string $path, int $maxWidth = 1920, int $maxHeight = 1920): string
    {
        $storage = Storage::disk($disk);
        $fullPath = $storage->path($path);

        [$width, $height, $imageType] = getimagesize($fullPath);
        $withinBounds = $width <= $maxWidth && $height <= $maxHeight;

        $isAnimatedGif = $imageType === IMAGETYPE_GIF && self::isAnimatedGif(file_get_contents($fullPath));

        if ($isAnimatedGif && $withinBounds) {
            return $path;
        }

        $source = match ($imageType) {
            IMAGETYPE_JPEG => imagecreatefromjpeg($fullPath),
            IMAGETYPE_PNG => imagecreatefrompng($fullPath),
            IMAGETYPE_GIF => imagecreatefromgif($fullPath),
            IMAGETYPE_WEBP => imagecreatefromwebp($fullPath),
            default => imagecreatefromstring(file_get_contents($fullPath)),
        };

        if ($withinBounds) {
            $targetWidth = $width;
            $targetHeight = $height;
        } else {
            $ratio = min($maxWidth / $width, $maxHeight / $height);
            $targetWidth = (int) round($width * $ratio);
            $targetHeight = (int) round($height * $ratio);
        }

        $resized = imagecreatetruecolor($targetWidth, $targetHeight);

        if ($imageType === IMAGETYPE_PNG || $imageType === IMAGETYPE_GIF) {
            imagecolortransparent($resized, imagecolorallocatealpha($resized, 0, 0, 0, 127));
            imagealphablending($resized, false);
            imagesavealpha($resized, true);
        }

        imagecopyresampled($resized, $source, 0, 0, 0, 0, $targetWidth, $targetHeight, $width, $height);
        imagedestroy($source);

        $pathInfo = pathinfo($path);
        $baseName = $pathInfo['filename'];
        $directory = $pathInfo['dirname'] === '.' ? '' : $pathInfo['dirname'].'/';

        if ($isAnimatedGif) {
            $newPath = $directory.$baseName.'.gif';
            ob_start();
            imagegif($resized);
            $contents = ob_get_clean();
        } else {
            $newPath = $directory.$baseName.'.webp';
            ob_start();
            imagewebp($resized, null, 85);
            $contents = ob_get_clean();
        }

        imagedestroy($resized);

        $storage->put($newPath, $contents);

        if ($newPath !== $path) {
            $storage->delete($path);
        }

        return $newPath;
    }

    protected static function isAnimatedGif(string $raw): bool
    {
        return substr_count($raw, "\x00\x21\xF9\x04") > 1;
    }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && php artisan test --filter=ImageOptimizerTest`
Expected: PASS (5/5).

- [ ] **Step 6: Read `MediaController.php` and extend its test file**

Read `backend/app/Http/Controllers/Api/Admin/MediaController.php` in full (51 lines) and `backend/tests/Feature/Api/Admin/MediaControllerTest.php` in full (71 lines) before editing, to match exact existing test setup (`setUp()`, disk faking, request shape).

Add these two methods to `MediaControllerTest.php` (inside the existing class, using its existing `setUp()`):

```php
    public function test_uploading_a_jpeg_is_converted_to_webp(): void
    {
        $image = imagecreatetruecolor(400, 300);
        imagefill($image, 0, 0, imagecolorallocate($image, 100, 150, 200));
        ob_start();
        imagejpeg($image, null, 90);
        $contents = ob_get_clean();
        imagedestroy($image);

        $file = \Illuminate\Http\UploadedFile::fake()->createWithContent('photo.jpg', $contents);

        $response = $this->postJson('/api/admin/media', ['file' => $file])->assertCreated();

        $this->assertStringEndsWith('.webp', $response->json('data.url'));
    }

    public function test_uploading_an_animated_gif_is_preserved_as_gif(): void
    {
        $image = imagecreatetruecolor(400, 300);
        imagefill($image, 0, 0, imagecolorallocate($image, 200, 100, 50));
        ob_start();
        imagegif($image);
        $contents = ob_get_clean();
        imagedestroy($image);

        $marker = "\x00\x21\xF9\x04";
        $contents .= $marker.str_repeat("\x00", 4).$marker.str_repeat("\x00", 4);

        $file = \Illuminate\Http\UploadedFile::fake()->createWithContent('animated.gif', $contents);

        $response = $this->postJson('/api/admin/media', ['file' => $file])->assertCreated();

        $this->assertStringEndsWith('.gif', $response->json('data.url'));
    }
```

- [ ] **Step 7: Run new `MediaController` tests to verify they fail**

Run: `cd backend && php artisan test --filter=MediaControllerTest`
Expected: The two new tests FAIL (upload isn't optimized yet); pre-existing tests still PASS.

- [ ] **Step 8: Rewire `MediaController::store()` to call `ImageOptimizer`**

In `store()`, after the file is stored to disk (using whatever variable name the existing code uses for the stored path — confirm exact variable name from the Step 6 read) and before building the `CuratorMedia` record / response, insert:

```php
        $storedPath = \App\Support\ImageOptimizer::optimize('public', $storedPath);
```

(`$storedPath` here refers to the actual path variable already present in the method — substitute the real variable name found in Step 6 if different, then ensure the same variable is used for both the `CuratorMedia` creation and the response so both reflect the optimized path.)

- [ ] **Step 9: Run tests to verify they pass**

Run: `cd backend && php artisan test --filter=MediaControllerTest`
Expected: PASS (all, including the 2 new tests).

- [ ] **Step 10: Commit**

```bash
cd backend
git add app/Support/ImageOptimizer.php app/Http/Controllers/Api/Admin/MediaController.php tests/Feature/Support/ImageOptimizerTest.php tests/Feature/Api/Admin/MediaControllerTest.php
git commit -m "feat(admin): optimize uploaded images to webp, preserve animated gifs"
```

---

### Task 4: Frontend — `postSchema.ts` comparison validation

**Files:**
- Modify: `admin/src/features/posts/postSchema.ts` (full rewrite, currently 16 lines)
- Test: `admin/src/features/posts/postSchema.test.ts` (extend, currently 57 lines)

**Interfaces:**
- Consumes: nothing new.
- Produces: `getPostFormSchema(t: TranslationFunction) => ZodObject`, `PostFormValues = z.infer<ReturnType<typeof getPostFormSchema>>`, and a nested `ComparisonItemValues` type — both names are relied on by Task 7 and Task 8.

- [ ] **Step 1: Read the current file in full**

Read `admin/src/features/posts/postSchema.ts` (16 lines) to confirm the exact current factory signature and existing field validators before rewriting.

- [ ] **Step 2: Write the failing tests**

Append to `admin/src/features/posts/postSchema.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { getPostFormSchema } from './postSchema';

const t = (key: string) => key;

describe('getPostFormSchema — comparison fields', () => {
  const baseValues = {
    blog_category_id: '1',
    title: 'Best Beds',
    slug: 'best-beds',
    content: '<p>x</p>',
    status: 'draft' as const,
    type: 'comparison' as const,
  };

  const validItem = {
    product_name: 'Orthopedic Bed',
    image_url: null,
    retailer: 'chewy',
    highlight: '',
    in_stock: true,
    price_display: '$64.99',
    price_cents: 6499,
    rating: 4.7,
    affiliate_url: 'https://chewy.com/p/1',
    pros: ['comfy'],
    cons: ['pricey'],
    in_house_match_url: '',
  };

  it('accepts a valid comparison payload', () => {
    const schema = getPostFormSchema(t);
    const result = schema.safeParse({
      ...baseValues,
      comparison_intro: 'Top picks',
      disclosure_shown: true,
      comparison_items: [validItem],
    });
    expect(result.success).toBe(true);
  });

  it('rejects a comparison item missing product_name', () => {
    const schema = getPostFormSchema(t);
    const result = schema.safeParse({
      ...baseValues,
      comparison_items: [{ ...validItem, product_name: '' }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects a comparison item with an invalid affiliate_url', () => {
    const schema = getPostFormSchema(t);
    const result = schema.safeParse({
      ...baseValues,
      comparison_items: [{ ...validItem, affiliate_url: 'not-a-url' }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects a rating above 5', () => {
    const schema = getPostFormSchema(t);
    const result = schema.safeParse({
      ...baseValues,
      comparison_items: [{ ...validItem, rating: 6 }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects a rating below 0', () => {
    const schema = getPostFormSchema(t);
    const result = schema.safeParse({
      ...baseValues,
      comparison_items: [{ ...validItem, rating: -1 }],
    });
    expect(result.success).toBe(false);
  });

  it('treats an empty-string rating as undefined (not zero)', () => {
    const schema = getPostFormSchema(t);
    const result = schema.safeParse({
      ...baseValues,
      comparison_items: [{ ...validItem, rating: '' }],
    });
    expect(result.success).toBe(true);
  });

  it('treats an empty-string highlight as undefined', () => {
    const schema = getPostFormSchema(t);
    const result = schema.safeParse({
      ...baseValues,
      comparison_items: [{ ...validItem, highlight: '' }],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.comparison_items?.[0].highlight).toBeUndefined();
    }
  });

  it('allows article type posts without any comparison fields', () => {
    const schema = getPostFormSchema(t);
    const result = schema.safeParse({
      ...baseValues,
      type: 'article',
      comparison_items: undefined,
    });
    expect(result.success).toBe(true);
  });

  it('rejects comparison_items with an empty pros/cons array item', () => {
    const schema = getPostFormSchema(t);
    const result = schema.safeParse({
      ...baseValues,
      comparison_items: [{ ...validItem, pros: [''] }],
    });
    expect(result.success).toBe(false);
  });

  it('accepts comparison_items with empty pros/cons arrays', () => {
    const schema = getPostFormSchema(t);
    const result = schema.safeParse({
      ...baseValues,
      comparison_items: [{ ...validItem, pros: [], cons: [] }],
    });
    expect(result.success).toBe(true);
  });

  it('rejects price_cents as a negative number', () => {
    const schema = getPostFormSchema(t);
    const result = schema.safeParse({
      ...baseValues,
      comparison_items: [{ ...validItem, price_cents: -100 }],
    });
    expect(result.success).toBe(false);
  });

  it('allows in_house_match_url to be an empty string', () => {
    const schema = getPostFormSchema(t);
    const result = schema.safeParse({
      ...baseValues,
      comparison_items: [{ ...validItem, in_house_match_url: '' }],
    });
    expect(result.success).toBe(true);
  });

  it('rejects an invalid in_house_match_url', () => {
    const schema = getPostFormSchema(t);
    const result = schema.safeParse({
      ...baseValues,
      comparison_items: [{ ...validItem, in_house_match_url: 'not-a-url' }],
    });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd admin && npx vitest run src/features/posts/postSchema.test.ts`
Expected: FAIL (schema doesn't recognize `type`/`comparison_*` fields yet).

- [ ] **Step 4: Rewrite `postSchema.ts`**

Replace the full file content with:

```typescript
import { z } from 'zod';

type TranslationFunction = (key: string) => string;

const comparisonItemSchema = (t: TranslationFunction) =>
  z.object({
    product_name: z.string().min(1, t('posts.comparison.errors.product_name_required')),
    image_url: z.string().nullable().optional(),
    retailer: z.string().min(1, t('posts.comparison.errors.retailer_required')),
    highlight: z.preprocess(
      (val) => (val === '' ? undefined : val),
      z.string().max(255).optional()
    ),
    in_stock: z.boolean().optional(),
    price_display: z.string().max(64).optional(),
    price_cents: z.preprocess(
      (val) => (val === '' || val === undefined ? undefined : Number(val)),
      z.number().int().min(0).optional()
    ),
    rating: z.preprocess(
      (val) => (val === '' || val === undefined || val === null ? undefined : Number(val)),
      z.number().min(0).max(5).optional()
    ),
    affiliate_url: z.string().url(t('posts.comparison.errors.affiliate_url_invalid')),
    pros: z.array(z.string().min(1, t('posts.comparison.errors.list_item_required'))).optional(),
    cons: z.array(z.string().min(1, t('posts.comparison.errors.list_item_required'))).optional(),
    in_house_match_url: z.preprocess(
      (val) => (val === '' ? undefined : val),
      z.string().url(t('posts.comparison.errors.match_url_invalid')).optional()
    ),
  });

export type ComparisonItemValues = z.infer<ReturnType<typeof comparisonItemSchema>>;

export const getPostFormSchema = (t: TranslationFunction) =>
  z.object({
    blog_category_id: z.string().min(1, t('posts.errors.category_required')),
    title: z.string().min(1, t('posts.errors.title_required')),
    slug: z.string().min(1, t('posts.errors.slug_required')),
    content: z.string().min(1, t('posts.errors.content_required')),
    status: z.enum(['draft', 'published', 'archived']),
    type: z.enum(['article', 'guide', 'comparison']).default('article'),
    featured_image_alt: z.string().optional(),
    featured_media_id: z.string().nullable().optional(),
    author: z.string().optional(),
    read_time: z.preprocess(
      (val) => (val === '' || val === undefined ? undefined : Number(val)),
      z.number().int().min(0).optional()
    ),
    published_at: z.string().nullable().optional(),
    comparison_intro: z.string().optional(),
    disclosure_shown: z.boolean().optional(),
    comparison_items: z.array(comparisonItemSchema(t)).optional(),
  });

export type PostFormValues = z.infer<ReturnType<typeof getPostFormSchema>>;
```

Note: if the Step 1 read reveals additional pre-existing fields (e.g. `tags`, `seo`) not listed above, add them back unchanged from the original file — this rewrite must be a strict superset of the current schema, not a narrower replacement. Preserve every field the current file validates.

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd admin && npx vitest run src/features/posts/postSchema.test.ts`
Expected: PASS (all, including pre-existing tests).

- [ ] **Step 6: Commit**

```bash
cd admin
git add src/features/posts/postSchema.ts src/features/posts/postSchema.test.ts
git commit -m "feat(admin): add comparison item validation to post form schema"
```

---

### Task 5: Frontend — `postsApi.ts` affiliate networks hook

**Files:**
- Modify: `admin/src/features/posts/postsApi.ts` (extend, currently 62 lines)
- Test: `admin/src/features/posts/postsApi.test.ts` (extend, currently 19 lines)

**Interfaces:**
- Consumes: `admin/src/lib/api.ts`'s `fetchJson<T>(url: string): Promise<T>` (confirm exact export name/signature by reading `admin/src/lib/api.ts` in Step 1).
- Produces: `AffiliateNetwork = { name: string; slug: string }`, `useAffiliateNetworks(): UseQueryResult<AffiliateNetwork[]>` — consumed by Task 7/8.

- [ ] **Step 1: Read the current files in full**

Read `admin/src/features/posts/postsApi.ts` (62 lines) and `admin/src/lib/api.ts` to confirm the exact existing `useQuery` pattern (query key style, `fetchJson` import path/signature) used by sibling hooks in this file.

- [ ] **Step 2: Write the failing test**

Append to `admin/src/features/posts/postsApi.test.ts`:

```typescript
import { describe, expect, it, vi } from 'vitest';
import { extractAffiliateNetworks } from './postsApi';

describe('extractAffiliateNetworks', () => {
  it('returns the array as-is when given a bare array', () => {
    const input = [{ name: 'Chewy', slug: 'chewy' }];
    expect(extractAffiliateNetworks(input)).toEqual(input);
  });

  it('returns an empty array for null/undefined input', () => {
    expect(extractAffiliateNetworks(undefined)).toEqual([]);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd admin && npx vitest run src/features/posts/postsApi.test.ts`
Expected: FAIL ("extractAffiliateNetworks is not exported").

- [ ] **Step 4: Add to `postsApi.ts`**

Append to the end of the file (after confirming the exact existing `fetchJson` import in Step 1 — reuse it rather than re-importing):

```typescript
export interface AffiliateNetwork {
  name: string;
  slug: string;
}

export function extractAffiliateNetworks(input: AffiliateNetwork[] | undefined | null): AffiliateNetwork[] {
  return input ?? [];
}

export function useAffiliateNetworks() {
  return useQuery({
    queryKey: ['affiliate-networks'],
    queryFn: async () => extractAffiliateNetworks(await fetchJson<AffiliateNetwork[]>('/admin/affiliate-networks')),
  });
}
```

(If Step 1's read shows `useQuery` is imported under a different alias, or `fetchJson` takes a differently-shaped base path (e.g. requires a leading `/api` or full URL), adjust to match exactly what sibling hooks in this file do — do not introduce a second calling convention.)

- [ ] **Step 5: Run test to verify it passes**

Run: `cd admin && npx vitest run src/features/posts/postsApi.test.ts`
Expected: PASS (all).

- [ ] **Step 6: Commit**

```bash
cd admin
git add src/features/posts/postsApi.ts src/features/posts/postsApi.test.ts
git commit -m "feat(admin): add useAffiliateNetworks hook"
```

---

### Task 6: Frontend — `TagInput` component

**Files:**
- Create: `admin/src/components/ui/tag-input.tsx`

**Interfaces:**
- Consumes: `admin/src/components/ui/input.tsx`'s exported `Input` component and its `clsx`/`forwardRef` conventions (confirm exact export shape by reading in Step 1).
- Produces: `TagInput({ value: string[], onChange: (tags: string[]) => void, placeholder?: string }): JSX.Element` — consumed by Task 7 via `Controller`.

- [ ] **Step 1: Read existing UI primitives for conventions**

Read `admin/src/components/ui/input.tsx` and `admin/src/components/ui/button.tsx` in full to confirm the exact `forwardRef`/`clsx`/className conventions to match.

- [ ] **Step 2: Write the component**

```tsx
import { useState, type KeyboardEvent } from 'react';
import clsx from 'clsx';

interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
}

export function TagInput({ value, onChange, placeholder }: TagInputProps) {
  const [draft, setDraft] = useState('');

  const addTag = () => {
    const trimmed = draft.trim();
    if (trimmed.length === 0) return;
    if (value.includes(trimmed)) {
      setDraft('');
      return;
    }
    onChange([...value, trimmed]);
    setDraft('');
  };

  const removeTag = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      addTag();
      return;
    }
    if (event.key === 'Backspace' && draft.length === 0 && value.length > 0) {
      removeTag(value.length - 1);
    }
  };

  return (
    <div
      className={clsx(
        'flex flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-2 py-1.5',
        'focus-within:ring-1 focus-within:ring-ring'
      )}
    >
      {value.map((tag, index) => (
        <span
          key={`${tag}-${index}`}
          className="flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-sm"
        >
          {tag}
          <button
            type="button"
            onClick={() => removeTag(index)}
            className="text-muted-foreground hover:text-foreground"
            aria-label={`Remove ${tag}`}
          >
            ×
          </button>
        </span>
      ))}
      <input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={addTag}
        placeholder={value.length === 0 ? placeholder : undefined}
        className="min-w-[100px] flex-1 border-0 bg-transparent p-0 text-sm outline-none focus:ring-0"
      />
    </div>
  );
}
```

(If Step 1's read shows the project uses a different className merge utility than bare `clsx` — e.g. a local `cn()` helper wrapping `clsx`+`tailwind-merge` — use that helper instead, matching `input.tsx`'s exact import.)

- [ ] **Step 3: Verify it compiles**

Run: `cd admin && npx tsc --noEmit`
Expected: No new type errors introduced by this file.

- [ ] **Step 4: Commit**

```bash
cd admin
git add src/components/ui/tag-input.tsx
git commit -m "feat(admin): add TagInput component for pros/cons entry"
```

---

### Task 7: Frontend — `ComparisonItemRepeater` + `ComparisonDetailsSection`

**Files:**
- Create: `admin/src/features/posts/ComparisonItemRepeater.tsx`
- Create: `admin/src/features/posts/ComparisonDetailsSection.tsx`

**Interfaces:**
- Consumes: `PostFormValues`/`ComparisonItemValues` from `./postSchema` (Task 4), `AffiliateNetwork` from `./postsApi` (Task 5), `TagInput` from `../../components/ui/tag-input` (Task 6), `MediaPicker` from `../media/MediaPicker` (existing, prop shape `{value: {id, url} | null, onChange: (media: {id, url} | null) => void}` — confirmed in prior research), `Card`/`Input`/`Textarea`/`Button` from `../../components/ui/*` (existing).
- Produces: `ComparisonDetailsSection({ control, register, affiliateNetworks }: { control: Control<PostFormValues>; register: UseFormRegister<PostFormValues>; affiliateNetworks: AffiliateNetwork[] }): JSX.Element` — consumed by Task 8's `PostFormPage.tsx`.

- [ ] **Step 1: Re-read supporting files for exact current prop shapes**

Read `admin/src/features/media/MediaPicker.tsx` (87 lines) and `admin/src/components/ui/card.tsx` in full immediately before writing, to confirm exact prop names haven't changed since earlier research in this session.

- [ ] **Step 2: Write `ComparisonItemRepeater.tsx`**

```tsx
import { Controller, useFieldArray, useWatch, type Control, type UseFormRegister } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import type { PostFormValues } from './postSchema';
import type { AffiliateNetwork } from './postsApi';
import { MediaPicker } from '../media/MediaPicker';
import { TagInput } from '../../components/ui/tag-input';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { Button } from '../../components/ui/button';

interface ComparisonItemRepeaterProps {
  control: Control<PostFormValues>;
  register: UseFormRegister<PostFormValues>;
  affiliateNetworks: AffiliateNetwork[];
}

function RowSummary({ control, index }: { control: Control<PostFormValues>; index: number }) {
  const { t } = useTranslation();
  const productName = useWatch({ control, name: `comparison_items.${index}.product_name` });
  const priceDisplay = useWatch({ control, name: `comparison_items.${index}.price_display` });
  const retailer = useWatch({ control, name: `comparison_items.${index}.retailer` });

  return (
    <span className="text-sm text-muted-foreground">
      {productName || t('posts.comparison.untitled_item')}
      {retailer ? ` — ${retailer}` : ''}
      {priceDisplay ? ` — ${priceDisplay}` : ''}
    </span>
  );
}

export function ComparisonItemRepeater({ control, register, affiliateNetworks }: ComparisonItemRepeaterProps) {
  const { t } = useTranslation();
  const { fields, append, remove } = useFieldArray({ control, name: 'comparison_items' });
  const [expandedIndex, setExpandedIndex] = useState<number | null>(fields.length === 0 ? null : 0);

  return (
    <div className="space-y-3">
      {fields.map((field, index) => {
        const isExpanded = expandedIndex === index;
        return (
          <div key={field.id} className="rounded-md border border-input">
            <div className="flex items-center justify-between gap-2 px-3 py-2">
              <button
                type="button"
                onClick={() => setExpandedIndex(isExpanded ? null : index)}
                className="flex flex-1 items-center gap-2 text-left"
              >
                <span className="font-medium">{t('posts.comparison.item_label', { defaultValue: 'Item' })} {index + 1}</span>
                <RowSummary control={control} index={index} />
              </button>
              <Button type="button" variant="ghost" size="sm" onClick={() => remove(index)}>
                {t('posts.comparison.remove_item')}
              </Button>
            </div>

            {isExpanded && (
              <div className="space-y-3 border-t border-input p-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium">{t('posts.comparison.product_name')}</label>
                    <Input {...register(`comparison_items.${index}.product_name`)} />
                  </div>
                  <div>
                    <label className="text-sm font-medium">{t('posts.comparison.retailer')}</label>
                    <select
                      {...register(`comparison_items.${index}.retailer`)}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="">{t('posts.comparison.select_retailer')}</option>
                      {affiliateNetworks.map((network) => (
                        <option key={network.slug} value={network.slug}>
                          {network.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium">{t('posts.comparison.image')}</label>
                  <Controller
                    control={control}
                    name={`comparison_items.${index}.image_url`}
                    render={({ field: imageField }) => (
                      <MediaPicker
                        value={imageField.value ? { id: '', url: imageField.value } : null}
                        onChange={(media) => imageField.onChange(media?.url ?? null)}
                      />
                    )}
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-sm font-medium">{t('posts.comparison.highlight')}</label>
                    <Input {...register(`comparison_items.${index}.highlight`)} />
                  </div>
                  <div>
                    <label className="text-sm font-medium">{t('posts.comparison.price_display')}</label>
                    <Input {...register(`comparison_items.${index}.price_display`)} placeholder="$64.99" />
                  </div>
                  <div>
                    <label className="text-sm font-medium">{t('posts.comparison.price_cents')}</label>
                    <Input type="number" {...register(`comparison_items.${index}.price_cents`)} />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-sm font-medium">{t('posts.comparison.rating')}</label>
                    <Input type="number" step="0.1" min="0" max="5" {...register(`comparison_items.${index}.rating`)} />
                  </div>
                  <div className="flex items-center gap-2 pt-6">
                    <input type="checkbox" {...register(`comparison_items.${index}.in_stock`)} id={`in_stock_${index}`} />
                    <label htmlFor={`in_stock_${index}`} className="text-sm font-medium">
                      {t('posts.comparison.in_stock')}
                    </label>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium">{t('posts.comparison.affiliate_url')}</label>
                  <Input {...register(`comparison_items.${index}.affiliate_url`)} placeholder="https://..." />
                </div>

                <div>
                  <label className="text-sm font-medium">{t('posts.comparison.in_house_match_url')}</label>
                  <Input {...register(`comparison_items.${index}.in_house_match_url`)} placeholder="https://..." />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium">{t('posts.comparison.pros')}</label>
                    <Controller
                      control={control}
                      name={`comparison_items.${index}.pros`}
                      render={({ field: prosField }) => (
                        <TagInput value={prosField.value ?? []} onChange={prosField.onChange} placeholder={t('posts.comparison.add_pro')} />
                      )}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">{t('posts.comparison.cons')}</label>
                    <Controller
                      control={control}
                      name={`comparison_items.${index}.cons`}
                      render={({ field: consField }) => (
                        <TagInput value={consField.value ?? []} onChange={consField.onChange} placeholder={t('posts.comparison.add_con')} />
                      )}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}

      <Button
        type="button"
        variant="outline"
        onClick={() => {
          append({
            product_name: '',
            image_url: null,
            retailer: '',
            highlight: '',
            in_stock: true,
            price_display: '',
            price_cents: undefined,
            rating: undefined,
            affiliate_url: '',
            pros: [],
            cons: [],
            in_house_match_url: '',
          });
          setExpandedIndex(fields.length);
        }}
      >
        {t('posts.comparison.add_item')}
      </Button>
    </div>
  );
}
```

- [ ] **Step 3: Write `ComparisonDetailsSection.tsx`**

```tsx
import type { Control, UseFormRegister } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { PostFormValues } from './postSchema';
import type { AffiliateNetwork } from './postsApi';
import { ComparisonItemRepeater } from './ComparisonItemRepeater';
import { Card } from '../../components/ui/card';
import { Textarea } from '../../components/ui/textarea';

interface ComparisonDetailsSectionProps {
  control: Control<PostFormValues>;
  register: UseFormRegister<PostFormValues>;
  affiliateNetworks: AffiliateNetwork[];
}

export function ComparisonDetailsSection({ control, register, affiliateNetworks }: ComparisonDetailsSectionProps) {
  const { t } = useTranslation();

  return (
    <Card className="space-y-4 p-4">
      <h3 className="text-lg font-semibold">{t('posts.comparison.section_title')}</h3>

      <div>
        <label className="text-sm font-medium">{t('posts.comparison.intro')}</label>
        <Textarea {...register('comparison_intro')} rows={3} />
      </div>

      <div className="flex items-center gap-2">
        <input type="checkbox" {...register('disclosure_shown')} id="disclosure_shown" defaultChecked />
        <label htmlFor="disclosure_shown" className="text-sm font-medium">
          {t('posts.comparison.disclosure_shown')}
        </label>
      </div>

      <div>
        <h4 className="text-sm font-semibold">{t('posts.comparison.items_title')}</h4>
        <ComparisonItemRepeater control={control} register={register} affiliateNetworks={affiliateNetworks} />
      </div>
    </Card>
  );
}
```

- [ ] **Step 4: Verify it compiles**

Run: `cd admin && npx tsc --noEmit`
Expected: No new type errors from these two files (fix any prop-name mismatches against the Step 1 confirmed shapes of `MediaPicker`/`Card`/`Textarea` before proceeding).

- [ ] **Step 5: Commit**

```bash
cd admin
git add src/features/posts/ComparisonItemRepeater.tsx src/features/posts/ComparisonDetailsSection.tsx
git commit -m "feat(admin): add comparison item repeater UI"
```

---

### Task 8: Frontend — wire `PostFormPage.tsx` + i18n keys

**Files:**
- Modify: `admin/src/features/posts/PostFormPage.tsx` (196 lines)
- Modify: `admin/src/locales/en.json` (52 lines)
- Modify: `admin/src/locales/vi.json` (52 lines)

**Interfaces:**
- Consumes: `useAffiliateNetworks` (Task 5), `ComparisonDetailsSection` (Task 7), `PostFormValues` (Task 4).
- Produces: fully wired post form; nothing downstream depends on this file.

- [ ] **Step 1: Read the current file in full**

Read `admin/src/features/posts/PostFormPage.tsx` (196 lines) in full immediately before editing to get exact current imports, the `PostDetail` interface, `useForm` call, `defaultValues`, the `reset()` effect, and the JSX structure of the "Post Settings" card.

- [ ] **Step 2: Add imports**

Near the top, alongside existing feature imports, add:

```typescript
import { useAffiliateNetworks } from './postsApi';
import { ComparisonDetailsSection } from './ComparisonDetailsSection';
```

- [ ] **Step 3: Extend the `PostDetail` interface**

Add a `type` field and a `comparison` field matching the API's actual response shape (confirmed from `PostResource::resolveComparison()`):

```typescript
interface ComparisonItemApiItem {
  product_name: string;
  image_url: string | null;
  retailer: string | null;
  retailer_label: string | null;
  retailer_logo: string | null;
  highlight: string | null;
  in_stock: boolean;
  price_display: string | null;
  price_cents: number | null;
  rating: number | null;
  affiliate_url: string;
  redirect_url: string;
  pros: string[];
  cons: string[];
  in_house_match_url: string | null;
}
```

Add to the existing `PostDetail` interface (do not remove any existing fields):

```typescript
  type: 'article' | 'guide' | 'comparison';
  comparison: {
    intro: string | null;
    disclosure_shown: boolean;
    items: ComparisonItemApiItem[];
  } | null;
```

- [ ] **Step 4: Call the new hook**

Inside the component body, alongside other existing hook calls:

```typescript
  const { data: affiliateNetworksData } = useAffiliateNetworks();
  const affiliateNetworks = affiliateNetworksData ?? [];
```

- [ ] **Step 5: Extend `useForm` defaultValues**

In the `useForm<PostFormValues>({ defaultValues: {...} })` call, add (preserving every existing key):

```typescript
      type: 'article',
      comparison_intro: '',
      disclosure_shown: true,
      comparison_items: [],
```

- [ ] **Step 6: Watch `type`**

Add near the other `useWatch`/`control` usage:

```typescript
  const selectedType = useWatch({ control, name: 'type' });
```

- [ ] **Step 7: Extend the `reset()` effect**

In the existing `useEffect` that calls `reset(...)` once post data loads, add these fields to the object passed to `reset()` (preserving every existing key):

```typescript
      type: post.type ?? 'article',
      comparison_intro: post.comparison?.intro ?? '',
      disclosure_shown: post.comparison?.disclosure_shown ?? true,
      comparison_items: (post.comparison?.items ?? []).map((item) => ({
        product_name: item.product_name,
        image_url: item.image_url,
        retailer: item.retailer ?? '',
        highlight: item.highlight ?? '',
        in_stock: item.in_stock,
        price_display: item.price_display ?? '',
        price_cents: item.price_cents ?? undefined,
        rating: item.rating ?? undefined,
        affiliate_url: item.affiliate_url,
        pros: item.pros ?? [],
        cons: item.cons ?? [],
        in_house_match_url: item.in_house_match_url ?? '',
      })),
```

- [ ] **Step 8: Add the `type` selector to the Post Settings card JSX**

Inside the existing "Post Settings" card's field group (near `status`), add:

```tsx
              <div>
                <label className="text-sm font-medium">{t('posts.form_label_type')}</label>
                <select
                  {...register('type')}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="article">{t('posts.type.article')}</option>
                  <option value="guide">{t('posts.type.guide')}</option>
                  <option value="comparison">{t('posts.type.comparison')}</option>
                </select>
              </div>
```

- [ ] **Step 9: Conditionally render `ComparisonDetailsSection`**

After the main content editor section in the JSX, add:

```tsx
        {selectedType === 'comparison' && (
          <ComparisonDetailsSection control={control} register={register} affiliateNetworks={affiliateNetworks} />
        )}
```

- [ ] **Step 10: Read and extend `en.json`**

Read `admin/src/locales/en.json` in full (52 lines) to find the exact insertion point inside the `posts` object, then add these keys (nested under the existing `posts` key, alongside `errors` if one exists — otherwise create `posts.errors` alongside):

```json
    "form_label_type": "Post Type",
    "type": {
      "article": "Article",
      "guide": "Guide",
      "comparison": "Comparison"
    },
    "comparison": {
      "section_title": "Comparison Details",
      "intro": "Intro Text",
      "disclosure_shown": "Show affiliate disclosure",
      "items_title": "Comparison Items",
      "item_label": "Item",
      "untitled_item": "Untitled item",
      "add_item": "Add Item",
      "remove_item": "Remove",
      "product_name": "Product Name",
      "retailer": "Retailer",
      "select_retailer": "Select a retailer",
      "image": "Image",
      "highlight": "Highlight",
      "price_display": "Price (display)",
      "price_cents": "Price (cents)",
      "rating": "Rating (0-5)",
      "in_stock": "In stock",
      "affiliate_url": "Affiliate URL",
      "in_house_match_url": "Similar product link",
      "pros": "Pros",
      "cons": "Cons",
      "add_pro": "Add a pro",
      "add_con": "Add a con",
      "errors": {
        "product_name_required": "Product name is required",
        "retailer_required": "Retailer is required",
        "affiliate_url_invalid": "Enter a valid affiliate URL",
        "match_url_invalid": "Enter a valid URL",
        "list_item_required": "This field cannot be empty"
      }
    }
```

- [ ] **Step 11: Read and extend `vi.json`**

Read `admin/src/locales/vi.json` in full (52 lines) to confirm the matching structure, then add the Vietnamese equivalent at the same nesting location:

```json
    "form_label_type": "Loại bài viết",
    "type": {
      "article": "Bài viết",
      "guide": "Hướng dẫn",
      "comparison": "So sánh"
    },
    "comparison": {
      "section_title": "Chi tiết so sánh",
      "intro": "Đoạn giới thiệu",
      "disclosure_shown": "Hiển thị công bố affiliate",
      "items_title": "Danh sách sản phẩm so sánh",
      "item_label": "Mục",
      "untitled_item": "Mục chưa đặt tên",
      "add_item": "Thêm mục",
      "remove_item": "Xóa",
      "product_name": "Tên sản phẩm",
      "retailer": "Nhà bán lẻ",
      "select_retailer": "Chọn nhà bán lẻ",
      "image": "Hình ảnh",
      "highlight": "Điểm nổi bật",
      "price_display": "Giá hiển thị",
      "price_cents": "Giá (cents)",
      "rating": "Đánh giá (0-5)",
      "in_stock": "Còn hàng",
      "affiliate_url": "URL affiliate",
      "in_house_match_url": "Link sản phẩm tương tự",
      "pros": "Ưu điểm",
      "cons": "Nhược điểm",
      "add_pro": "Thêm ưu điểm",
      "add_con": "Thêm nhược điểm",
      "errors": {
        "product_name_required": "Tên sản phẩm là bắt buộc",
        "retailer_required": "Nhà bán lẻ là bắt buộc",
        "affiliate_url_invalid": "Nhập URL affiliate hợp lệ",
        "match_url_invalid": "Nhập URL hợp lệ",
        "list_item_required": "Trường này không được để trống"
      }
    }
```

- [ ] **Step 12: Verify it compiles**

Run: `cd admin && npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 13: Run the full frontend test suite**

Run: `cd admin && npx vitest run`
Expected: PASS (all).

- [ ] **Step 14: Manual verification (documented, no automated test — Known Deviation #3)**

Run: `cd admin && npm run dev` (and backend `php artisan serve` if not already running). In the browser:
1. Open the post form, select Post Type = Comparison — confirm the Comparison Details section appears.
2. Add an item, pick an image via MediaPicker, select a retailer, fill all fields, add 2 pros and 1 con via TagInput (Enter and comma both work, × removes a tag).
3. Save — confirm no validation errors, and reloading the post shows all entered data restored correctly (repeater, image, tags, checkbox states).
4. Switch Post Type back to Article — confirm the Comparison Details section disappears and saving still works.

- [ ] **Step 15: Commit**

```bash
cd admin
git add src/features/posts/PostFormPage.tsx src/locales/en.json src/locales/vi.json
git commit -m "feat(admin): wire comparison details into post form"
```

---

## Final Verification

- [ ] Run full backend suite: `cd backend && php artisan test` — expect 100% pass, no regressions in pre-existing `PostController*Test`, `MediaControllerTest` files.
- [ ] Run full frontend suite: `cd admin && npx vitest run` — expect 100% pass.
- [ ] Run `cd admin && npx tsc --noEmit` — expect zero errors.
- [ ] Complete the Task 8 Step 14 manual E2E pass.
- [ ] Remind the user to run `npx gitnexus analyze` locally after this branch merges (per standing project practice — do not run it automatically).
