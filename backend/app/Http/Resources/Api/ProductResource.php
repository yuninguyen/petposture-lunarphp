<?php

namespace App\Http\Resources\Api;

use App\Services\ProductSyncService;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Str;

class ProductResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $variant = $this->variants->first();
        $price = $variant?->prices->sortBy('min_quantity')->first();
        $productSlug = $this->defaultUrl?->slug
            ?? $this->urls->firstWhere('default', true)?->slug
            ?? $this->urls->first()?->slug
            ?? $this->translateAttribute('legacy_product_slug')
            ?? (string) $this->id;
        $variantId = (int) ($variant?->id ?? 0);
        $productId = (int) $this->id;

        return [
            'id' => $variantId ?: $productId,
            'productId' => $productId,
            'variantId' => $variantId ?: $productId,
            'slug' => $productSlug,
            'name' => $this->translateAttribute('name'),
            'category' => $this->collections->first()?->translateAttribute('name') ?? 'Shop',
            'categorySlug' => $this->collections->first()?->defaultUrl?->slug ??
                ($this->collections->first() ? Str::slug($this->collections->first()->translateAttribute('name')) : 'categories'),
            'price' => $this->minorToDecimal($price?->getRawOriginal('price')),
            'oldPrice' => $this->minorToDecimal($price?->getRawOriginal('compare_price')),
            'rating' => (float) ($this->translateAttribute('rating') ?: 5),
            'reviews' => (int) ($this->translateAttribute('reviews') ?: 0),
            'image' => ProductSyncService::normalizePublicImageUrl($this->translateAttribute('image_url')),
            'badge' => $this->translateAttribute('badge'),
            'isNew' => $this->translateAttribute('is_new') === '1',
            'description' => $this->translateAttribute('description'),
            'lowStockWarning' => $variant?->stock <= ($variant?->low_stock_threshold ?? 5),
            'backorder' => (bool) $variant?->backorder,
        ];
    }

    private function minorToDecimal(int|string|null $value): ?float
    {
        if ($value === null || $value === '') {
            return null;
        }

        return round(((int) $value) / 100, 2);
    }
}
