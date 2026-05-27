<?php

return [
    'tax' => [
        'provider' => env('SALES_TAX_PROVIDER', 'state-average'),
        'fallback_provider' => env('SALES_TAX_FALLBACK_PROVIDER', 'state-average'),
    ],

    'payment' => [
        'failure_alert_threshold' => (int) env('PAYMENT_FAILURE_ALERT_THRESHOLD', 3),
    ],
];
