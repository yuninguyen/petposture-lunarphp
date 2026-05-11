<x-mail::message>
# Order Confirmed — #{{ $order->reference }}

Hi {{ $order->shippingAddress?->first_name ?? 'there' }},

Thank you for your order! We're preparing it for shipment.

<x-mail::table>
| Item | Qty | Price |
|:-----|----:|------:|
@foreach($order->lines->where('type', '!=', 'shipping') as $line)
| {{ $line->description }} | {{ $line->quantity }} | ${{ number_format(($line->total->value ?? 0) / 100, 2) }} |
@endforeach
</x-mail::table>

**Order total: ${{ number_format(($order->total->value ?? 0) / 100, 2) }}**

You can track your order at any time:

<x-mail::button url="{{ config('app.frontend_url') }}/track-order">
Track Order
</x-mail::button>

Thanks,<br>
{{ config('app.name') }}
</x-mail::message>
