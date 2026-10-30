# Fix Round E Leftover Test Failures — 2026-09-04

**For Codex.** These are 3 pre-existing, unrelated backend test failures that were waived to merge Round E (Manual Create Order). Confirmed still real via `vendor/bin/phpunit` on 2026-09-04. Each is independent — fix and commit separately, in this order.

## 1. `PostControllerCategoryTest::test_store_creates_category_with_auto_slug`

**File:** `backend/app/Http/Controllers/Api/Admin/BlogCategoryController.php:36-46` (`store` method)

**Current failure:**
```
Expected response status code [201] but received 422.
"The slug field is required."
```

**Root cause:** `store()` validates `'slug' => 'required|string|max:255|unique:blog_categories,slug'`, but the test posts only `name` and expects the slug to be auto-derived. The sibling controller `BlogTagController::store()` (`backend/app/Http/Controllers/Api/Admin/BlogTagController.php:28-41`) already handles this exact case correctly — mirror it:

```php
use Illuminate\Support\Str;

public function store(Request $request)
{
    $validated = $request->validate([
        'name' => 'required|string|max:255',
        'slug' => 'nullable|string|max:255|unique:blog_categories,slug',
    ]);

    $category = BlogCategory::create([
        'name' => $validated['name'],
        'slug' => $validated['slug'] ?? Str::slug($validated['name']).'-'.rand(1000, 9999),
    ]);

    return new BlogCategoryResource($category);
}
```

Also apply the same `slug` nullable + fallback pattern to `update()` (`backend/app/Http/Controllers/Api/Admin/BlogCategoryController.php:61-71`), matching `BlogTagController::update()` (lines 48-62), for consistency — not covered by a failing test today, but leaving `update()` inconsistent with `store()` would just move the same bug there.

**Verify:**
```bash
cd backend && vendor/bin/phpunit tests/Feature/Api/Admin/PostControllerCategoryTest.php
```
All 4 tests in that file must pass, including `test_store_accepts_explicit_unique_slug` and `test_store_rejects_duplicate_slug` (must not regress).

## 2. `ExampleTest::test_the_application_returns_a_successful_response`

**File:** `backend/tests/Feature/ExampleTest.php:13-18`

**Current failure:**
```
Expected response status code [200] but received 302.
```

**Root cause:** This is the untouched Laravel scaffold test. `GET /` has intentionally redirected to `/admin/login` since `backend/routes/web.php:7-9` was written — this is a real product route (backend has no public homepage), not a regression. The test is simply stale.

**Fix — update the test, do not touch the route:**
```php
public function test_the_application_redirects_to_admin_login(): void
{
    $response = $this->get('/');

    $response->assertRedirect('/admin/login');
}
```
Rename the method to reflect actual behavior (as above) and update `Tests\Feature\ExampleTest` accordingly. Leave `backend/tests/Unit/ExampleTest.php` alone — it's a different, unrelated file (unit-level scaffold test, doesn't hit routing).

**Verify:**
```bash
cd backend && vendor/bin/phpunit tests/Feature/ExampleTest.php
```

## 3. `PayPalApiTest` refund cases — STALE REPORT, no action needed

**File:** `backend/tests/Feature/PayPalApiTest.php`

Ran standalone AND as part of the full 482-test suite on 2026-09-04: **all pass**, including `test_admin_can_issue_full_refund_on_paid_paypal_order` (line 282) and `test_admin_can_issue_partial_refund_on_paid_paypal_order` (line 301) — both already send `'reason' => 'other'` in the refund request body, satisfying the mandatory-reason validation added in the Round C refund-reason work. The full-suite run that originally reported this (during Round E) is stale — do not touch this file.

## 4. `ProductCatalogApiTest::test_product_index_only_returns_published_synced_products` — real failure, found while re-verifying #3

Not in the original Round E waived list, but discovered running the full suite while confirming #3 above. Reproduces standalone too (16/16 → 1 failure), so it's a real, non-flaky bug — fix it in the same pass.

**File:** `backend/tests/Feature/ProductCatalogApiTest.php:133`

**Current failure:**
```
Failed asserting that null is identical to 129.99.
```
on `->assertJsonPath('data.0.oldPrice', 129.99)`.

**Root cause:** The test asserts a JSON key `oldPrice` that no longer exists on `/api/products`. `App\Http\Resources\Api\ProductResource` (`backend/app/Http/Resources/Api/ProductResource.php:52`) emits the field as `comparePrice`, not `oldPrice` — confirmed this is the only field name used anywhere in the resource (grepped the whole `app/` tree, zero other `oldPrice` occurrences in backend code). This is a stale test, not a broken API: the real frontend consumer (`frontend/components/shop/ProductCard.tsx:96`) already reads `product.comparePrice ?? product.oldPrice`, so production is unaffected — only `frontend/components/ProductGrid.tsx` and `frontend/lib/shopData.ts` use `oldPrice`, and both of those are static/mock data paths, not `/api/products` consumers.

**Fix — update the test assertion only, do not touch `ProductResource` or any frontend file:**
```php
->assertJsonPath('data.0.comparePrice', 129.99)
```
Replace exactly that one line (`tests/Feature/ProductCatalogApiTest.php:133`). Everything else in the test is correct and must not change.

**Verify:**
```bash
cd backend && vendor/bin/phpunit tests/Feature/ProductCatalogApiTest.php
```

## Definition of done

- `vendor/bin/phpunit` (full suite) is 100% green with no skips.
- Only files touched: `BlogCategoryController.php`, `ExampleTest.php` (Feature), `ProductCatalogApiTest.php`.
- No changes to `BlogTagController.php`, `routes/web.php`, `ProductResource.php`, `PayPalApiTest.php`, or any frontend file.
