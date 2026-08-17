<?php

namespace App\Filament\Resources;

use Lunar\Admin\Filament\Resources\TagResource as BaseTagResource;

class TagResource extends BaseTagResource
{
    public static function getNavigationGroup(): ?string
    {
        return __('lunarpanel::global.sections.catalog');
    }

    // Product tags aren't shown on the storefront and the tag input is
    // hidden on the Product form (see ProductResource) — hiding this from
    // the sidebar too since there's nothing left to manage here day-to-day.
    public static function shouldRegisterNavigation(): bool
    {
        return false;
    }
}
