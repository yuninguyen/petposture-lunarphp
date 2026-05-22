<?php

namespace App\Filament\Resources;

use Lunar\Admin\Filament\Resources\ProductOptionResource as BaseProductOptionResource;

class ProductOptionResource extends BaseProductOptionResource
{
    public static function getNavigationGroup(): ?string
    {
        return __('lunarpanel::global.sections.catalog');
    }
}
