<?php

namespace App\Filament\Resources\ProductResource\Pages;

use App\Filament\Resources\ProductResource;
use Lunar\Admin\Filament\Resources\ProductResource\Pages\ListProducts as BaseListProducts;

class ListProducts extends BaseListProducts
{
    protected static string $resource = ProductResource::class;
}
