<?php

namespace App\Http\Resources\Admin;

use App\Services\Admin\ProductAttributeService;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\DB;
use Lunar\Models\Currency;
use Lunar\Models\ProductVariant;

class ProductVariantResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $currency = Currency::getDefault();
        $price = $currency ? $this->prices
            ->first(fn ($price) => (int) $price->currency_id === (int) $currency->id
                && $price->customer_group_id === null
                && (int) $price->min_quantity === 1) : null;
        $rawPrice = $price?->getRawOriginal('price');
        $attributes = app(ProductAttributeService::class)
            ->definitions($this->product->productType, 'variant', $this->attribute_data ?? collect());

        return [
            'id' => $this->id,
            'product_id' => $this->product_id,
            'sku' => $this->sku ?? '',
            'gtin' => $this->gtin,
            'mpn' => $this->mpn,
            'ean' => $this->ean,
            'stock' => (int) $this->stock,
            'backorder' => (int) $this->backorder,
            'purchasable' => $this->purchasable,
            'unit_quantity' => (int) $this->unit_quantity,
            'quantity_increment' => (int) $this->quantity_increment,
            'min_quantity' => (int) $this->min_quantity,
            'tax_class_id' => $this->tax_class_id,
            'tax_ref' => $this->tax_ref,
            'shippable' => (bool) $this->shippable,
            'length_value' => $this->length_value,
            'length_unit' => $this->length_unit,
            'width_value' => $this->width_value,
            'width_unit' => $this->width_unit,
            'height_value' => $this->height_value,
            'height_unit' => $this->height_unit,
            'weight_value' => $this->weight_value,
            'weight_unit' => $this->weight_unit,
            'base_price' => $rawPrice === null || ! $currency
                ? '0'
                : bcdiv((string) $rawPrice, (string) $currency->factor, $currency->decimal_places),
            'formatted_price' => $price?->price?->formatted(),
            'has_order_history' => $this->has_order_history !== null
                ? (bool) $this->has_order_history
                : DB::table(config('lunar.database.table_prefix').'order_lines')
                    ->where('purchasable_type', ProductVariant::morphName())
                    ->where('purchasable_id', $this->id)
                    ->exists(),
            'option_values' => $this->values->map(fn ($value): array => [
                'option_id' => $value->product_option_id,
                'option_name' => $value->option?->translate('name') ?? '',
                'value_id' => $value->id,
                'value_name' => $value->translate('name') ?? '',
            ])->values()->all(),
            'attributes' => $attributes,
        ];
    }
}
