<x-mail::message>
# Payment Confirmed ✓

Hi {{ $order->shippingAddress?->first_name ?? 'there' }},

We've received your payment for order **#{{ $order->reference }}**. Your order is now in our queue and will be prepared shortly.

**Order total:** ${{ number_format(($order->total->value ?? 0) / 100, 2) }}

<x-mail::table>
| Item | Qty | Price |
|:-----|----:|------:|
@foreach($order->lines->where('type', '!=', 'shipping') as $line)
| {{ $line->description }} | {{ $line->quantity }} | ${{ number_format(($line->total->value ?? 0) / 100, 2) }} |
@endforeach
</x-mail::table>

<x-mail::button url="{{ config('app.frontend_url') }}/track-order">
Track Your Order
</x-mail::button>

Thanks,<br>
{{ config('app.name') }}
</x-mail::message>
