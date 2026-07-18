<x-mail::message :message="$message ?? null">
# We're Preparing Your Order 📦

Hi {{ $order->shippingAddress?->first_name ?? 'there' }},

Great news — order **#{{ $order->reference }}** is now being processed by our team. We'll notify you as soon as it ships.

**Estimated dispatch:** 1–2 business days

<x-mail::button url="{{ config('app.frontend_url') }}/track-order">
Track Your Order
</x-mail::button>

Thanks,<br>
{{ config('app.name') }}
</x-mail::message>
