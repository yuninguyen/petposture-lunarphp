<?php

namespace App\Filament\Resources;

use Lunar\Admin\Filament\Resources\CustomerResource as BaseCustomerResource;

class CustomerResource extends BaseCustomerResource
{
    public static function getNavigationSort(): ?int
    {
        return 3;
    }
}
