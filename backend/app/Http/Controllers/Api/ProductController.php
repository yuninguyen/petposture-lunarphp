<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\Api\OrderResource;
use App\Http\Resources\Api\ProductResource;
use App\Models\ProductSyncMapping;
use App\Models\Review;
use App\Traits\HttpResponses;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Lunar\Models\Order;
use Lunar\Models\Price;
use Lunar\Models\Product;
use Lunar\Models\ProductVariant;

class ProductController extends Controller
{
    use HttpResponses;

    public function index(Request $request)
    {
        $query = Product::where('status', 'published')
            ->whereHas('variants')
            ->with(['variants.prices', 'thumbnail', 'defaultUrl', 'urls', 'collections.defaultUrl']);

        // Filter by category: slug lives in lunar_urls, not lunar_collections
        if ($request->filled('category')) {
            $query->whereHas('collections', fn ($q) =>
                $q->whereHas('urls', fn ($q2) =>
                    $q2->where('slug', $request->input('category'))
                )
            );
        }

        // Search: Lunar product names/descriptions are stored in attribute_data JSON
        if ($request->filled('q')) {
            $term = '%' . strtolower($request->input('q')) . '%';
            $query->whereRaw('LOWER(CAST(attribute_data AS TEXT)) LIKE ?', [$term]);
        }

        // Min price filter
        if ($request->filled('min_price')) {
            $variantMorph = (new ProductVariant)->getMorphClass();
            $query->whereHas('variants', fn ($q) =>
                $q->whereHas('prices', fn ($q2) =>
                    $q2->where('price', '>=', (int) ($request->input('min_price') * 100))
                      ->where('priceable_type', $variantMorph)
                )
            );
        }

        // Max price filter
        if ($request->filled('max_price')) {
            $variantMorph = (new ProductVariant)->getMorphClass();
            $query->whereHas('variants', fn ($q) =>
                $q->whereHas('prices', fn ($q2) =>
                    $q2->where('price', '<=', (int) ($request->input('max_price') * 100))
                      ->where('priceable_type', $variantMorph)
                )
            );
        }

        // Sort: price requires a subquery since price is on lunar_prices, not lunar_products
        $sort = $request->input('sort', 'newest');

        if (in_array($sort, ['price_asc', 'price_desc'])) {
            $direction  = $sort === 'price_asc' ? 'asc' : 'desc';
            $variantMorph = (new ProductVariant)->getMorphClass();
            $priceSubquery = Price::query()
                ->selectRaw('MIN(price)')
                ->join('lunar_product_variants', 'lunar_product_variants.id', '=', 'lunar_prices.priceable_id')
                ->whereColumn('lunar_product_variants.product_id', 'lunar_products.id')
                ->where('lunar_prices.priceable_type', $variantMorph);

            $query->selectRaw('lunar_products.*')
                  ->selectSub($priceSubquery, '_sort_price')
                  ->orderBy('_sort_price', $direction);
        } else {
            $query->orderBy('lunar_products.created_at', 'desc');
        }

        // Skip cache for filtered/sorted requests; cache only the unfiltered first page
        $hasFilters = $request->hasAny(['category', 'q', 'min_price', 'max_price'])
            || ($sort !== 'newest')
            || ($request->input('page', 1) > 1);

        if ($hasFilters) {
            return ProductResource::collection($query->paginate(12));
        }

        $cacheKey = 'products:index:p1';
        $products  = Cache::tags(['products'])->remember($cacheKey, now()->addHour(), fn () => $query->paginate(12));

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
