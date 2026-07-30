<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{{ config('app.name') }}</title>
<style>
@media only screen and (max-width:600px) {
  .mail-px { padding-left:20px !important; padding-right:20px !important; }
}
</style>
</head>
<body style="margin:0; padding:0; background-color:#f4f6f8; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; background-color:#f4f6f8; padding:40px 16px;">
<tr>
<td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; max-width:600px; width:100%; background-color:#ffffff; border-radius:20px; overflow:hidden; border:1px solid #f3d0d0;">

<tr>
<td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; background-color:#dc2626; line-height:5px; font-size:5px;" height="5">&nbsp;</td>
</tr>

<tr>
<td align="center" class="mail-px" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; padding:44px 40px 28px 40px;">
<img src="{{ isset($message) ? $message->embed(public_path('logo.png')) : 'data:image/png;base64,' . base64_encode(file_get_contents(public_path('logo.png'))) }}" height="54" alt="{{ config('app.name') }}" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; display:block; height:54px; width:auto;">
</td>
</tr>

<tr>
<td class="mail-px" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; padding:0 40px;">
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; height:1px; background-color:#f0ede8; line-height:1px; font-size:1px;">&nbsp;</div>
</td>
</tr>

<tr>
<td align="center" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; padding:36px 40px 8px 40px;">
<table role="presentation" cellpadding="0" cellspacing="0" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; margin:0 auto 14px auto;">
<tr>
<td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; background-color:#fde8e8; border-radius:100px; padding:6px 16px; font-size:11px; font-weight:700; letter-spacing:1.5px; text-transform:uppercase; color:#dc2626;">Payment Failure Alert</td>
</tr>
</table>
<h1 style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; margin:0; font-size:24px; line-height:1.3; font-weight:700; color:#3e4c57;">Order #{{ $order->reference }}</h1>
</td>
</tr>

<tr>
<td class="mail-px" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; padding:24px 40px 0 40px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; background-color:#fcfbf8; border:1px solid #eee3d7; border-radius:14px;">
<tr>
<td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; padding:20px 24px;">
<p style="margin:0 0 8px; font-size:14px; line-height:1.6; color:#1a1a1a;"><strong>Customer:</strong> <span style="color:#707070;">{{ $order->shippingAddress?->first_name }} {{ $order->shippingAddress?->last_name }} &ndash; {{ $order->customer_reference }}</span></p>
<p style="margin:0 0 8px; font-size:14px; line-height:1.6; color:#1a1a1a;"><strong>Payment gateway:</strong> <span style="color:#707070;">{{ ucfirst((string) ($order->meta['payment_gateway'] ?? 'unknown')) }}</span></p>
<p style="margin:0; font-size:14px; line-height:1.6; color:#1a1a1a;"><strong>Failed:</strong> <span style="color:#707070;">{{ $failureCount }} time(s) within the last {{ (int) ($windowSeconds / 60) }} minutes</span></p>
</td>
</tr>
</table>
</td>
</tr>

<tr>
<td class="mail-px" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; padding:20px 40px 0 40px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fde8e8; border-radius:8px;">
<tr>
<td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; padding:16px 20px; font-size:14px; line-height:1.6; color:#b91c1c;">
This order has crossed the payment failure alert threshold. Manual review is recommended — the customer may be having trouble checking out, or this could be a sign of card testing/fraud.
</td>
</tr>
</table>
</td>
</tr>

<tr>
<td align="center" class="mail-px" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; padding:32px 40px 40px 40px;">
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
