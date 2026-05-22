<?php

namespace App\Filament\Resources;

use Lunar\Admin\Filament\Resources\AttributeGroupResource as BaseAttributeGroupResource;

class AttributeGroupResource extends BaseAttributeGroupResource
{
    public static function getNavigationGroup(): ?string
    {
        return __('lunarpanel::global.sections.catalog');
    }
}
