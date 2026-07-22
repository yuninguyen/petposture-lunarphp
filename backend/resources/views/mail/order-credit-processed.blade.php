@php
    $meta = (array) ($order->meta ?? []);
    $refundAmount = is_numeric($meta['refund_amount'] ?? null) ? ((float) $meta['refund_amount']) / 100 : 0.0;
    $cardLast4 = $meta['card_last4'] ?? null;
    $paymentMethodLabel = $cardLast4 ? "credit card ending in x{$cardLast4}" : 'original payment method';
    $refundedAt = $meta['refunded_at'] ?? null;
    $refundedAtLabel = $refundedAt ? \Illuminate\Support\Carbon::parse($refundedAt)->format('M d, Y') : now()->format('M d, Y');
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
<td align="center" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; padding-bottom:36px;">
<img src="{{ isset($message) ? $message->embed(public_path('logo.png')) : 'data:image/png;base64,' . base64_encode(file_get_contents(public_path('logo.png'))) }}" height="44" alt="{{ config('app.name') }}" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; display:block; height:44px; width:auto;">
</td>
</tr>

<tr>
<td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; padding-bottom:32px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #ececec; border-radius:8px;">
<tr>
<td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; padding:32px;">

<p style="margin:0 0 20px; font-size:15px; line-height:1.6; color:#1a1a1a;">Hi {{ $order->shippingAddress?->first_name ?? 'there' }},</p>

<p style="margin:0 0 20px; font-size:15px; line-height:1.6; color:#1a1a1a;">Your credit has been processed for order #{{ $order->reference }}.</p>

<p style="margin:0 0 20px; font-size:15px; line-height:1.6; color:#1a1a1a;">
A credit of <strong>${{ number_format($refundAmount, 2) }}</strong> has been applied to your {{ $paymentMethodLabel }} on <strong>{{ $refundedAtLabel }}</strong>.
</p>

<p style="margin:0 0 20px; font-size:13px; line-height:1.7; color:#707070;">
<strong style="color:#1a1a1a;">Please note:</strong> though the refund has been issued, the credit may not appear immediately on your statement depending upon the policies of your financial institution. Generally, the credit will appear in 3&ndash;5 business days; however, it may take up to two billing cycles for the credit to appear. Contact your credit/debit card company for specific posting dates.
</p>

<p style="margin:0 0 20px; font-size:15px; line-height:1.6; color:#1a1a1a;">
If you have further questions on your {{ config('app.name') }}.com order, please visit our <a href="{{ rtrim(config('app.frontend_url'), '/') }}/faqs" style="color:#df8448; text-decoration:underline; font-weight:600;">Help Section</a> for more information.
</p>

<p style="margin:0; font-size:15px; line-height:1.6; color:#1a1a1a;">Thanks for shopping at {{ config('app.name') }}!</p>

</td>
</tr>
</table>
</td>
</tr>

<tr>
<td align="center" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; padding-bottom:20px;">
<p style="margin:0; font-size:12px; font-weight:700; letter-spacing:0.8px; color:#9a9a9a; text-transform:uppercase;">Customer support</p>
</td>
</tr>

<tr>
<td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; padding-bottom:32px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr>
<td width="50%" align="center" style="font-size:14px; color:#1a1a1a;">
<a href="mailto:support@petposture.com" style="color:#1a1a1a; text-decoration:none;">Email Us</a>
</td>
<td width="50%" align="center" style="font-size:14px; color:#1a1a1a;">
<a href="tel:+19166680065" style="color:#1a1a1a; text-decoration:none;">+1 (916) 668-0065</a>
</td>
</tr>
</table>
</td>
</tr>

<tr>
<td style="border-top:1px solid #ececec; padding-top:20px; padding-bottom:12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr>
<td align="center" style="font-size:12px; color:#9a9a9a;">
<a href="{{ rtrim(config('app.frontend_url'), '/') }}/return-refund-policy" style="color:#9a9a9a; text-decoration:underline;">Return &amp; Refund Policy</a>
&nbsp;&middot;&nbsp;
<a href="{{ rtrim(config('app.frontend_url'), '/') }}/privacy-policy" style="color:#9a9a9a; text-decoration:underline;">Privacy Policy</a>
&nbsp;&middot;&nbsp;
<a href="{{ rtrim(config('app.frontend_url'), '/') }}/terms-and-conditions" style="color:#9a9a9a; text-decoration:underline;">Terms of Use</a>
</td>
</tr>
</table>
</td>
</tr>

<tr>
<td align="center" style="padding-top:12px;">
<p style="margin:0; font-size:12px; line-height:1.7; color:#9a9a9a;">
{{ config('app.name') }}<br>
2017 I St A, Sacramento, CA 95811, United States
</p>
</td>
</tr>

</table>
</td>
</tr>
</table>
</body>
</html>
