<?php

use App\Base\ProductMediaDefinitions;
use Lunar\Base\StandardMediaDefinitions;

return [

    'definitions' => [
        'asset' => StandardMediaDefinitions::class,
        'brand' => StandardMediaDefinitions::class,
        'collection' => StandardMediaDefinitions::class,
        'product' => ProductMediaDefinitions::class,
        'product_variant' => ProductMediaDefinitions::class,
        'product-option' => StandardMediaDefinitions::class,
        'product-option-value' => StandardMediaDefinitions::class,
    ],

    'collection' => 'images',

    'fallback' => [
        'url' => env('FALLBACK_IMAGE_URL', null),
        'path' => env('FALLBACK_IMAGE_PATH', null),
    ],

];
