<?php

namespace App\Http\Resources\Admin;

use App\Models\SeoMetadata;
use App\Services\Admin\ProductAttributeService;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\DB;
use Lunar\Models\Currency;
use Lunar\Models\Product;
use Lunar\Models\ProductVariant;
use Lunar\Models\TaxClass;

class ProductResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $currency = Currency::getDefault();
        $attributeService = app(ProductAttributeService::class);
        $seo = SeoMetadata::query()
            ->where('seoable_type', Product::class)
            ->where('seoable_id', $this->id)
            ->first();
        $historyVariantIds = DB::table(config('lunar.database.table_prefix').'order_lines')
            ->where('purchasable_type', ProductVariant::morphName())
            ->whereIn('purchasable_id', $this->variants->pluck('id'))
            ->pluck('purchasable_id')
            ->map(fn ($id) => (int) $id)
            ->all();
        $this->variants->each(fn ($variant) => $variant->setAttribute(
            'has_order_history',
            in_array($variant->id, $historyVariantIds, true)
        ));

        return [
            'id' => $this->id,
            'slug' => $this->defaultUrl?->slug,
            'status' => $this->status,
            'brand_id' => $this->brand_id,
            'product_type_id' => $this->product_type_id,
            'product_type' => [
                'id' => $this->productType->id,
                'name' => $this->productType->name,
            ],
            'brand' => $this->brand ? ['id' => $this->brand->id, 'name' => $this->brand->name] : null,
            'has_variants' => (bool) $this->has_variants,
            'product_attributes' => $attributeService
                ->definitions($this->productType, 'product', $this->attribute_data ?? collect()),
            'product_options' => $this->productOptions->map(fn ($option): array => [
                'id' => $option->id,
                'name' => $option->translate('name') ?? '',
                'shared' => (bool) $option->shared,
                'values' => $option->values
                    ->filter(fn ($value): bool => ($value->meta['admin_active'] ?? true) !== false)
                    ->map(fn ($value): array => [
                        'id' => $value->id,
                        'name' => $value->translate('name') ?? '',
                    ])->values()->all(),
            ])->values()->all(),
            'variants' => ProductVariantResource::collection($this->variants),
            'collection_ids' => $this->collections->pluck('id')->map(fn ($id) => (int) $id)->values()->all(),
            'seo' => [
                'title' => $seo?->title ?? '',
                'description' => $seo?->description ?? '',
                'keyphrase' => $seo?->keyphrase ?? '',
                'og_title' => $seo?->og_title ?? '',
                'og_description' => $seo?->og_description ?? '',
                'og_image' => $seo?->og_image,
                'canonical_url' => $seo?->canonical_url ?? '',
                'is_indexable' => $seo?->is_indexable ?? true,
                'is_followable' => $seo?->is_followable ?? true,
            ],
            'media' => $this->images->map(function ($media): array {
                $curatorMediaId = $media->getCustomProperty('curator_media_id');

                return [
                    'id' => (string) ($curatorMediaId ?: $media->id),
                    'url' => $media->getUrl('small') ?: $media->getUrl(),
                    'source' => $curatorMediaId ? 'curator' : 'spatie',
                    'alt' => $media->getCustomProperty('alt') ?: '',
                ];
            })->values()->all(),
            'default_currency' => $currency ? [
                'id' => $currency->id,
                'code' => $currency->code,
                'decimal_places' => $currency->decimal_places,
                'factor' => (int) $currency->factor,
            ] : null,
            'tax_classes' => TaxClass::query()->orderBy('name')->get()->map(fn (TaxClass $taxClass): array => [
                'id' => $taxClass->id,
                'name' => $taxClass->name,
            ])->values()->all(),
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }
}
