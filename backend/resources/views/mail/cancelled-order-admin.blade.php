@php
    $moneyValue = function ($amount) {
        if (is_object($amount) && method_exists($amount, 'decimal')) {
            return (float) $amount->decimal();
        }
        if (is_numeric($amount)) {
            return ((float) $amount) / 100;
        }
        return 0.0;
    };

    $productLines = $order->lines->where('type', '!=', 'shipping');
    $subTotal = $moneyValue($order->sub_total);
    $taxTotal = $moneyValue($order->tax_total);
    $discountTotal = $moneyValue($order->discount_total);
    $total = $moneyValue($order->total);
    $couponCode = (array_key_exists('coupon_code', (array) ($order->meta ?? []))) ? $order->meta['coupon_code'] : null;

    $shippingTotal = $moneyValue($order->shipping_total);
    if ($shippingTotal <= 0) {
        $shippingLine = $order->lines->firstWhere('type', 'shipping');
        if ($shippingLine) {
            $shippingTotal = $moneyValue($shippingLine->total);
        }
    }

    $isPaid = !empty($order->meta['payment_status']) && $order->meta['payment_status'] === 'paid';
@endphp
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{{ config('app.name') }}</title>
</head>
<body style="margin:0; padding:0; background-color:#f4f6f8; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; background-color:#f4f6f8; padding:40px 16px;">
<tr>
<td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; max-width:600px; width:100%; background-color:#ffffff; border-radius:20px; overflow:hidden; border:1px solid #eee3d7;">

<tr>
<td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; background-color:#df8448; line-height:5px; font-size:5px;" height="5">&nbsp;</td>
</tr>

<tr>
<td align="center" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; padding:44px 40px 28px 40px;">
<img src="{{ isset($message) ? $message->embed(public_path('logo.png')) : 'data:image/png;base64,' . base64_encode(file_get_contents(public_path('logo.png'))) }}" height="54" alt="{{ config('app.name') }}" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; display:block; height:54px; width:auto;">
</td>
</tr>

<tr>
<td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; padding:0 40px;">
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; height:1px; background-color:#f0ede8; line-height:1px; font-size:1px;">&nbsp;</div>
</td>
</tr>

<tr>
<td align="center" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; padding:36px 40px 8px 40px;">
<table role="presentation" cellpadding="0" cellspacing="0" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; margin:0 auto 14px auto;">
<tr>
<td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; background-color:#fdf1e7; border-radius:100px; padding:6px 16px; font-size:11px; font-weight:700; letter-spacing:1.5px; text-transform:uppercase; color:#df8448;">Order Cancelled</td>
</tr>
</table>
<h1 style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; margin:0; font-size:24px; line-height:1.3; font-weight:700; color:#3e4c57;">Order #{{ $order->reference }}</h1>
</td>
</tr>

<tr>
<td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; padding:24px 40px 0 40px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; background-color:#fcfbf8; border:1px solid #eee3d7; border-radius:14px;">
<tr>
<td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; padding:20px 24px;">
<p style="margin:0 0 8px; font-size:14px; line-height:1.6; color:#1a1a1a;"><strong>Customer:</strong> <span style="color:#707070;">{{ $order->shippingAddress?->first_name }} {{ $order->shippingAddress?->last_name }} &ndash; {{ $order->customer_reference }}</span></p>
<p style="margin:0; font-size:14px; line-height:1.6; color:#1a1a1a;"><strong>Cancelled at:</strong> <span style="color:#707070;">{{ $order->meta['cancelled_at'] ?? now()->toDateTimeString() }}</span></p>
</td>
</tr>
</table>
</td>
</tr>

@if($isPaid)
<tr>
<td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; padding:20px 40px 0 40px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fdf1e7; border-radius:8px;">
<tr>
<td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; padding:16px 20px; font-size:14px; line-height:1.6; color:#c2680f;">
<strong>This order was paid.</strong> A refund may need to be issued manually.
</td>
</tr>
</table>
</td>
</tr>
@endif

<tr>
<td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; padding:24px 40px 0 40px;">
<h2 style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; margin:0 0 12px; font-size:17px; font-weight:700; color:#3e4c57;">Customer information</h2>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr>
<td width="50%" valign="top">
<p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; margin:0 0 6px; font-size:13px; font-weight:700; color:#1a1a1a;">Shipping address</p>
<p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; margin:0; font-size:14px; line-height:1.6; color:#707070;">
{{ $order->shippingAddress?->first_name }} {{ $order->shippingAddress?->last_name }}<br>
{{ $order->shippingAddress?->line_one }}<br>
@if($order->shippingAddress?->line_two)
{{ $order->shippingAddress->line_two }}<br>
@endif
{{ $order->shippingAddress?->city }} {{ $order->shippingAddress?->state }} {{ $order->shippingAddress?->postcode }}<br>
{{ $order->shippingAddress?->country?->name ?? 'United States' }}
</p>
</td>
<td width="50%" valign="top">
<p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; margin:0 0 6px; font-size:13px; font-weight:700; color:#1a1a1a;">Billing address</p>
<p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; margin:0; font-size:14px; line-height:1.6; color:#707070;">
{{ ($order->billingAddress ?? $order->shippingAddress)?->first_name }} {{ ($order->billingAddress ?? $order->shippingAddress)?->last_name }}<br>
{{ ($order->billingAddress ?? $order->shippingAddress)?->line_one }}<br>
@if(($order->billingAddress ?? $order->shippingAddress)?->line_two)
{{ ($order->billingAddress ?? $order->shippingAddress)->line_two }}<br>
@endif
{{ ($order->billingAddress ?? $order->shippingAddress)?->city }} {{ ($order->billingAddress ?? $order->shippingAddress)?->state }} {{ ($order->billingAddress ?? $order->shippingAddress)?->postcode }}<br>
{{ ($order->billingAddress ?? $order->shippingAddress)?->country?->name ?? 'United States' }}
</p>
</td>
</tr>
</table>
</td>
</tr>

<tr>
<td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; padding:24px 40px 0 40px;">
<h2 style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; margin:0 0 8px; font-size:17px; font-weight:700; color:#3e4c57;">Order summary</h2>
</td>
</tr>

@foreach($productLines as $line)
@php
    $purchasable = $line->getRelationValue('purchasable');
    $media = null;
    if ($purchasable) {
        $variantImages = $purchasable->images;
        $media = $variantImages->first(fn ($m) => (bool) ($m->pivot->primary ?? false)) ?? $variantImages->first();
        if (!$media && $purchasable->product) {
            $media = $purchasable->product->images->first();
        }
    }
    $imageUrl = $media
        ? $media->getUrl()
        : rtrim(config('app.frontend_url'), '/') . \App\Services\ProductSyncService::normalizePublicImageUrl(null);
    $lineTotal = $moneyValue($line->total);
@endphp
<tr>
<td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; padding:12px 40px 0 40px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-bottom:1px solid #f2f2f2; padding-bottom:12px;">
<tr>
<td width="56" valign="top" style="padding-bottom:12px;">
<img src="{{ $imageUrl }}" width="48" height="48" alt="" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; display:block; width:48px; height:48px; border-radius:6px; object-fit:cover; border:1px solid #ececec;">
</td>
<td valign="top" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; padding-left:12px; padding-bottom:12px;">
<p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; margin:0; font-size:14px; font-weight:600; color:#1a1a1a;">{{ $line->description }} &times; {{ $line->quantity }}</p>
@if($line->option)
<p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; margin:4px 0 0; font-size:13px; color:#9a9a9a;">{{ $line->option }}</p>
@endif
</td>
<td valign="top" align="right" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; font-size:14px; font-weight:600; color:#1a1a1a; white-space:nowrap; padding-bottom:12px;">
${{ number_format($lineTotal, 2) }}
</td>
</tr>
</table>
</td>
</tr>
@endforeach

<tr>
<td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; padding:16px 40px 0 40px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr>
<td></td>
<td width="260" valign="top">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr>
<td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; padding:4px 0; font-size:14px; color:#707070;">Subtotal</td>
<td align="right" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; padding:4px 0; font-size:14px; font-weight:700; color:#1a1a1a;">${{ number_format($subTotal, 2) }}</td>
</tr>
@if($discountTotal > 0)
<tr>
<td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; padding:4px 0; font-size:14px; color:#707070;">Discount{{ $couponCode ? ' (' . strtoupper($couponCode) . ')' : '' }}</td>
<td align="right" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; padding:4px 0; font-size:14px; color:#df8448;">&minus;${{ number_format($discountTotal, 2) }}</td>
</tr>
@endif
<tr>
<td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; padding:4px 0; font-size:14px; color:#707070;">Shipping</td>
<td align="right" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; padding:4px 0; font-size:14px; font-weight:700; color:#1a1a1a;">{{ $shippingTotal > 0 ? '$' . number_format($shippingTotal, 2) : 'Free' }}</td>
</tr>
<tr>
<td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; padding:4px 0; font-size:14px; color:#707070;">Taxes</td>
<td align="right" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; padding:4px 0; font-size:14px; font-weight:700; color:#1a1a1a;">${{ number_format($taxTotal, 2) }}</td>
</tr>
</table>
</td>
</tr>
</table>
</td>
</tr>

<tr>
<td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; padding:12px 40px 0 40px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr>
<td></td>
<td width="260" valign="top" style="border-top:1px solid #ececec; border-bottom:1px solid #ececec; padding:14px 0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr>
<td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; font-size:15px; font-weight:700; color:#1a1a1a;">Total</td>
<td align="right" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; font-size:19px; font-weight:700; color:#1a1a1a;">${{ number_format($total, 2) }} <span style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; font-size:12px; font-weight:400; color:#9a9a9a;">USD</span></td>
</tr>
</table>
</td>
</tr>
</table>
</td>
</tr>

<tr>
<td align="center" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; padding:32px 40px 40px 40px;">
<table role="presentation" cellpadding="0" cellspacing="0">
<tr>
<td align="center" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; border-radius:6px; background-color:#df8448;">
<a href="{{ config('app.url') }}/admin/orders" target="_blank" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; display:inline-block; padding:16px 44px; font-size:12px; font-weight:700; letter-spacing:0.5px; text-transform:uppercase; color:#ffffff; text-decoration:none;">View in Admin</a>
</td>
</tr>
</table>
</td>
</tr>

</table>

<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; max-width:600px; width:100%; margin-top:28px;">
<tr>
<td align="center" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; font-size:12px; line-height:1.6; color:#a0a0a0;">
Internal notification &mdash; not sent to the customer.<br>
&copy; {{ date('Y') }} {{ config('app.name') }} LLC. All rights reserved.
</td>
</tr>
</table>

</td>
</tr>
</table>
</body>
</html>
