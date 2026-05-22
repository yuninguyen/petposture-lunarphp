<?php

namespace App\Filament\Resources;

use Lunar\Admin\Filament\Resources\CustomerGroupResource as BaseCustomerGroupResource;

class CustomerGroupResource extends BaseCustomerGroupResource
{
    public static function getNavigationGroup(): ?string
    {
        return __('lunarpanel::global.sections.sales');
    }

    public static function getNavigationSort(): ?int
    {
        return 2;
    }
}
