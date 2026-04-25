<?php

return [
    'tax' => [
        'provider' => env('SALES_TAX_PROVIDER', 'state-average'),
        'fallback_provider' => env('SALES_TAX_FALLBACK_PROVIDER', 'state-average'),
    ],
];
