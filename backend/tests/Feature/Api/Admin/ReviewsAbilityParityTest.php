<?php

declare(strict_types=1);

namespace Tests\Feature\Api\Admin;

use App\Models\Review;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Lunar\FieldTypes\Text;
use Lunar\Models\Product;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

/**
 * Parity test suite for Phase 6b: Reviews Domain Migration (Domain #24).
 *
 * Verifies exact 100% status code parity across all 7 roles for /reviews endpoints:
 * - GET /api/admin/reviews/products (view_any_review)
 * - GET /api/admin/reviews (view_any_review)
 * - GET /api/admin/reviews/{review} (view_any_review)
 * - PUT|PATCH /api/admin/reviews/{review} (update_review)
 * - DELETE /api/admin/reviews/{review} (delete_review)
 *
 * Allowed: super_admin, admin, staff, Product Manager, Support
 * Blocked: Order Manager, customer
 *
 * CRITICAL: Both Product Manager and Support MUST be able to delete reviews (204 No Content),
 * preserving existing behavior despite the incomplete reference in abilitiesForRole().
 */
class ReviewsAbilityParityTest extends TestCase
{
    use RefreshDatabase;

    private const ALLOWED_ROLES = [
        'super_admin',
        'admin',
        'staff',
        'Product Manager',
        'Support',
    ];

    private const BLOCKED_ROLES = [
        'Order Manager',
        'customer',
    ];

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
    }

    public function test_allowed_roles_can_list_reviews(): void
    {
        $product = $this->createProduct('Listing Test Bed');
        $this->createReview($product);

        foreach (self::ALLOWED_ROLES as $role) {
            $this->actingAsRole($role);

            $response = $this->getJson('/api/admin/reviews');

            $response->assertOk(
                "Role '{$role}' must be permitted to list reviews (GET /api/admin/reviews)."
            );
        }
    }

    public function test_blocked_roles_cannot_list_reviews(): void
    {
        $product = $this->createProduct('Blocked List Bed');
        $this->createReview($product);

        foreach (self::BLOCKED_ROLES as $role) {
            $this->actingAsRole($role);

            $response = $this->getJson('/api/admin/reviews');

            $response->assertForbidden(
                "Role '{$role}' must be forbidden from listing reviews (GET /api/admin/reviews)."
            );
        }
    }

    public function test_allowed_roles_can_list_review_products(): void
    {
        $this->createProduct('Review Products Lookup Bed');

        foreach (self::ALLOWED_ROLES as $role) {
            $this->actingAsRole($role);

            $response = $this->getJson('/api/admin/reviews/products');

            $response->assertOk(
                "Role '{$role}' must be permitted to list review products (GET /api/admin/reviews/products)."
            );
        }
    }

    public function test_blocked_roles_cannot_list_review_products(): void
    {
        $this->createProduct('Blocked Review Products Bed');

        foreach (self::BLOCKED_ROLES as $role) {
            $this->actingAsRole($role);

            $response = $this->getJson('/api/admin/reviews/products');

            $response->assertForbidden(
                "Role '{$role}' must be forbidden from listing review products (GET /api/admin/reviews/products)."
            );
        }
    }

    public function test_allowed_roles_can_show_review(): void
    {
        $product = $this->createProduct('Show Bed');
        $review = $this->createReview($product);

        foreach (self::ALLOWED_ROLES as $role) {
            $this->actingAsRole($role);

            $response = $this->getJson("/api/admin/reviews/{$review->id}");

            $response->assertOk(
                "Role '{$role}' must be permitted to view a review (GET /api/admin/reviews/{$review->id})."
            );
        }
    }

    public function test_blocked_roles_cannot_show_review(): void
    {
        $product = $this->createProduct('Blocked Show Bed');
        $review = $this->createReview($product);

        foreach (self::BLOCKED_ROLES as $role) {
            $this->actingAsRole($role);

            $response = $this->getJson("/api/admin/reviews/{$review->id}");

            $response->assertForbidden(
                "Role '{$role}' must be forbidden from viewing a review (GET /api/admin/reviews/{$review->id})."
            );
        }
    }

    public function test_allowed_roles_can_update_review(): void
    {
        $product = $this->createProduct('Update Bed');

        foreach (self::ALLOWED_ROLES as $role) {
            $review = $this->createReview($product);
            $this->actingAsRole($role);

            $response = $this->patchJson("/api/admin/reviews/{$review->id}", [
                'status' => 'approved',
                'rating' => 4,
                'comment' => 'Moderated by role '.$role,
                'customer_name' => 'Verified Customer',
            ]);

            $response->assertOk(
                "Role '{$role}' must be permitted to update review (PATCH /api/admin/reviews/{$review->id})."
            );
        }
    }

    public function test_blocked_roles_cannot_update_review(): void
    {
        $product = $this->createProduct('Blocked Update Bed');
        $review = $this->createReview($product);

        foreach (self::BLOCKED_ROLES as $role) {
            $this->actingAsRole($role);

            $response = $this->patchJson("/api/admin/reviews/{$review->id}", [
                'status' => 'approved',
            ]);

            $response->assertForbidden(
                "Role '{$role}' must be forbidden from updating review (PATCH /api/admin/reviews/{$review->id})."
            );
        }
    }

    public function test_allowed_roles_including_product_manager_and_support_can_delete_review(): void
    {
        $product = $this->createProduct('Delete Bed');

        foreach (self::ALLOWED_ROLES as $role) {
            $review = $this->createReview($product);
            $this->actingAsRole($role);

            $response = $this->deleteJson("/api/admin/reviews/{$review->id}");

            $response->assertNoContent();
            $this->assertDatabaseMissing('reviews', ['id' => $review->id]);
        }
    }

    public function test_blocked_roles_cannot_delete_review(): void
    {
        $product = $this->createProduct('Blocked Delete Bed');
        $review = $this->createReview($product);

        foreach (self::BLOCKED_ROLES as $role) {
            $this->actingAsRole($role);

            $response = $this->deleteJson("/api/admin/reviews/{$review->id}");

            $response->assertForbidden(
                "Role '{$role}' must be forbidden from deleting review (DELETE /api/admin/reviews/{$review->id})."
            );
        }
    }

    public function test_migration_seeds_and_assigns_review_permissions(): void
    {
        $migration = require database_path('migrations/2026_09_22_000010_seed_reviews_domain_permissions.php');
        $migration->up();

        // Product Manager and Support MUST have view_any_review, view_review, update_review, delete_review
        $businessAbilities = [
            'view_any_review',
            'view_review',
            'update_review',
            'delete_review',
        ];

        foreach (['Product Manager', 'Support'] as $roleName) {
            $role = Role::query()->where('name', $roleName)->where('guard_name', 'web')->first();
            $this->assertNotNull($role);

            foreach ($businessAbilities as $ability) {
                $this->assertTrue(
                    $role->hasPermissionTo($ability),
                    "Role '{$roleName}' must have permission '{$ability}'."
                );
            }
        }

        // Order Manager MUST NOT have review permissions
        $orderManager = Role::query()->where('name', 'Order Manager')->where('guard_name', 'web')->first();
        $this->assertNotNull($orderManager);

        foreach ($businessAbilities as $ability) {
            $this->assertFalse(
                $orderManager->hasPermissionTo($ability),
                "Order Manager must NOT have permission '{$ability}'."
            );
        }
    }

    public function test_unauthenticated_request_is_unauthorized(): void
    {
        $this->getJson('/api/admin/reviews')->assertUnauthorized();
        $this->getJson('/api/admin/reviews/products')->assertUnauthorized();
    }

    private function actingAsRole(string $role): User
    {
        $user = User::factory()->create();
        $user->assignRole($role);
        Sanctum::actingAs($user);

        return $user;
    }

    private function createProduct(string $name): Product
    {
        return Product::factory()->create([
            'attribute_data' => ['name' => new Text($name)],
        ]);
    }

    private function createReview(Product $product): Review
    {
        return Review::query()->create([
            'lunar_product_id' => $product->id,
            'customer_name' => 'Test Customer',
            'customer_email' => 'customer@example.com',
            'rating' => 5,
            'comment' => 'Great orthopedic bed for pets.',
            'status' => 'pending',
        ]);
    }
}
