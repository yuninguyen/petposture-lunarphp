<?php

namespace App\Filament\Resources\CustomerResource\Pages;

use App\Filament\Resources\CustomerResource;
use Lunar\Admin\Filament\Resources\CustomerResource\Pages\ListCustomers as BaseListCustomers;

class ListCustomers extends BaseListCustomers
{
    protected static string $resource = CustomerResource::class;
}
