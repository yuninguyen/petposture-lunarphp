<x-mail::message>
# Payment Failed — Action Required

Hi {{ $order->shippingAddress?->first_name ?? 'there' }},

Unfortunately, the payment for order **#{{ $order->reference }}** could not be processed.

**Order total:** ${{ number_format(($order->total->value ?? 0) / 100, 2) }}

Please retry your payment to complete your order. Your cart items are still saved.

<x-mail::button url="{{ config('app.frontend_url') }}/checkout">
Retry Payment
</x-mail::button>

If you continue to have issues, please contact your bank or reach out to our support team.

<x-mail::button url="{{ config('app.frontend_url') }}/contact">
Contact Support
</x-mail::button>

Thanks,<br>
{{ config('app.name') }}
</x-mail::message>
