<?php

namespace App\Services;

use App\Models\Product as LegacyProduct;
use App\Models\ProductSyncMapping;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Lunar\FieldTypes\Text;
use Lunar\Models\Channel;
use Lunar\Models\Collection;
use Lunar\Models\CollectionGroup;
use Lunar\Models\Currency;
use Lunar\Models\CustomerGroup;
use Lunar\Models\Price;
use Lunar\Models\Product as LunarProduct;
use Lunar\Models\ProductType;
use Lunar\Models\ProductVariant as LunarProductVariant;
use Lunar\Models\TaxClass;
use Lunar\Models\Url;

class ProductSyncService
{
    public static function normalizePublicImageUrl(?string $value, string $fallback = '/assets/Pug-Dog-Bed.jpg'): string
    {
        $value = trim((string) $value);

        if ($value === '') {
            return $fallback;
        }

        if (str_starts_with($value, 'http://') || str_starts_with($value, 'https://') || str_starts_with($value, '/assets/')) {
            return $value;
        }

        $appUrl = rtrim((string) config('app.url', 'http://localhost:8000'), '/');

        if (str_starts_with($value, '/storage/') || str_starts_with($value, 'storage/')) {
            return $appUrl.'/'.ltrim($value, '/');
        }

        return $appUrl.'/storage/'.ltrim($value, '/');
    }

    public function syncFromLegacy(LegacyProduct $legacyProduct): ?LunarProduct
    {
        $productType = ProductType::first();
        $currency = Currency::getDefault() ?? Currency::query()->where('default', true)->first() ?? Currency::first();
        $taxClass = TaxClass::first();

        if (! $productType || ! $currency || ! $taxClass) {
            return null;
        }

        $imageUrl = $this->syncLegacyImageField($legacyProduct);

        return DB::transaction(function () use ($legacyProduct, $productType, $currency, $taxClass, $imageUrl) {
            $lunarProduct = $this->findOrCreateLunarProduct($legacyProduct, $productType, $imageUrl);
            $variant = $this->syncVariant($legacyProduct, $lunarProduct, $taxClass);
            $variantMorphClass = $variant->getMorphClass();

            Price::updateOrCreate(
                [
                    'customer_group_id' => null,
                    'priceable_type' => $variantMorphClass,
                    'priceable_id' => $variant->id,
                    'currency_id' => $currency->id,
                    'min_quantity' => 1,
                ],
                [
                    'price' => (int) round(((float) $legacyProduct->price) * 100),
                    'compare_price' => $legacyProduct->old_price ? (int) round(((float) $legacyProduct->old_price) * 100) : null,
                ]
            );

            $this->syncDefaultUrl($legacyProduct, $lunarProduct);
            $this->syncCategoryCollection($legacyProduct, $lunarProduct);
            $this->syncAvailability($lunarProduct);
            $this->syncMapping($legacyProduct, $lunarProduct);

            return $lunarProduct->fresh(['defaultUrl', 'collections.defaultUrl', 'variants.prices']);
        });
    }

    public function archiveSyncedProduct(LegacyProduct $legacyProduct): void
    {
        $mapping = ProductSyncMapping::query()
            ->with('lunarProduct')
            ->where('legacy_product_id', $legacyProduct->id)
            ->first();

        if (! $mapping?->lunarProduct) {
            return;
        }

        $mapping->lunarProduct->update([
            'status' => 'draft',
        ]);
    }

    private function syncLegacyImageField(LegacyProduct $legacyProduct): string
    {
        $mediaUrl = $legacyProduct->getFirstMediaUrl('product-images');
        $normalizedImageUrl = self::normalizePublicImageUrl($mediaUrl ?: $legacyProduct->image_url);

        if ($legacyProduct->image_url !== $normalizedImageUrl) {
            $legacyProduct->forceFill([
                'image_url' => $normalizedImageUrl,
            ])->saveQuietly();
        }

        return $normalizedImageUrl;
    }

    private function findOrCreateLunarProduct(LegacyProduct $legacyProduct, ProductType $productType, string $imageUrl): LunarProduct
    {
        $mapping = ProductSyncMapping::query()
            ->with('lunarProduct')
            ->where('legacy_product_id', $legacyProduct->id)
            ->first();

        $lunarProduct = $mapping?->lunarProduct;

        if (! $lunarProduct) {
            $existingUrl = Url::query()
                ->where('slug', $legacyProduct->slug)
                ->where('element_type', LunarProduct::class)
                ->first();

            $lunarProduct = $existingUrl ? LunarProduct::find($existingUrl->element_id) : null;
        }

        if (! $lunarProduct) {
            $lunarProduct = LunarProduct::create([
                'product_type_id' => $productType->id,
                'status' => $legacyProduct->is_active ? 'published' : 'draft',
                'attribute_data' => [],
            ]);
        }

        $lunarProduct->update([
            'product_type_id' => $productType->id,
            'status' => $legacyProduct->is_active ? 'published' : 'draft',
            'attribute_data' => [
                'name' => new Text($legacyProduct->name),
                'description' => new Text($legacyProduct->description ?? ''),
                'image_url' => new Text($imageUrl),
                'badge' => new Text($legacyProduct->badge ?? ''),
                'is_new' => new Text($legacyProduct->is_new ? '1' : '0'),
                'rating' => new Text((string) ($legacyProduct->rating ?? 5)),
                'reviews' => new Text((string) ($legacyProduct->reviews_count ?? 0)),
                'legacy_product_id' => new Text((string) $legacyProduct->id),
                'legacy_product_slug' => new Text($legacyProduct->slug),
                'legacy_product_source' => new Text('legacy-product'),
                'legacy_product_updated_at' => new Text(optional($legacyProduct->updated_at)->toIso8601String() ?? now()->toIso8601String()),
            ],
        ]);

        return $lunarProduct;
    }

    private function syncVariant(LegacyProduct $legacyProduct, LunarProduct $lunarProduct, TaxClass $taxClass): LunarProductVariant
    {
        $variant = $lunarProduct->variants()->orderBy('id')->first() ?? new LunarProductVariant([
            'product_id' => $lunarProduct->id,
        ]);

        $variant->fill([
            'sku' => $this->defaultVariantSku($legacyProduct),
            'stock' => (int) ($legacyProduct->stock_quantity ?? 0),
            'tax_class_id' => $taxClass->id,
            'shippable' => true,
            'backorder' => false,
        ]);

        $variant->save();

        return $variant;
    }

    private function syncDefaultUrl(LegacyProduct $legacyProduct, LunarProduct $lunarProduct): void
    {
        Url::updateOrCreate(
            [
                'element_type' => LunarProduct::class,
                'element_id' => $lunarProduct->id,
                'default' => true,
            ],
            [
                'slug' => $legacyProduct->slug,
                'language_id' => 1,
            ]
        );
    }

    private function syncCategoryCollection(LegacyProduct $legacyProduct, LunarProduct $lunarProduct): void
    {
        if (! $legacyProduct->category) {
            return;
        }

        $collectionGroup = CollectionGroup::first();
        if (! $collectionGroup) {
            return;
        }

        $collectionSlug = $legacyProduct->category->slug ?: Str::slug($legacyProduct->category->name);

        $existingCollectionUrl = Url::query()
            ->where('slug', $collectionSlug)
            ->where('element_type', Collection::class)
            ->first();

        $collection = $existingCollectionUrl ? Collection::find($existingCollectionUrl->element_id) : null;

        if (! $collection) {
            $collection = Collection::create([
                'collection_group_id' => $collectionGroup->id,
                'attribute_data' => [
                    'name' => new Text($legacyProduct->category->name),
                ],
            ]);
        } else {
            $collection->update([
                'attribute_data' => [
                    'name' => new Text($legacyProduct->category->name),
                ],
            ]);
        }

        Url::updateOrCreate(
            [
                'element_type' => Collection::class,
                'element_id' => $collection->id,
                'default' => true,
            ],
            [
                'slug' => $collectionSlug,
                'language_id' => 1,
            ]
        );

        $lunarProduct->collections()->syncWithoutDetaching([$collection->id]);
    }

    private function syncAvailability(LunarProduct $lunarProduct): void
    {
        $channel = Channel::getDefault() ?? Channel::first();
        if ($channel) {
            $lunarProduct->channels()->syncWithPivotValues([$channel->id], [
                'enabled' => true,
                'starts_at' => now(),
            ], false);
        }

        $customerGroup = CustomerGroup::query()->where('default', true)->first() ?? CustomerGroup::first();
        if ($customerGroup) {
            $lunarProduct->customerGroups()->syncWithPivotValues([$customerGroup->id], [
                'enabled' => true,
                'starts_at' => now(),
            ], false);
        }
    }

    private function syncMapping(LegacyProduct $legacyProduct, LunarProduct $lunarProduct): void
    {
        ProductSyncMapping::updateOrCreate(
            [
                'legacy_product_id' => $legacyProduct->id,
            ],
            [
                'lunar_product_id' => $lunarProduct->id,
                'legacy_slug' => $legacyProduct->slug,
                'synced_at' => now(),
            ]
        );
    }

    private function defaultVariantSku(LegacyProduct $legacyProduct): string
    {
        return 'legacy-product-'.$legacyProduct->id.'-default';
    }
}
