<x-mail::message :message="$message ?? null">
# Your order is on the way! 🚚

Hi {{ $order->shippingAddress?->first_name ?? 'there' }},

Good news — order **#{{ $order->reference }}** has been shipped.

@if(!empty($order->meta['shipment_carrier']))
**Carrier:** {{ strtoupper($order->meta['shipment_carrier']) }}
@endif

@if(!empty($order->meta['tracking_number']))
**Tracking number:** {{ $order->meta['tracking_number'] }}
@endif

@if(!empty($order->meta['shipment_tracking_url']))
<x-mail::button url="{{ $order->meta['shipment_tracking_url'] }}">
Track Shipment
</x-mail::button>
@else
<x-mail::button url="{{ config('app.frontend_url') }}/track-order">
Track Order
</x-mail::button>
@endif

Thanks,<br>
{{ config('app.name') }}
</x-mail::message>
