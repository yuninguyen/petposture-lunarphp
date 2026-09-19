<?php

namespace Tests\Feature\Api\Admin;

use App\Models\Review;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Lunar\FieldTypes\Text;
use Lunar\Models\Order;
use Lunar\Models\OrderLine;
use Lunar\Models\Product;
use Tests\TestCase;

class ReviewControllerTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RoleSeeder::class);
    }

    public function test_core_admin_can_list_filter_show_update_and_destroy_reviews_without_a_store_route(): void
    {
        $this->actingAsCoreAdmin();
        $firstProduct = $this->product('First Support Bed');
        $secondProduct = $this->product('Second Support Bed');
        $pending = $this->review($firstProduct, ['status' => 'pending']);
        $approved = $this->review($secondProduct, ['status' => 'approved']);

        $this->getJson('/api/admin/reviews?status=pending&product_id='.$firstProduct->id)
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $pending->id)
            ->assertJsonPath('data.0.product.name', 'First Support Bed')
            ->assertJsonStructure(['data' => [['id', 'product' => ['id', 'name'], 'customer_name', 'customer_email', 'rating', 'comment', 'is_verified', 'status', 'created_at', 'updated_at']], 'meta']);

        $this->getJson('/api/admin/reviews/'.$approved->id)
            ->assertOk()
            ->assertJsonPath('data.product.name', 'Second Support Bed');

        $this->patchJson('/api/admin/reviews/'.$pending->id, [
            'status' => 'approved',
            'rating' => 4,
            'comment' => 'Moderated review.',
            'customer_name' => 'Moderated Customer',
        ])->assertOk()
            ->assertJsonPath('data.status', 'approved')
            ->assertJsonPath('data.rating', 4);

        $this->deleteJson('/api/admin/reviews/'.$pending->id)->assertNoContent();
        $this->assertDatabaseMissing('reviews', ['id' => $pending->id]);
        $this->postJson('/api/admin/reviews', [])->assertStatus(405);
    }

    public function test_product_lookup_returns_only_limited_named_options_and_respects_search(): void
    {
        $this->actingAsCoreAdmin();
        $matching = $this->product('Orthopedic Support Bed');
        $this->product('Travel Bowl');
        foreach (range(1, 51) as $number) {
            $this->product('Support Product '.$number);
        }

        $response = $this->getJson('/api/admin/reviews/products?search=support')->assertOk();

        $this->assertCount(50, $response->json('data'));
        $this->assertContains(['id' => $matching->id, 'name' => 'Orthopedic Support Bed'], $response->json('data'));
        $this->assertSame(['id', 'name'], array_keys($response->json('data.0')));
    }

    public function test_update_rejects_invalid_moderation_values_and_cannot_change_review_evidence_or_identity_fields(): void
    {
        $this->actingAsCoreAdmin();
        $product = $this->product('Original Product');
        $replacement = $this->product('Replacement Product');
        [$originalOrder, $originalLine] = $this->orderEvidence();
        [$replacementOrder, $replacementLine] = $this->orderEvidence();
        $review = $this->review($product, [
            'customer_email' => 'original@example.com',
            'lunar_order_id' => $originalOrder->id,
            'lunar_order_line_id' => $originalLine->id,
        ]);

        $this->patchJson('/api/admin/reviews/'.$review->id, [
            'status' => 'invalid',
            'rating' => 6,
            'comment' => str_repeat('x', 2001),
            'customer_name' => '',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['status', 'rating', 'comment', 'customer_name']);

        $this->patchJson('/api/admin/reviews/'.$review->id, [
            'status' => 'approved',
            'lunar_product_id' => $replacement->id,
            'lunar_order_id' => $replacementOrder->id,
            'lunar_order_line_id' => $replacementLine->id,
            'customer_email' => 'attacker@example.com',
            'is_verified' => true,
        ])->assertOk();

        $this->assertDatabaseHas('reviews', [
            'id' => $review->id,
            'lunar_product_id' => $product->id,
            'lunar_order_id' => $originalOrder->id,
            'lunar_order_line_id' => $originalLine->id,
            'customer_email' => 'original@example.com',
            'is_verified' => false,
            'status' => 'approved',
        ]);
    }

    public function test_review_routes_grant_read_update_and_delete_to_support_and_product_manager_only(): void
    {
        $product = $this->product('Permission Product');

        foreach (['Support', 'Product Manager'] as $role) {
            $roleReview = $this->review($product, ['customer_email' => "user-{$role}@example.com"]);
            Sanctum::actingAs($this->userWithRole($role));
            $this->getJson('/api/admin/reviews')->assertOk();
            $this->getJson('/api/admin/reviews/products')->assertOk();
            $this->getJson('/api/admin/reviews/'.$roleReview->id)->assertOk();
            $this->patchJson('/api/admin/reviews/'.$roleReview->id, ['status' => 'approved'])->assertOk();
            $this->deleteJson('/api/admin/reviews/'.$roleReview->id)->assertNoContent();
        }

        $blockedReview = $this->review($product, ['customer_email' => 'blocked@example.com']);
        Sanctum::actingAs($this->userWithRole('Order Manager'));
        $this->getJson('/api/admin/reviews')->assertForbidden();
        $this->getJson('/api/admin/reviews/products')->assertForbidden();
        $this->getJson('/api/admin/reviews/'.$blockedReview->id)->assertForbidden();
        $this->patchJson('/api/admin/reviews/'.$blockedReview->id, ['status' => 'approved'])->assertForbidden();
        $this->deleteJson('/api/admin/reviews/'.$blockedReview->id)->assertForbidden();
    }

    private function actingAsCoreAdmin(): User
    {
        $user = $this->userWithRole('admin');
        Sanctum::actingAs($user);

        return $user;
    }

    private function userWithRole(string $role): User
    {
        $user = User::factory()->create();
        $user->assignRole($role);

        return $user;
    }

    private function product(string $name): Product
    {
        return Product::factory()->create([
            'attribute_data' => ['name' => new Text($name)],
        ]);
    }

    /** @return array{Order, OrderLine} */
    private function orderEvidence(): array
    {
        $order = Order::factory()->create();
        $line = OrderLine::factory()->create(['order_id' => $order->id]);

        return [$order, $line];
    }

    private function review(Product $product, array $overrides = []): Review
    {
        return Review::query()->create(array_merge([
            'lunar_product_id' => $product->id,
            'customer_name' => 'Customer',
            'customer_email' => 'customer@example.com',
            'rating' => 5,
            'comment' => 'Helpful review.',
            'status' => 'pending',
            'is_verified' => false,
        ], $overrides));
    }
}
