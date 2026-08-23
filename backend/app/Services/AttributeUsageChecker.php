<?php

namespace App\Services;

use Lunar\Models\Product;
use Lunar\Models\ProductVariant;

class AttributeUsageChecker
{
    public function hasNonNullValue(string $target, string $handle, int $productTypeId): bool
    {
        $query = $target === 'product_variant'
            ? ProductVariant::query()
                ->withTrashed()
                ->whereHas('product', fn ($query) => $query
                    ->withTrashed()
                    ->where('product_type_id', $productTypeId))
            : Product::query()
                ->withTrashed()
                ->where('product_type_id', $productTypeId);

        foreach ($query->cursor() as $record) {
            $attributeData = json_decode($record->getRawOriginal('attribute_data') ?? '{}', true);

            if (! is_array($attributeData) || ! array_key_exists($handle, $attributeData)) {
                continue;
            }

            $item = $attributeData[$handle];
            $value = is_array($item) && array_key_exists('value', $item) ? $item['value'] : $item;

            if ($value !== null) {
                return true;
            }
        }

        return false;
    }
}
