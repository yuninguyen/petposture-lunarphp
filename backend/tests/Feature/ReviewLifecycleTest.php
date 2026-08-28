<?php

namespace Tests\Feature;

use App\Models\Review;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Lunar\Models\Language;
use Lunar\Models\Order;
use Lunar\Models\OrderLine;
use Lunar\Models\Product;
use Lunar\Models\ProductVariant;
use Lunar\Models\Url;
use Tests\TestCase;

class ReviewLifecycleTest extends TestCase
{
    use RefreshDatabase;

    public function test_public_listing_only_returns_approved_reviews(): void
    {
        $product = $this->createReviewableProduct();

        Review::query()->create($this->reviewAttributes($product, ['status' => 'pending']));
        $approved = Review::query()->create($this->reviewAttributes($product, ['status' => 'approved']));
        Review::query()->create($this->reviewAttributes($product, ['status' => 'rejected']));

        $this->getJson("/api/products/review-product-{$product->id}/reviews")
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $approved->id)
            ->assertJsonMissingPath('data.0.customer_email')
            ->assertJsonMissingPath('data.0.user_id')
            ->assertJsonMissingPath('data.0.lunar_order_id')
            ->assertJsonMissingPath('data.0.lunar_order_line_id');
    }

    public function test_guest_submission_records_identity_and_defaults_to_pending(): void
    {
        $product = $this->createReviewableProduct();

        $this->postJson("/api/products/review-product-{$product->id}/reviews", [
            'customer_name' => 'Guest Buyer',
            'customer_email' => 'guest@example.com',
            'rating' => 5,
            'comment' => 'A useful and comfortable product.',
            'website' => '',
        ])->assertCreated()
            ->assertJsonPath('data.status', 'pending')
            ->assertJsonPath('data.is_verified', false);

        $this->assertDatabaseHas('reviews', [
            'lunar_product_id' => $product->id,
            'user_id' => null,
            'customer_email' => 'guest@example.com',
            'status' => 'pending',
            'is_verified' => false,
        ]);
    }

    public function test_authenticated_paid_purchaser_is_linked_and_verified(): void
    {
        $user = User::factory()->create(['email' => 'buyer@example.com']);
        [$product, $order, $line] = $this->createPaidOrderEvidence($user);

        $this->actingAs($user, 'web')
            ->postJson("/api/products/review-product-{$product->id}/reviews", [
                'customer_name' => 'Real Buyer',
                'customer_email' => 'spoofed@example.com',
                'rating' => 4,
                'comment' => 'Verified against the server-side order.',
                'website' => '',
            ])->assertCreated()
            ->assertJsonPath('data.is_verified', true);

        $this->assertDatabaseHas('reviews', [
            'lunar_product_id' => $product->id,
            'user_id' => $user->id,
            'customer_email' => 'buyer@example.com',
            'lunar_order_id' => $order->id,
            'lunar_order_line_id' => $line->id,
            'status' => 'pending',
            'is_verified' => true,
        ]);
    }

    public function test_unpaid_unfulfilled_order_does_not_verify_a_review(): void
    {
        $user = User::factory()->create(['email' => 'pending@example.com']);
        [$product, $order] = $this->createPaidOrderEvidence($user);
        $order->update([
            'status' => 'processing',
            'meta' => ['payment_status' => 'pending'],
        ]);

        $this->actingAs($user, 'web')
            ->postJson("/api/products/review-product-{$product->id}/reviews", [
                'customer_name' => 'Pending Buyer',
                'rating' => 4,
                'comment' => 'The order is not paid or fulfilled yet.',
                'website' => '',
            ])->assertCreated()
            ->assertJsonPath('data.is_verified', false);
    }

    public function test_review_cannot_be_marked_verified_without_valid_order_evidence(): void
    {
        $product = $this->createReviewableProduct();

        $review = Review::query()->create($this->reviewAttributes($product, [
            'customer_email' => 'attacker@example.com',
            'is_verified' => true,
        ]));

        $this->assertFalse($review->fresh()->is_verified);
    }

    public function test_submission_is_rate_limited_per_identity(): void
    {
        $product = $this->createReviewableProduct();
        $payload = [
            'customer_name' => 'Frequent Reviewer',
            'customer_email' => 'frequent@example.com',
            'rating' => 5,
            'comment' => 'Repeated review attempt.',
            'website' => '',
        ];

        foreach (range(1, 5) as $attempt) {
            $this->postJson("/api/products/review-product-{$product->id}/reviews", $payload)
                ->assertCreated();
        }

        $this->postJson("/api/products/review-product-{$product->id}/reviews", $payload)
            ->assertTooManyRequests();
    }

    public function test_submission_rejects_honeypot_and_oversized_comment(): void
    {
        $product = $this->createReviewableProduct();
        $payload = [
            'customer_name' => 'Spam Bot',
            'customer_email' => 'spam@example.com',
            'rating' => 5,
            'comment' => str_repeat('x', 2001),
            'website' => 'https://spam.example',
        ];

        $this->postJson("/api/products/review-product-{$product->id}/reviews", $payload)
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['comment', 'website']);
    }

    private function createReviewableProduct(): Product
    {
        $language = Language::query()->firstOrCreate(
            ['code' => 'en'],
            ['name' => 'English', 'default' => true],
        );
        $product = Product::factory()->create(['status' => 'published']);
        ProductVariant::factory()->create(['product_id' => $product->id]);

        Url::query()->create([
            'language_id' => $language->id,
            'element_type' => Product::morphName(),
            'element_id' => $product->id,
            'slug' => 'review-product-'.$product->id,
            'default' => true,
        ]);

        return $product;
    }

    /** @return array{Product, Order, OrderLine} */
    private function createPaidOrderEvidence(User $user): array
    {
        $product = $this->createReviewableProduct();
        $variant = $product->variants()->firstOrFail();
        $order = Order::factory()->create([
            'user_id' => $user->id,
            'customer_reference' => $user->email,
            'status' => 'payment-received',
            'meta' => ['payment_status' => 'paid'],
        ]);
        $line = OrderLine::factory()->create([
            'order_id' => $order->id,
            'purchasable_type' => ProductVariant::morphName(),
            'purchasable_id' => $variant->id,
        ]);

        return [$product, $order, $line];
    }

    private function reviewAttributes(Product $product, array $overrides = []): array
    {
        return array_merge([
            'lunar_product_id' => $product->id,
            'customer_name' => 'Reviewer',
            'customer_email' => 'reviewer@example.com',
            'rating' => 5,
            'comment' => 'Helpful feedback.',
            'status' => 'pending',
            'is_verified' => false,
        ], $overrides);
    }
}
