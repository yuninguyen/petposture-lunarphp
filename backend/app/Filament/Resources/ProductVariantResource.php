<?php

namespace App\Filament\Resources;

use Filament\Forms;
use Lunar\Admin\Filament\Resources\ProductVariantResource as BaseProductVariantResource;

class ProductVariantResource extends BaseProductVariantResource
{
    public static function getSkuFormComponent(): Forms\Components\TextInput
    {
        return parent::getSkuFormComponent()->label('SKU');
    }
}
