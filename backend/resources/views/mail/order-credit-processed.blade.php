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
<td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; padding-bottom:28px;">
<h1 style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; margin:0; font-size:24px; line-height:1.3; font-weight:500; color:#1a1a1a;">Your credit has been processed</h1>
</td>
</tr>

<tr>
<td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; padding-bottom:20px;">
<p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; margin:0; font-size:15px; line-height:1.6; color:#707070;">
Hi {{ $order->shippingAddress?->first_name ?? 'there' }},<br><br>
Your credit has been processed for order #{{ $order->reference }}.
</p>
</td>
</tr>

<tr>
<td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; padding-bottom:28px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#faf9f8; border-radius:8px;">
<tr>
<td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; padding:24px;">
<p style="margin:0; font-size:15px; line-height:1.6; color:#1a1a1a;">
A credit of <strong>${{ number_format($refundAmount, 2) }}</strong> has been applied to your {{ $paymentMethodLabel }} on <strong>{{ $refundedAtLabel }}</strong>.
</p>
</td>
</tr>
</table>
</td>
</tr>

<tr>
<td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; padding-bottom:20px;">
<p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; margin:0; font-size:13px; line-height:1.7; color:#9a9a9a;">
Please note: though the refund has been issued, the credit may not appear immediately on your statement depending upon the policies of your financial institution. Generally, the credit will appear in 3&ndash;5 business days; however, it may take up to two billing cycles for the credit to appear. Contact your credit/debit card company for specific posting dates.
</p>
</td>
</tr>

<tr>
<td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; padding-bottom:32px;">
<p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; margin:0; font-size:15px; line-height:1.6; color:#707070;">
If you have further questions on your {{ config('app.name') }}.com order, please visit our <a href="{{ rtrim(config('app.frontend_url'), '/') }}/faqs" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; color:#df8448; text-decoration:underline; font-weight:600;">Help Section</a> for more information.
</p>
</td>
</tr>

<tr>
<td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; border-top:1px solid #ececec; padding-top:24px;">
<p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; margin:0; font-size:15px; color:#1a1a1a;">
Thanks for shopping at {{ config('app.name') }}!
</p>
</td>
</tr>

</table>
</td>
</tr>
</table>
</body>
</html>
