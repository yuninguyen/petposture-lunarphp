<?php

namespace App\Filament\Resources\OrderResource\Pages;

use App\Filament\Resources\OrderResource;
use App\Services\CheckoutService;
use Filament\Notifications\Notification;
use Filament\Resources\Pages\CreateRecord;
use Illuminate\Database\Eloquent\Model;

class CreateOrder extends CreateRecord
{
    protected static string $resource = OrderResource::class;

    protected function getRedirectUrl(): string
    {
        return $this->getResource()::getUrl('index');
    }

    protected function handleRecordCreation(array $data): Model
    {
        $billingInput = $data['billing_same_as_shipping']
            ? null
            : [
                'first_name' => $data['billing_first_name'] ?? '',
                'last_name'  => $data['billing_last_name'] ?? '',
                'line_one'   => $data['billing_line_one'] ?? '',
                'line_two'   => $data['billing_line_two'] ?? null,
                'city'       => $data['billing_city'] ?? '',
                'state'      => $data['billing_state'] ?? '',
                'postcode'   => $data['billing_postcode'] ?? '',
                'country'    => $data['billing_country'] ?? 'US',
            ];

        $payload = [
            'items' => collect($data['items'])->map(fn($i) => [
                'variantId' => (int) $i['variant_id'],
                'quantity'  => (int) $i['quantity'],
            ])->toArray(),
            'shipping' => [
                'email'      => $data['email'],
                'first_name' => $data['shipping_first_name'],
                'last_name'  => $data['shipping_last_name'] ?? '',
                'phone'      => $data['phone'] ?? '',
                'line_one'   => $data['line_one'],
                'line_two'   => $data['line_two'] ?? null,
                'city'       => $data['city'],
                'state'      => $data['state'] ?? '',
                'postcode'   => $data['postcode'] ?? '',
                'country'    => $data['country'] ?? 'US',
            ],
            'billing_same_as_shipping' => $data['billing_same_as_shipping'] ?? true,
            'billing'           => $billingInput,
            'payment_method'    => $data['payment_method'] ?? 'cod',
            'shipping_method'   => $data['shipping_method'] ?? 'standard',
            'coupon_code'       => $data['coupon_code'] ?? null,
            'customer_note'     => $data['customer_note'] ?? null,
            'internal_note'     => $data['internal_note'] ?? null,
            'shipping_fee_override' => isset($data['shipping_fee_override']) && $data['shipping_fee_override'] !== null && $data['shipping_fee_override'] !== ''
                ? (int) round((float) $data['shipping_fee_override'] * 100)
                : null,
            'created_by_admin'  => true,
        ];

        $order = app(CheckoutService::class)->placeOrder($payload);

        Notification::make()
            ->title(__('Order created successfully'))
            ->body(__('Reference: ') . $order->reference)
            ->success()
            ->send();

        return $order;
    }
}
