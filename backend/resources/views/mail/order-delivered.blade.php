<x-mail::message>
# Your Order Has Been Delivered! 🎉

Hi {{ $order->shippingAddress?->first_name ?? 'there' }},

Order **#{{ $order->reference }}** has been marked as delivered. We hope your pet loves their new products!

If you haven't received your order or something isn't right, please contact us immediately.

<x-mail::button url="{{ config('app.frontend_url') }}/contact">
Contact Support
</x-mail::button>

Thanks for shopping with {{ config('app.name') }}!<br>
{{ config('app.name') }}
</x-mail::message>
