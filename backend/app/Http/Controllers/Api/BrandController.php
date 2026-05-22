<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\Api\ProductResource;
use App\Services\ProductSyncService;
use Illuminate\Support\Facades\Cache;
use Lunar\Models\Brand;
use Lunar\Models\Product;

class BrandController extends Controller
{
    public function index()
    {
        $brands = Cache::remember('brands:index', now()->addHours(2), function () {
            return Brand::withCount('products')
                ->orderBy('name')
                ->get()
                ->map(fn ($b) => [
                    'id'            => $b->id,
                    'name'          => $b->name,
                    'slug'          => \Illuminate\Support\Str::slug($b->name),
                    'product_count' => $b->products_count,
                    'thumbnail'     => $b->getFirstMediaUrl() ?: null,
                ])
                ->values();
        });

        return response()->json(['data' => $brands]);
    }

    public function products(int $id)
    {
        $brand = Brand::findOrFail($id);

        $products = Product::where('status', 'published')
            ->where('brand_id', $id)
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
            ])
            ->paginate(12);

        return ProductResource::collection($products);
    }
}
