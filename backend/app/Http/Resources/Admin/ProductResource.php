<?php

namespace App\Http\Resources\Admin;

use App\Services\Admin\ProductAttributeService;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Lunar\Models\Currency;
use Lunar\Models\TaxClass;

class ProductResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $currency = Currency::getDefault();
        $attributeService = app(ProductAttributeService::class);

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
            'variants' => ProductVariantResource::collection($this->variants),
            'collection_ids' => $this->collections->pluck('id')->map(fn ($id) => (int) $id)->values()->all(),
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
