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
    $meta = (array) ($order->meta ?? []);
    $trackingNumber = $meta['tracking_number'] ?? null;
    $trackingUrl = $meta['shipment_tracking_url'] ?? null;

    $shippingMethodRaw = $meta['shipping_method'] ?? null;
    $shippingMethodLabel = $shippingMethodRaw
        ? (\App\Models\ShippingMethod::where('code', $shippingMethodRaw)->value('name')
            ?? ucwords(str_replace(['_', '-'], ' ', $shippingMethodRaw)))
        : 'Standard';

    $viewOrderUrl = rtrim(config('app.frontend_url'), '/') . '/checkout/success?ref=' . urlencode($order->reference) . '&email=' . urlencode($order->customer_reference ?? '');

    $stepStyle = 'display:inline-block; width:40px; height:40px; line-height:40px; border-radius:50%; background-color:#df8448; color:#ffffff; font-size:16px; font-weight:700; text-align:center;';
    $lineStyle = 'height:2px; line-height:2px; font-size:0; background-color:#df8448;';
    $labelStyle = 'margin:8px 0 0; font-size:10px; font-weight:600; letter-spacing:0.6px; color:#1a1a1a; text-transform:uppercase;';
@endphp
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{{ config('app.name') }}</title>
</head>
<body style="margin:0; padding:0; background-color:#ffffff; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; background-color:#ffffff;">
<tr>
<td align="center" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; padding:40px 16px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; max-width:600px; width:100%;">

<tr>
<td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; padding-bottom:32px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr>
<td valign="middle">
<img src="{{ isset($message) ? $message->embed(public_path('logo.png')) : 'data:image/png;base64,' . base64_encode(file_get_contents(public_path('logo.png'))) }}" height="44" alt="{{ config('app.name') }}" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; display:block; height:44px; width:auto;">
</td>
<td valign="middle" align="right" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; font-size:15px; letter-spacing:0.5px; color:#9a9a9a; text-transform:uppercase;">
Order {{ $order->reference }}
</td>
</tr>
</table>
</td>
</tr>

<tr>
<td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; padding-bottom:12px;">
<h1 style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; margin:0; font-size:24px; line-height:1.3; font-weight:500; color:#1a1a1a;">Your order has been delivered!</h1>
</td>
</tr>

<tr>
<td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; padding-bottom:32px;">
<p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; margin:0; font-size:15px; line-height:1.6; color:#707070;">
Your order #{{ $order->reference }} has been delivered. We hope you love your new products!
</p>
</td>
</tr>

<tr>
<td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; padding-bottom:36px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr>
<td width="72" align="center" valign="top">
<span style="{{ $stepStyle }}">&#10003;</span>
<p style="{{ $labelStyle }}">Order Placed</p>
</td>
<td valign="top" style="padding-top:19px;"><div style="{{ $lineStyle }}">&nbsp;</div></td>
<td width="72" align="center" valign="top">
<span style="{{ $stepStyle }}">&#10003;</span>
<p style="{{ $labelStyle }}">Shipped</p>
</td>
<td valign="top" style="padding-top:19px;"><div style="{{ $lineStyle }}">&nbsp;</div></td>
<td width="72" align="center" valign="top">
<span style="{{ $stepStyle }}">&#10003;</span>
<p style="{{ $labelStyle }}">Delivered</p>
</td>
</tr>
</table>
</td>
</tr>

<tr>
<td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; padding-bottom:32px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#faf9f8; border-radius:8px;">
<tr>
<td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; padding:24px;">
<p style="margin:0 0 14px; font-size:14px; line-height:1.6; color:#1a1a1a;"><strong>Order number:</strong> {{ $order->reference }}</p>
<p style="margin:0 0 14px; font-size:14px; line-height:1.6; color:#1a1a1a;">
<strong>Shipped to:</strong><br>
<span style="color:#707070;">
{{ $order->shippingAddress?->first_name }} {{ $order->shippingAddress?->last_name }}<br>
{{ $order->shippingAddress?->line_one }}<br>
@if($order->shippingAddress?->line_two)
{{ $order->shippingAddress->line_two }}<br>
@endif
{{ $order->shippingAddress?->city }} {{ $order->shippingAddress?->state }} {{ $order->shippingAddress?->postcode }}<br>
{{ $order->shippingAddress?->country?->name ?? 'United States' }}
</span>
</p>
<p style="margin:0; font-size:14px; line-height:1.6; color:#1a1a1a;"><strong>Shipping method:</strong> <span style="color:#707070;">{{ $shippingMethodLabel }}</span></p>
</td>
</tr>
</table>
</td>
</tr>

<tr>
<td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; padding-bottom:8px;">
<h2 style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; margin:0; font-size:19px; font-weight:500; color:#1a1a1a;">Items ordered</h2>
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
<td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; padding:20px 0; border-bottom:1px solid #f2f2f2;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr>
<td width="56" valign="top">
<img src="{{ $imageUrl }}" width="48" height="48" alt="" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; display:block; width:48px; height:48px; border-radius:6px; object-fit:cover; border:1px solid #ececec;">
</td>
<td valign="top" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; padding-left:12px;">
<p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; margin:0; font-size:14px; font-weight:600; color:#1a1a1a;">{{ $line->description }} &times; {{ $line->quantity }}</p>
@if($line->option)
<p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; margin:4px 0 0; font-size:13px; color:#9a9a9a;">{{ $line->option }}</p>
@endif
@if($trackingNumber)
<p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; margin:6px 0 0; font-size:12px;">
<a href="{{ $trackingUrl ?: $viewOrderUrl }}" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; color:#df8448; text-decoration:underline; font-weight:600;">Track your package: {{ $trackingNumber }}</a>
</p>
@endif
</td>
<td valign="top" align="right" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; font-size:14px; font-weight:600; color:#1a1a1a; white-space:nowrap;">
${{ number_format($lineTotal, 2) }}
</td>
</tr>
</table>
</td>
</tr>
@endforeach

<tr>
<td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; padding-top:32px;">
<table role="presentation" cellpadding="0" cellspacing="0">
<tr>
<td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; border-radius:6px; background-color:#df8448;">
<a href="{{ rtrim(config('app.frontend_url'), '/') }}/contact" target="_blank" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; display:inline-block; padding:15px 32px; font-size:14px; font-weight:600; color:#ffffff; text-decoration:none;">Contact support</a>
</td>
</tr>
</table>
</td>
</tr>

<tr>
<td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; padding-top:12px; padding-bottom:32px; font-size:13px; color:#9a9a9a;">
If your order hasn&rsquo;t arrived or something isn&rsquo;t right, let us know and we&rsquo;ll sort it out.
</td>
</tr>

<tr>
<td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; border-top:1px solid #ececec; padding-top:24px; padding-bottom:8px;">
<p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; margin:0; font-size:13px; font-weight:700; color:#1a1a1a;">
To view our return policy, <a href="{{ rtrim(config('app.frontend_url'), '/') }}/return-refund-policy" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; color:#1a1a1a; text-decoration:underline; font-weight:700;">click here</a>.
</p>
</td>
</tr>

<tr>
<td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; padding-top:16px;">
<p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; margin:0; font-size:13px; color:#9a9a9a;">
If you have any questions, contact us at <a href="mailto:support@petposture.com" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; color:#1a1a1a; text-decoration:none;">support@petposture.com</a>
</p>
</td>
</tr>

</table>
</td>
</tr>
</table>
</body>
</html>
