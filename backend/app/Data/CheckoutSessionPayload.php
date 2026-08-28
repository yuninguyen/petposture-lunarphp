<?php

namespace App\Data;

use Illuminate\Support\Arr;

final class CheckoutSessionPayload
{
    public const ADDRESS_FIELDS = [
        'email',
        'first_name',
        'last_name',
        'company',
        'line_one',
        'line_two',
        'city',
        'state',
        'postcode',
        'country',
        'phone',
    ];

    public static function sanitize(array $payload, bool $includeToken = false): array
    {
        if (isset($payload['items'])) {
            $payload['items'] = array_map(
                static fn (array $item): array => Arr::only($item, ['variantId', 'quantity']),
                $payload['items'],
            );
        }

        foreach (['shipping', 'billing'] as $addressKey) {
            if (isset($payload[$addressKey])) {
                $payload[$addressKey] = Arr::only($payload[$addressKey], self::ADDRESS_FIELDS);
            }
        }

        $fields = [
            'items',
            'shipping',
            'billing_same_as_shipping',
            'billing',
            'shipping_method',
            'payment_method',
            'coupon_code',
            'customer_note',
        ];

        if ($includeToken) {
            array_unshift($fields, 'token');
        }

        return Arr::only($payload, $fields);
    }
}
