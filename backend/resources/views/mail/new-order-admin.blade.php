<x-mail::message :message="$message ?? null">
# New Order Received — #{{ $order->reference }}

A new order has been placed on {{ config('app.name') }}.

**Customer:** {{ $order->shippingAddress?->first_name }} {{ $order->shippingAddress?->last_name }} &lt;{{ $order->customer_reference }}&gt;
**Order Total:** ${{ number_format(($order->total->value ?? 0) / 100, 2) }}
**Payment:** {{ ucfirst($order->meta['payment_status'] ?? 'pending') }}

<x-mail::table>
| Item | Qty | Price |
|:-----|----:|------:|
@foreach($order->lines->where('type', '!=', 'shipping') as $line)
| {{ $line->description }} | {{ $line->quantity }} | ${{ number_format(($line->total->value ?? 0) / 100, 2) }} |
@endforeach
</x-mail::table>

**Shipping to:** {{ $order->shippingAddress?->line_one }}, {{ $order->shippingAddress?->city }}, {{ $order->shippingAddress?->state }} {{ $order->shippingAddress?->postcode }}

<x-mail::button url="{{ config('app.url') }}/admin/orders">
View Order in Admin
</x-mail::button>
</x-mail::message>
