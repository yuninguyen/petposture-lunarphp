<?php

namespace App\Http\Resources\Api;

use App\Services\InventoryService;
use App\Services\ProductRouteService;
use App\Services\ProductSyncService;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Str;

class ProductResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $variants = $this->variants;
        $defaultVariant = $variants->first();
        $price = $defaultVariant?->prices->sortBy('min_quantity')->first();
        $productId = (int) $this->id;

        $routeService = app(ProductRouteService::class);
        $productSlug = $routeService->slug($this->resource);

        $firstCollection = $this->collections->first();

        $defaultInventory = app(InventoryService::class)->stockSnapshot($defaultVariant);

        return [
            'id' => $productId,
            'variantId' => (int) ($defaultVariant?->id ?? $productId),
            'slug' => $productSlug,
            'name' => $this->translateAttribute('name'),
            'description' => $this->translateAttribute('description'),
            'badge' => $this->translateAttribute('badge'),
            'isNew' => $this->translateAttribute('is_new') === '1',

            // Brand
            'brand' => $this->brand?->name,

            // Pricing
            'price' => $this->minorToDecimal($price?->getRawOriginal('price')),
            'comparePrice' => $this->minorToDecimal($price?->getRawOriginal('compare_price')),

            // Category
            'category' => $firstCollection?->translateAttribute('name') ?? 'Shop',
            'categorySlug' => $routeService->categorySlug($this->resource),

            // Breed-type tags (e.g. "flat-faced", "long-backed") — comma-separated attribute
            'breedTags' => $this->resolveBreedTags(),

            // Solution tags (e.g. "eating-digestion", "mobility-support") — comma-separated attribute
            'solutionTags' => $this->resolveTagList('solution_tags'),

            // Reviews are calculated from approved Review records by the controller.
            // `reviews` is kept alongside `reviewCount` for existing storefront clients.
            'rating' => round((float) ($this->approved_reviews_avg_rating ?? 0), 2),
            'reviews' => (int) ($this->approved_reviews_count ?? 0),
            'reviewCount' => (int) ($this->approved_reviews_count ?? 0),

            // Images — primary image kept as `image` for backwards compat,
            // full gallery added as `images[]`
            'image' => $this->resolvePrimaryImageUrl(),
            'images' => $this->resolveImageGallery(),

            // Inventory (default variant)
            'available' => $defaultInventory['available'],
            'lowStockWarning' => $defaultInventory['lowStockWarning'],
            'backorder' => $defaultInventory['backorder'],
            'stockStatus' => $defaultInventory['stockStatus'],

            // Technical specs — e.g. [{"label":"Material","value":"..."}]
            'specs' => $this->resolveSpecs(),

            // Options — e.g. [{"name":"Size","values":["S","M","L"]}]
            'options' => $this->resolveOptions(),

            // Variants with their selected option values
            'variants' => $variants->map(fn ($v) => $this->formatVariant($v))->values()->all(),

            // Schema.org JSON-LD for SEO (included only on single-product responses)
            'seo' => $this->buildJsonLd($productSlug, $price),
        ];
    }

    // ─── Private helpers ──────────────────────────────────────────────────────

    /**
     * Prefer the WebP conversion when it's been generated (new uploads,
     * or media re-processed via `media-library:regenerate`); fall back to
     * the original file for media uploaded before this conversion existed.
     */
    private function mediaUrl($media): string
    {
        return $media->hasGeneratedConversion('webp')
            ? $media->getUrl('webp')
            : $media->getUrl();
    }

    private function resolvePrimaryImageUrl(): ?string
    {
        // 1. Lunar media collection (uploaded via admin)
        $thumbnail = $this->thumbnail;
        if ($thumbnail) {
            return $this->mediaUrl($thumbnail);
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
                    'id' => $media->id,
                    'src' => $this->mediaUrl($media),
                    'alt' => $media->name ?? $this->translateAttribute('name'),
                ];
            }

            return $images;
        }

        // Fallback: wrap the primary image as a single-item gallery
        $primary = $this->resolvePrimaryImageUrl();
        if ($primary) {
            $images[] = [
                'id' => null,
                'src' => $primary,
                'alt' => $this->translateAttribute('name'),
            ];
        }

        return $images;
    }

    private function resolveBreedTags(): array
    {
        return $this->resolveTagList('breed_tags');
    }

    private function resolveTagList(string $attributeHandle): array
    {
        $raw = $this->translateAttribute($attributeHandle);

        if (! $raw) {
            return [];
        }

        return collect(explode(',', $raw))
            ->map(fn ($tag) => Str::slug(trim($tag)))
            ->filter()
            ->values()
            ->all();
    }

    private function resolveSpecs(): array
    {
        $specHandles = [
            'material' => 'Material',
            'weight' => 'Weight',
            'dimensions' => 'Dimensions',
            'care_instructions' => 'Care Instructions',
            'warranty' => 'Warranty',
        ];

        $specs = [];
        foreach ($specHandles as $handle => $label) {
            $value = $this->translateAttribute($handle);
            if ($value) {
                if (is_array($value) || is_object($value)) {
                    $value = json_encode($value);
                }
                $specs[] = ['label' => $label, 'value' => (string) $value];
            }
        }

        // Fallback to variant weight and dimensions if not set as attributes
        $defaultVariant = $this->variants->first();
        if ($defaultVariant) {
            $hasWeight = collect($specs)->contains('label', 'Weight');
            if (!$hasWeight && $defaultVariant->weight_value) {
                $specs[] = [
                    'label' => 'Weight',
                    'value' => $defaultVariant->weight_value . ' ' . ($defaultVariant->weight_unit ?: 'kg')
                ];
            }

            $hasDimensions = collect($specs)->contains('label', 'Dimensions');
            if (!$hasDimensions) {
                $dims = [];
                if ($defaultVariant->length_value) $dims[] = $defaultVariant->length_value;
                if ($defaultVariant->width_value) $dims[] = $defaultVariant->width_value;
                if ($defaultVariant->height_value) $dims[] = $defaultVariant->height_value;
                if (count($dims) > 0) {
                    $specs[] = [
                        'label' => 'Dimensions',
                        'value' => implode(' x ', $dims) . ' ' . ($defaultVariant->length_unit ?: 'cm')
                    ];
                }
            }
        }

        return $specs;
    }

    private function resolveOptions(): array
    {
        if (! $this->relationLoaded('productOptions')) {
            return [];
        }

        return $this->productOptions->map(fn ($option) => [
            'id' => $option->id,
            'name' => $option->translate('name'),
            'handle' => $option->handle ?? Str::slug($option->translate('name')),
            'values' => $option->values->map(fn ($v) => [
                'id' => $v->id,
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
                    'option' => $optionName,
                    'valueId' => $value->id,
                    'value' => $value->translate('name'),
                ];
            }
        }

        // Per-variant image (primary image from variant media)
        $variantImage = null;
        if ($v->relationLoaded('images') && $v->images->isNotEmpty()) {
            $primary = $v->images->first(fn ($m) => (bool) $m->pivot?->primary) ?? $v->images->first();
            $variantImage = $primary ? $this->mediaUrl($primary) : null;
        }

        $inventory = app(InventoryService::class)->stockSnapshot($v);

        return [
            'id' => (int) $v->id,
            'sku' => $v->sku,
            'name' => $v->translateAttribute('name'),
            'price' => $this->minorToDecimal($variantPrice?->getRawOriginal('price')),
            'comparePrice' => $this->minorToDecimal($variantPrice?->getRawOriginal('compare_price')),
            'stock' => $inventory['stock'],
            'available' => $inventory['available'],
            'lowStockWarning' => $inventory['lowStockWarning'],
            'backorder' => $inventory['backorder'],
            'stockStatus' => $inventory['stockStatus'],
            'image' => $variantImage,
            'options' => $selectedOptions,
        ];
    }

    private function buildJsonLd(string $slug, mixed $price): array
    {
        $name = $this->translateAttribute('name') ?? '';
        $description = $this->translateAttribute('description') ?? '';
        $imageUrl = $this->resolvePrimaryImageUrl();
        $priceValue = $this->minorToDecimal($price?->getRawOriginal('price'));
        $sku = $this->variants->first()?->sku;
        $productUrl = url(app(ProductRouteService::class)->path($this->resource));

        $ld = [
            '@context' => 'https://schema.org',
            '@type' => 'Product',
            'name' => $name,
            'url' => $productUrl,
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
                '@type' => 'Offer',
                'price' => $priceValue,
                'priceCurrency' => 'USD',
                'availability' => 'https://schema.org/'.($this->variants->first()?->stock > 0 ? 'InStock' : 'OutOfStock'),
                'url' => $productUrl,
            ];
        }

        $rating = round((float) ($this->approved_reviews_avg_rating ?? 0), 2);
        $reviewCount = (int) ($this->approved_reviews_count ?? 0);
        if ($rating > 0 && $reviewCount > 0) {
            $ld['aggregateRating'] = [
                '@type' => 'AggregateRating',
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
