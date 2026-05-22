<x-mail::message>
# Order Cancelled — #{{ $order->reference }}

An order has been cancelled on {{ config('app.name') }}.

**Customer:** {{ $order->shippingAddress?->first_name }} {{ $order->shippingAddress?->last_name }} &lt;{{ $order->customer_reference }}&gt;
**Order Total:** ${{ number_format(($order->total->value ?? 0) / 100, 2) }}
**Cancelled at:** {{ $order->meta['cancelled_at'] ?? now()->toDateTimeString() }}

@if(!empty($order->meta['payment_status']) && $order->meta['payment_status'] === 'paid')
⚠️ **This order was paid. A refund may need to be issued manually.**
@endif

<x-mail::button url="{{ config('app.url') }}/admin/orders">
View in Admin
</x-mail::button>
</x-mail::message>
