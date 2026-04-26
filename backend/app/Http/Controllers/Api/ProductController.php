<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\Api\OrderResource;
use App\Http\Resources\Api\ProductResource;
use App\Models\ProductSyncMapping;
use App\Models\Review;
use App\Traits\HttpResponses;
use Illuminate\Http\Request;
use Lunar\Models\Order;
use Lunar\Models\Product;

class ProductController extends Controller
{
    use HttpResponses;

    public function index(Request $request)
    {
        $query = Product::where('status', 'published')
            ->whereHas('variants')
            ->with(['variants.prices', 'thumbnail', 'defaultUrl', 'urls', 'collections.defaultUrl']);

        // Filter by category
        if ($request->has('category')) {
            $query->whereHas('collections', fn($q) => 
                $q->where('slug', $request->input('category'))
            );
        }

        // Search by name/description
        if ($request->has('q')) {
            $search = $request->input('q');
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('description', 'like', "%{$search}%");
            });
        }

        // Min price filter
        if ($request->has('min_price')) {
            $query->whereHas('variants.prices', fn($q) =>
                $q->where('price', '>=', (int) ($request->input('min_price') * 100))
            );
        }

        // Max price filter
        if ($request->has('max_price')) {
            $query->whereHas('variants.prices', fn($q) =>
                $q->where('price', '<=', (int) ($request->input('max_price') * 100))
            );
        }

        // Sort
        $sort = $request->input('sort', 'newest');
        $query->orderBy(
            match ($sort) {
                'price_asc', 'price_desc' => 'price',
                default => 'created_at',
            },
            match ($sort) {
                'price_asc' => 'asc',
                'price_desc' => 'desc',
                default => 'desc',
            }
        );

        $products = $query->paginate(12);

        return ProductResource::collection($products);
    }

    public function show($slug)
    {
        $product = $this->resolvePublishedProduct($slug);

        if (!$product) {
            abort(404, 'Product not found');
        }

        return new ProductResource($product);
    }

    public function reviews($slug)
    {
        $product = $this->resolvePublishedProduct($slug);

        if (! $product) {
            return response()->json(['message' => 'Product not found'], 404);
        }

        $legacyProductId = $this->resolveLegacyProductId($product);

        if (! $legacyProductId) {
            return response()->json(['data' => []]);
        }

        return response()->json([
            'data' => Review::query()
                ->where('product_id', $legacyProductId)
                ->latest()
                ->get(),
        ]);
    }

    public function storeReview(Request $request, $slug)
    {
        $product = $this->resolvePublishedProduct($slug);

        if (! $product) {
            return response()->json(['message' => 'Product not found'], 404);
        }

        $legacyProductId = $this->resolveLegacyProductId($product);

        if (! $legacyProductId) {
            return response()->json(['message' => 'This product is not currently accepting reviews.'], 422);
        }

        $validated = $request->validate([
            'customer_name' => 'required|string|max:255',
            'rating' => 'required|integer|min:1|max:5',
            'comment' => 'required|string',
        ]);

        $review = Review::query()->create([
            'product_id' => $legacyProductId,
            'customer_name' => $validated['customer_name'],
            'rating' => $validated['rating'],
            'comment' => $validated['comment'],
            'is_verified' => false,
        ]);

        return response()->json([
            'message' => 'Review submitted successfully',
            'data' => $review,
        ], 201);
    }

    public function orders(Request $request)
    {
        $orders = Order::where('user_id', $request->user()->id)
            ->latest()
            ->paginate(10);

        return OrderResource::collection($orders);
    }

    private function resolvePublishedProduct(string $slug): ?Product
    {
        $product = Product::with(['variants.prices', 'thumbnail', 'defaultUrl', 'urls', 'collections.defaultUrl'])
            ->where('status', 'published')
            ->whereHas('variants')
            ->whereHas('urls', fn($q) => $q->where('slug', $slug))
            ->first();

        if (! $product && is_numeric($slug)) {
            $product = Product::with(['variants.prices', 'thumbnail', 'defaultUrl', 'urls', 'collections.defaultUrl'])
                ->where('status', 'published')
                ->whereHas('variants')
                ->find($slug);
        }

        return $product;
    }

    private function resolveLegacyProductId(Product $product): ?int
    {
        $legacyProductId = $product->translateAttribute('legacy_product_id');

        if (is_numeric($legacyProductId)) {
            return (int) $legacyProductId;
        }

        return ProductSyncMapping::query()
            ->where('lunar_product_id', $product->id)
            ->value('legacy_product_id');
    }
}
