@php
    $meta = (array) ($order->meta ?? []);

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
    $couponCode = $meta['coupon_code'] ?? null;

    $shippingTotal = $moneyValue($order->shipping_total);
    if ($shippingTotal <= 0) {
        $shippingLine = $order->lines->firstWhere('type', 'shipping');
        if ($shippingLine) {
            $shippingTotal = $moneyValue($shippingLine->total);
        }
    }

    $shippingMethodRaw = $meta['shipping_method'] ?? null;
    $shippingMethodLabel = $shippingMethodRaw
        ? str_replace(['_', '-'], ' ', ucwords(str_replace(['_', '-'], ' ', $shippingMethodRaw)))
        : 'Standard';

    $viewOrderUrl = rtrim(config('app.frontend_url'), '/') . '/checkout/success?ref=' . urlencode($order->reference) . '&email=' . urlencode($order->customer_reference ?? '');
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
<td valign="middle" align="right" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; font-size:13px; letter-spacing:0.5px; color:#9a9a9a; text-transform:uppercase;">
Order {{ $order->reference }}
</td>
</tr>
</table>
</td>
</tr>

<tr>
<td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; padding-bottom:12px;">
<h1 style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; margin:0; font-size:24px; line-height:1.3; font-weight:500; color:#1a1a1a;">Thank you for your purchase!</h1>
</td>
</tr>

<tr>
<td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; padding-bottom:28px;">
<p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; margin:0; font-size:15px; line-height:1.6; color:#707070;">
Hi {{ $order->shippingAddress?->first_name ?? 'there' }}, we're getting your order ready to be shipped. We will notify you when it has been sent.
</p>
</td>
</tr>

<tr>
<td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; padding-bottom:12px;">
<table role="presentation" cellpadding="0" cellspacing="0">
<tr>
<td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; border-radius:6px; background-color:#df8448;">
<a href="{{ $viewOrderUrl }}" target="_blank" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; display:inline-block; padding:15px 32px; font-size:14px; font-weight:600; color:#ffffff; text-decoration:none;">View your order</a>
</td>
</tr>
</table>
</td>
</tr>

<tr>
<td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; padding-bottom:32px;">
<a href="{{ rtrim(config('app.frontend_url'), '/') }}/shop" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; font-size:14px; color:#1a1a1a; text-decoration:underline;">or Visit our store</a>
</td>
</tr>

<tr>
<td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; border-top:1px solid #ececec; padding-top:28px; padding-bottom:8px;">
<h2 style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; margin:0; font-size:16px; font-weight:700; color:#1a1a1a;">Order summary</h2>
</td>
</tr>

@foreach($productLines as $line)
@php
    $imageUrl = \App\Services\ProductSyncService::normalizePublicImageUrl(
        $line->getRelationValue('purchasable')?->product?->translateAttribute('image_url')
    );
    if (str_starts_with($imageUrl, '/')) {
        $imageUrl = rtrim(config('app.frontend_url'), '/') . $imageUrl;
    }
    $lineTotal = $moneyValue($line->total);
@endphp
<tr>
<td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; padding:16px 0; border-bottom:1px solid #f2f2f2;">
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
<td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; padding-top:16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr>
<td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; padding:4px 0; font-size:14px; color:#707070;">Subtotal</td>
<td align="right" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; padding:4px 0; font-size:14px; color:#1a1a1a;">${{ number_format($subTotal, 2) }}</td>
</tr>
@if($discountTotal > 0)
<tr>
<td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; padding:4px 0; font-size:14px; color:#707070;">Discount{{ $couponCode ? ' (' . strtoupper($couponCode) . ')' : '' }}</td>
<td align="right" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; padding:4px 0; font-size:14px; color:#df8448;">&minus;${{ number_format($discountTotal, 2) }}</td>
</tr>
@endif
<tr>
<td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; padding:4px 0; font-size:14px; color:#707070;">Shipping</td>
<td align="right" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; padding:4px 0; font-size:14px; color:#1a1a1a;">{{ $shippingTotal > 0 ? '$' . number_format($shippingTotal, 2) : 'Free' }}</td>
</tr>
<tr>
<td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; padding:4px 0; font-size:14px; color:#707070;">Taxes</td>
<td align="right" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; padding:4px 0; font-size:14px; color:#1a1a1a;">${{ number_format($taxTotal, 2) }}</td>
</tr>
</table>
</td>
</tr>

<tr>
<td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; border-top:1px solid #ececec; padding-top:12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr>
<td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; font-size:15px; font-weight:700; color:#1a1a1a;">Total</td>
<td align="right" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; font-size:20px; font-weight:700; color:#1a1a1a;">${{ number_format($total, 2) }} <span style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; font-size:12px; font-weight:400; color:#9a9a9a;">USD</span></td>
</tr>
</table>
</td>
</tr>

<tr>
<td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; border-top:1px solid #ececec; padding-top:28px; padding-bottom:16px;">
<h2 style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; margin:0; font-size:16px; font-weight:500; color:#1a1a1a;">Customer information</h2>
</td>
</tr>

<tr>
<td>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr>
<td width="50%" valign="top">
<p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; margin:0 0 8px; font-size:14px; font-weight:500; color:#1a1a1a;">Shipping address</p>
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
<p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; margin:0 0 8px; font-size:14px; font-weight:500; color:#1a1a1a;">Billing address</p>
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
<td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; padding-top:20px;">
<p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; margin:0 0 4px; font-size:14px; font-weight:500; color:#1a1a1a;">Shipping method</p>
<p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; margin:0; font-size:14px; color:#707070;">{{ $shippingMethodLabel }}</p>
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
