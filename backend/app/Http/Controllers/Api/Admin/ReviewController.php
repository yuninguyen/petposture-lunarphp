<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Review;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Gate;
use Lunar\Models\Product;

class ReviewController extends Controller
{
    public function products(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'search' => ['nullable', 'string', 'max:255'],
        ]);
        $search = trim((string) ($validated['search'] ?? ''));

        $products = Product::query()
            ->when($search !== '', function ($query) use ($search): void {
                $query->whereRaw('LOWER(CAST(attribute_data AS CHAR)) LIKE ?', ['%'.strtolower($search).'%']);
            })
            ->limit(50)
            ->get()
            ->map(fn (Product $product): array => $this->productOption($product))
            ->values();

        return response()->json(['data' => $products]);
    }

    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'status' => ['nullable', 'in:pending,approved,rejected'],
            'product_id' => ['nullable', 'integer', 'exists:lunar_products,id'],
        ]);

        $reviews = Review::query()
            ->with('product')
            ->when($validated['status'] ?? null, fn ($query, string $status) => $query->where('status', $status))
            ->when($validated['product_id'] ?? null, fn ($query, int $productId) => $query->where('lunar_product_id', $productId))
            ->latest()
            ->paginate();

        return response()->json([
            'data' => $reviews->getCollection()->map(fn (Review $review): array => $this->reviewData($review))->values(),
            'meta' => [
                'current_page' => $reviews->currentPage(),
                'last_page' => $reviews->lastPage(),
                'per_page' => $reviews->perPage(),
                'total' => $reviews->total(),
            ],
        ]);
    }

    public function show(Review $review): JsonResponse
    {
        $review->load('product');

        return response()->json(['data' => $this->reviewData($review)]);
    }

    public function update(Request $request, Review $review): JsonResponse
    {
        Gate::authorize('update', $review);

        $validated = $request->validate([
            'status' => ['sometimes', 'in:pending,approved,rejected'],
            'rating' => ['sometimes', 'integer', 'min:1', 'max:5'],
            'comment' => ['sometimes', 'required', 'string', 'max:2000'],
            'customer_name' => ['sometimes', 'required', 'string', 'max:255'],
        ]);

        $review->update($validated);
        $review->load('product');

        return response()->json(['data' => $this->reviewData($review)]);
    }

    public function destroy(Review $review): Response
    {
        Gate::authorize('delete', $review);

        $review->delete();

        return response()->noContent();
    }

    private function reviewData(Review $review): array
    {
        return [
            'id' => $review->id,
            'product' => $review->product ? $this->productOption($review->product) : null,
            'customer_name' => $review->customer_name,
            'customer_email' => $review->customer_email,
            'rating' => $review->rating,
            'comment' => $review->comment,
            'is_verified' => $review->is_verified,
            'status' => $review->status,
            'created_at' => $review->created_at?->toISOString(),
            'updated_at' => $review->updated_at?->toISOString(),
        ];
    }

    private function productOption(Product $product): array
    {
        return [
            'id' => $product->id,
            'name' => (string) ($product->translateAttribute('name') ?: 'Untitled product'),
        ];
    }
}
