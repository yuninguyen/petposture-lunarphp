<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\Api\OrderResource;
use App\Http\Resources\Api\ProductResource;
use App\Models\ProductRedirect;
use App\Models\Review;
use App\Models\User;
use App\Notifications\NewReviewNotification;
use App\Services\ProductRouteService;
use App\Services\ReviewPurchaseEvidenceService;
use App\Traits\HttpResponses;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;
use Lunar\Models\Brand;
use Lunar\Models\Order;
use Lunar\Models\Price;
use Lunar\Models\Product;
use Lunar\Models\ProductOption;
use Lunar\Models\ProductVariant;

class ProductController extends Controller
{
    use HttpResponses;

    public function index(Request $request)
    {
        $query = $this->productQuery()
            ->where('status', 'published')
            ->whereHas('variants')
            ->with([
                'variants.prices',
                'variants.values.option',
                'variants.images',
                'thumbnail',
                'images',
                'defaultUrl',
                'urls',
                'collections.defaultUrl',
                'productOptions.values',
                'brand',
            ]);

        // Filter by category: slug lives in lunar_urls, not lunar_collections
        if ($request->filled('category')) {
            $query->whereHas('collections', fn ($q) => $q->whereHas('urls', fn ($q2) => $q2->where('slug', $request->input('category'))
            )
            );
        }

        if ($request->filled('breed')) {
            $breed = Str::slug((string) $request->input('breed'));
            $query->whereExists(function ($subquery) use ($breed) {
                $subquery->selectRaw('1')
                    ->from('breed_product')
                    ->join('breeds', 'breeds.id', '=', 'breed_product.breed_id')
                    ->whereColumn('breed_product.lunar_product_id', 'lunar_products.id')
                    ->where('breeds.slug', $breed);
            });
        }

        if ($request->filled('solution')) {
            $solution = Str::slug((string) $request->input('solution'));
            $query->whereExists(function ($subquery) use ($solution) {
                $subquery->selectRaw('1')
                    ->from('solution_product')
                    ->join('solutions', 'solutions.id', '=', 'solution_product.solution_id')
                    ->whereColumn('solution_product.lunar_product_id', 'lunar_products.id')
                    ->where('solutions.slug', $solution);
            });
        }

        // Filter by brand slug
        if ($request->filled('brand')) {
            $query->whereHas('brand', fn ($q) => $q->whereRaw('LOWER(name) = ?', [strtolower($request->input('brand'))])
            );
        }

        if ($request->filled('badge')) {
            $query->where('badge_slug', Str::slug((string) $request->input('badge')));
        }

        // Search: Lunar product names/descriptions are stored in attribute_data JSON
        if ($request->filled('q')) {
            $term = '%'.strtolower($request->input('q')).'%';
            $query->whereRaw('LOWER(CAST(attribute_data AS CHAR)) LIKE ?', [$term]);
        }

        // Min price filter
        if ($request->filled('min_price')) {
            $variantMorph = (new ProductVariant)->getMorphClass();
            $query->whereHas('variants', fn ($q) => $q->whereHas('prices', fn ($q2) => $q2->where('price', '>=', (int) ($request->input('min_price') * 100))
                ->where('priceable_type', $variantMorph)
            )
            );
        }

        // Max price filter
        if ($request->filled('max_price')) {
            $variantMorph = (new ProductVariant)->getMorphClass();
            $query->whereHas('variants', fn ($q) => $q->whereHas('prices', fn ($q2) => $q2->where('price', '<=', (int) ($request->input('max_price') * 100))
                ->where('priceable_type', $variantMorph)
            )
            );
        }

        // In-stock filter
        if ($request->boolean('in_stock')) {
            $query->whereHas('variants', fn ($q) => $q->where('stock', '>', 0));
        }

        // Option value filter: ?option[size]=M&option[color]=Red
        if ($request->filled('option')) {
            foreach ((array) $request->input('option') as $optionHandle => $valueName) {
                $query->whereHas('variants.values', fn ($q) => $q->whereRaw('LOWER(CAST(name AS CHAR)) LIKE ?', ['%'.strtolower((string) $valueName).'%'])
                    ->whereHas('option', fn ($q2) => $q2->whereRaw('LOWER(handle) = ?', [strtolower((string) $optionHandle)])
                    )
                );
            }
        }

        // Sort: price requires a subquery since price is on lunar_prices, not lunar_products
        $sort = $request->input('sort', 'newest');

        if (in_array($sort, ['price_asc', 'price_desc'])) {
            $direction = $sort === 'price_asc' ? 'asc' : 'desc';
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
        $perPage = min((int) $request->input('per_page', 12), 100);

        $hasFilters = $request->hasAny(['category', 'breed', 'solution', 'brand', 'q', 'min_price', 'max_price', 'per_page', 'in_stock', 'option'])
            || ($sort !== 'newest')
            || ($request->input('page', 1) > 1);

        if ($hasFilters) {
            return ProductResource::collection($query->paginate($perPage));
        }

        $cacheKey = 'products:index:p1';
        $products = Cache::remember($cacheKey, now()->addHour(), fn () => $query->paginate($perPage));

        return ProductResource::collection($products);
    }

    public function show(Request $request, $slug)
    {
        if ($this->hasValidPreviewToken($request, $slug)) {
            $previewProduct = $this->resolvePreviewProduct($slug);

            if (! $previewProduct) {
                abort(404, 'Product not found');
            }

            return new ProductResource($previewProduct);
        }

        $product = $this->resolveCurrentPublishedProduct($slug);

        if ($product) {
            $routes = app(ProductRouteService::class);
            $requestedCategory = (string) $request->query('category', '');

            if ($requestedCategory !== '' && $requestedCategory !== $routes->categorySlug($product)) {
                return response()->json(['redirect' => [
                    'path' => $routes->path($product),
                    'slug' => $routes->slug($product),
                    'categorySlug' => $routes->categorySlug($product),
                ]]);
            }

            return new ProductResource($product);
        }

        $redirectProduct = $this->resolveRedirectProduct($slug);
        if ($redirectProduct) {
            $routes = app(ProductRouteService::class);

            return response()->json([
                'redirect' => [
                    'path' => $routes->path($redirectProduct),
                    'slug' => $routes->slug($redirectProduct),
                    'categorySlug' => $routes->categorySlug($redirectProduct),
                ],
            ]);
        }

        $product = is_numeric($slug) ? $this->resolvePublishedProduct($slug) : null;
        if (! $product) {
            abort(404, 'Product not found');
        }

        $routes = app(ProductRouteService::class);
        $requestedCategory = (string) $request->query('category', '');

        if ($requestedCategory !== '' && $requestedCategory !== $routes->categorySlug($product)) {
            return response()->json(['redirect' => [
                'path' => $routes->path($product),
                'slug' => $routes->slug($product),
                'categorySlug' => $routes->categorySlug($product),
            ]]);
        }

        return new ProductResource($product);
    }

    public function reviews($slug)
    {
        $product = $this->resolvePublishedProduct($slug);

        if (! $product) {
            return response()->json(['message' => 'Product not found'], 404);
        }

        return response()->json([
            'data' => Review::query()
                ->select(['id', 'lunar_product_id', 'customer_name', 'rating', 'comment', 'is_verified', 'created_at'])
                ->where('lunar_product_id', $product->id)
                ->where('status', 'approved')
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

        $validated = $request->validate([
            'customer_name' => ['required', 'string', 'max:255'],
            'customer_email' => [$request->user() ? 'nullable' : 'required', 'email', 'max:255'],
            'rating' => ['required', 'integer', 'min:1', 'max:5'],
            'comment' => ['required', 'string', 'max:2000'],
            'website' => ['nullable', 'max:0'],
        ]);

        $user = $request->user();
        $email = strtolower((string) ($user?->email ?? $validated['customer_email']));
        $orderLine = app(ReviewPurchaseEvidenceService::class)->find($product, $user, $email);

        $review = Review::query()->create([
            'lunar_product_id' => $product->id,
            'user_id' => $user?->id,
            'customer_name' => $validated['customer_name'],
            'customer_email' => $email,
            'lunar_order_id' => $orderLine?->order_id,
            'lunar_order_line_id' => $orderLine?->id,
            'rating' => $validated['rating'],
            'comment' => $validated['comment'],
            'status' => 'pending',
        ]);

        Notification::send(
            User::staffRecipients(),
            new NewReviewNotification($review)
        );

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

    public function related($slug)
    {
        $product = $this->resolvePublishedProduct($slug);

        if (! $product) {
            return response()->json(['data' => []]);
        }

        $collectionIds = $product->collections->pluck('id');
        $brandId = $product->brand_id ?? null;

        $query = $this->productQuery()
            ->where('status', 'published')
            ->where('id', '!=', $product->id)
            ->whereHas('variants')
            ->with([
                'variants.prices',
                'variants.values.option',
                'variants.images',
                'thumbnail',
                'images',
                'defaultUrl',
                'urls',
                'collections.defaultUrl',
                'productOptions.values',
                'brand',
            ]);

        // Same collection first, fall back to same brand
        if ($collectionIds->isNotEmpty()) {
            $query->whereHas('collections', fn ($q) => $q->whereIn('lunar_collections.id', $collectionIds));
        } elseif ($brandId) {
            $query->where('brand_id', $brandId);
        }

        $related = $query->orderBy('id')->limit(8)->get();

        // Pad deterministically if fewer than four related products are available.
        if ($related->count() < 4) {
            $existing = $related->pluck('id')->push($product->id);
            $filler = $this->productQuery()->where('status', 'published')
                ->whereNotIn('id', $existing)
                ->whereHas('variants')
                ->with(['variants.prices', 'thumbnail', 'defaultUrl', 'urls', 'collections.defaultUrl'])
                ->orderBy('id')
                ->limit(4 - $related->count())
                ->get();
            $related = $related->concat($filler);
        }

        return ProductResource::collection($related);
    }

    public function facets(Request $request)
    {
        $data = Cache::remember('products:facets', now()->addMinutes(30), function () {
            $variantMorph = (new ProductVariant)->getMorphClass();

            $priceRange = Price::query()
                ->join('lunar_product_variants', 'lunar_product_variants.id', '=', 'lunar_prices.priceable_id')
                ->join('lunar_products', 'lunar_products.id', '=', 'lunar_product_variants.product_id')
                ->where('lunar_prices.priceable_type', $variantMorph)
                ->where('lunar_products.status', 'published')
                ->selectRaw('MIN(lunar_prices.price) as min_price, MAX(lunar_prices.price) as max_price')
                ->first();

            $brands = Brand::query()
                ->whereHas('products', fn ($q) => $q->where('status', 'published'))
                ->withCount(['products' => fn ($q) => $q->where('status', 'published')])
                ->orderBy('name')
                ->get()
                ->map(fn ($b) => [
                    'id' => $b->id,
                    'name' => $b->name,
                    'slug' => Str::slug($b->name),
                    'count' => $b->products_count,
                ])
                ->values()
                ->all();

            $options = ProductOption::query()
                ->whereHas('products', fn ($q) => $q->where('status', 'published'))
                ->with('values')
                ->get()
                ->map(fn ($opt) => [
                    'handle' => $opt->handle ?? Str::slug($opt->translate('name')),
                    'name' => $opt->translate('name'),
                    'values' => $opt->values->map(fn ($v) => [
                        'id' => $v->id,
                        'name' => $v->translate('name'),
                    ])->values()->all(),
                ])
                ->values()
                ->all();

            return [
                'price_range' => [
                    'min' => $priceRange ? round($priceRange->min_price / 100, 2) : 0,
                    'max' => $priceRange ? round($priceRange->max_price / 100, 2) : 0,
                ],
                'brands' => $brands,
                'options' => $options,
            ];
        });

        return response()->json($data);
    }

    private function resolvePublishedProduct(string $slug): ?Product
    {
        $product = $this->resolveCurrentPublishedProduct($slug);

        if (! $product && is_numeric($slug)) {
            $product = $this->productQuery()->with($this->productRelations())
                ->where('status', 'published')
                ->whereHas('variants')
                ->find($slug);
        }

        return $product;
    }

    private function resolvePreviewProduct(string $slug): ?Product
    {
        return $this->productQuery()->with($this->productRelations())
            ->whereHas('variants')
            ->whereHas('urls', fn ($query) => $query->where('slug', $slug))
            ->first();
    }

    private function hasValidPreviewToken(Request $request, string $slug): bool
    {
        return $request->hasValidSignature();
    }

    private function resolveCurrentPublishedProduct(string $slug): ?Product
    {
        return $this->productQuery()->with($this->productRelations())
            ->where('status', 'published')
            ->whereHas('variants')
            ->whereHas('urls', fn ($query) => $query->where('slug', $slug))
            ->first();
    }

    private function resolveRedirectProduct(string $slug): ?Product
    {
        $redirect = ProductRedirect::query()
            ->where('old_slug', $slug)
            ->whereHas('product', fn ($query) => $query
                ->where('status', 'published')
                ->whereHas('variants'))
            ->latest('id')
            ->first();

        if (! $redirect) {
            return null;
        }

        return $this->productQuery()->with($this->productRelations())
            ->where('status', 'published')
            ->whereHas('variants')
            ->find($redirect->product_id);
    }

    private function productQuery(): \Illuminate\Database\Eloquent\Builder
    {
        return Product::query()
            ->select('lunar_products.*')
            ->selectSub(Review::query()->selectRaw('AVG(rating)')->whereColumn('lunar_product_id', 'lunar_products.id')->where('status', 'approved'), 'approved_reviews_avg_rating')
            ->selectSub(Review::query()->selectRaw('COUNT(*)')->whereColumn('lunar_product_id', 'lunar_products.id')->where('status', 'approved'), 'approved_reviews_count');
    }

    private function productRelations(): array
    {
        return [
            'variants.prices',
            'variants.values.option',
            'variants.images',
            'thumbnail',
            'images',
            'defaultUrl',
            'urls',
            'collections.defaultUrl',
            'productOptions.values',
            'brand',
        ];
    }
}
