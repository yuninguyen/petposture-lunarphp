<?php

namespace App\Support\Orders;

class VariantLabel
{
    /**
     * "Size: M · Color: Black" for an order line's variant, or null when the line has no
     * variant options (shipping lines, deleted variants, single default-variant products).
     */
    public static function forLine(mixed $line): ?string
    {
        if (($line->type ?? null) === 'shipping') {
            return null;
        }

        $purchasable = $line->getRelationValue('purchasable');

        if (! is_object($purchasable) || ! method_exists($purchasable, 'values')) {
            return null;
        }

        $label = $purchasable->values
            ->map(function ($value): string {
                $option = $value->option?->translate('name');
                $name = $value->translate('name');

                return $option ? "{$option}: {$name}" : (string) $name;
            })
            ->filter()
            ->implode(' · ');

        return $label !== '' ? $label : null;
    }
}
