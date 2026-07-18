<x-mail::message :message="$message ?? null">
# Order Cancelled — #{{ $order->reference }}

Hi {{ $order->shippingAddress?->first_name ?? 'there' }},

Your order **#{{ $order->reference }}** has been cancelled.

If you were charged, a refund will be processed within 5–10 business days.

If you have questions, please contact our support team.

<x-mail::button url="{{ config('app.frontend_url') }}/contact">
Contact Support
</x-mail::button>

Thanks,<br>
{{ config('app.name') }}
</x-mail::message>
