<?php

namespace App\Filament\Resources;

use Lunar\Admin\Filament\Resources\TagResource as BaseTagResource;

class TagResource extends BaseTagResource
{
    public static function getNavigationGroup(): ?string
    {
        return __('lunarpanel::global.sections.catalog');
    }
}
