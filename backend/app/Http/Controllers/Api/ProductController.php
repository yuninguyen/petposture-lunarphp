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

    public function index()
    {
        $products = Product::where('status', 'published')
            ->whereHas('variants')
            ->with(['variants.prices', 'thumbnail', 'defaultUrl', 'urls', 'collections.defaultUrl'])
            ->paginate(12);

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
