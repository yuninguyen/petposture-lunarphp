<?php

namespace App\Http\Resources\Api;

use App\Services\InventoryService;
use App\Services\ProductSyncService;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Str;

class ProductResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $variants     = $this->variants;
        $defaultVariant = $variants->first();
        $price        = $defaultVariant?->prices->sortBy('min_quantity')->first();
        $productId    = (int) $this->id;

        $productSlug = $this->defaultUrl?->slug
            ?? $this->urls->firstWhere('default', true)?->slug
            ?? $this->urls->first()?->slug
            ?? $this->translateAttribute('legacy_product_slug')
            ?? (string) $productId;

        $firstCollection = $this->collections->first();

        $defaultInventory = app(InventoryService::class)->stockSnapshot($defaultVariant);

        return [
            'id'            => $productId,
            'variantId'     => (int) ($defaultVariant?->id ?? $productId),
            'slug'          => $productSlug,
            'name'          => $this->translateAttribute('name'),
            'description'   => $this->translateAttribute('description'),
            'badge'         => $this->translateAttribute('badge'),
            'isNew'         => $this->translateAttribute('is_new') === '1',

            // Pricing
            'price'         => $this->minorToDecimal($price?->getRawOriginal('price')),
            'comparePrice'  => $this->minorToDecimal($price?->getRawOriginal('compare_price')),

            // Category
            'category'      => $firstCollection?->translateAttribute('name') ?? 'Shop',
            'categorySlug'  => $firstCollection?->defaultUrl?->slug
                ?? ($firstCollection ? Str::slug($firstCollection->translateAttribute('name')) : 'categories'),

            // Reviews (from attributes until real aggregate is built)
            'rating'        => (float) ($this->translateAttribute('rating') ?: 5),
            'reviewCount'   => (int) ($this->translateAttribute('reviews') ?: 0),

            // Images — primary image kept as `image` for backwards compat,
            // full gallery added as `images[]`
            'image'         => $this->resolvePrimaryImageUrl(),
            'images'        => $this->resolveImageGallery(),

            // Inventory (default variant)
            'available'     => $defaultInventory['available'],
            'lowStockWarning' => $defaultInventory['lowStockWarning'],
            'backorder'     => $defaultInventory['backorder'],
            'stockStatus'   => $defaultInventory['stockStatus'],

            // Options — e.g. [{"name":"Size","values":["S","M","L"]}]
            'options'       => $this->resolveOptions(),

            // Variants with their selected option values
            'variants'      => $variants->map(fn ($v) => $this->formatVariant($v))->values()->all(),

            // Schema.org JSON-LD for SEO (included only on single-product responses)
            'seo' => $this->buildJsonLd($productSlug, $price),
        ];
    }

    // ─── Private helpers ──────────────────────────────────────────────────────

    private function resolvePrimaryImageUrl(): ?string
    {
        // 1. Lunar media collection (uploaded via admin)
        $thumbnail = $this->thumbnail;
        if ($thumbnail) {
            return $thumbnail->getUrl();
        }

        // 2. Legacy synced image URL stored as attribute
        $legacyUrl = $this->translateAttribute('image_url');
        if ($legacyUrl) {
            return ProductSyncService::normalizePublicImageUrl($legacyUrl);
        }

        return null;
    }

    private function resolveImageGallery(): array
    {
        $images = [];

        // Lunar media images (product gallery)
        if ($this->relationLoaded('images') && $this->images->isNotEmpty()) {
            foreach ($this->images as $media) {
                $images[] = [
                    'id'  => $media->id,
                    'src' => $media->getUrl(),
                    'alt' => $media->name ?? $this->translateAttribute('name'),
                ];
            }

            return $images;
        }

        // Fallback: wrap the primary image as a single-item gallery
        $primary = $this->resolvePrimaryImageUrl();
        if ($primary) {
            $images[] = [
                'id'  => null,
                'src' => $primary,
                'alt' => $this->translateAttribute('name'),
            ];
        }

        return $images;
    }

    private function resolveOptions(): array
    {
        if (! $this->relationLoaded('productOptions')) {
            return [];
        }

        return $this->productOptions->map(fn ($option) => [
            'id'     => $option->id,
            'name'   => $option->translate('name'),
            'handle' => $option->handle ?? Str::slug($option->translate('name')),
            'values' => $option->values->map(fn ($v) => [
                'id'   => $v->id,
                'name' => $v->translate('name'),
            ])->values()->all(),
        ])->values()->all();
    }

    private function formatVariant($v): array
    {
        $variantPrice = $v->prices->sortBy('min_quantity')->first();

        // Collect selected option values for this variant
        $selectedOptions = [];
        if ($v->relationLoaded('values')) {
            foreach ($v->values as $value) {
                $optionName = $value->relationLoaded('option')
                    ? $value->option->translate('name')
                    : null;

                $selectedOptions[] = [
                    'option'   => $optionName,
                    'valueId'  => $value->id,
                    'value'    => $value->translate('name'),
                ];
            }
        }

        // Per-variant image (primary image from variant media)
        $variantImage = null;
        if ($v->relationLoaded('images') && $v->images->isNotEmpty()) {
            $primary = $v->images->first(fn ($m) => (bool) $m->pivot?->primary) ?? $v->images->first();
            $variantImage = $primary?->getUrl();
        }

        $inventory = app(InventoryService::class)->stockSnapshot($v);

        return [
            'id'             => (int) $v->id,
            'sku'            => $v->sku,
            'name'           => $v->translateAttribute('name'),
            'price'          => $this->minorToDecimal($variantPrice?->getRawOriginal('price')),
            'comparePrice'   => $this->minorToDecimal($variantPrice?->getRawOriginal('compare_price')),
            'stock'          => $inventory['stock'],
            'available'      => $inventory['available'],
            'lowStockWarning'=> $inventory['lowStockWarning'],
            'backorder'      => $inventory['backorder'],
            'stockStatus'    => $inventory['stockStatus'],
            'image'          => $variantImage,
            'options'        => $selectedOptions,
        ];
    }

    private function buildJsonLd(string $slug, mixed $price): array
    {
        $name        = $this->translateAttribute('name') ?? '';
        $description = $this->translateAttribute('description') ?? '';
        $imageUrl    = $this->resolvePrimaryImageUrl();
        $priceValue  = $this->minorToDecimal($price?->getRawOriginal('price'));
        $sku         = $this->variants->first()?->sku;

        $ld = [
            '@context' => 'https://schema.org',
            '@type'    => 'Product',
            'name'     => $name,
            'url'      => url('/products/' . $slug),
        ];

        if ($description) {
            $ld['description'] = $description;
        }

        if ($imageUrl) {
            $ld['image'] = $imageUrl;
        }

        if ($sku) {
            $ld['sku'] = $sku;
        }

        if ($priceValue !== null) {
            $ld['offers'] = [
                '@type'         => 'Offer',
                'price'         => $priceValue,
                'priceCurrency' => 'USD',
                'availability'  => 'https://schema.org/' . ($this->variants->first()?->stock > 0 ? 'InStock' : 'OutOfStock'),
                'url'           => url('/products/' . $slug),
            ];
        }

        $rating = (float) ($this->translateAttribute('rating') ?: 0);
        $reviewCount = (int) ($this->translateAttribute('reviews') ?: 0);
        if ($rating > 0 && $reviewCount > 0) {
            $ld['aggregateRating'] = [
                '@type'       => 'AggregateRating',
                'ratingValue' => $rating,
                'reviewCount' => $reviewCount,
            ];
        }

        return $ld;
    }

    private function minorToDecimal(int|string|null $value): ?float
    {
        if ($value === null || $value === '') {
            return null;
        }

        return round(((int) $value) / 100, 2);
    }
}
