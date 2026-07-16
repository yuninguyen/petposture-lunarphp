<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{{ config('app.name') }}</title>
</head>
<body style="margin:0; padding:0; background-color:#f4f6f8; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f8; padding:40px 16px;">
<tr>
<td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px; width:100%; background-color:#ffffff; border-radius:20px; overflow:hidden; border:1px solid #eee3d7;">

<tr>
<td style="background-color:#df8448; line-height:5px; font-size:5px;" height="5">&nbsp;</td>
</tr>

<tr>
<td align="center" style="padding:44px 40px 28px 40px;">
<img src="{{ config('app.frontend_url') }}/assets/Logo-PetPosture-1-e1761840892773.png" height="54" alt="{{ config('app.name') }}" style="display:block; height:54px; width:auto;">
</td>
</tr>

<tr>
<td style="padding:0 40px;">
<div style="height:1px; background-color:#f0ede8; line-height:1px; font-size:1px;">&nbsp;</div>
</td>
</tr>

<tr>
<td align="center" style="padding:36px 40px 8px 40px;">
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 14px auto;">
<tr>
<td style="background-color:#fdf1e7; border-radius:100px; padding:6px 16px; font-size:11px; font-weight:700; letter-spacing:1.5px; text-transform:uppercase; color:#df8448;">&#10003; Account Confirmed</td>
</tr>
</table>
<h1 style="margin:0; font-size:26px; line-height:1.3; font-weight:700; color:#3e4c57;">Welcome aboard, {{ $user->name }}!</h1>
</td>
</tr>

<tr>
<td align="center" style="padding:12px 40px 0 40px;">
<p style="margin:0; font-size:15px; line-height:1.7; color:#666666; text-align:center;">
Your {{ config('app.name') }} account has been created with the email <strong style="color:#3e4c57;">{{ $user->email }}</strong>.
</p>
</td>
</tr>

<tr>
<td style="padding:32px 40px 0 40px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fcfbf8; border:1px solid #eee3d7; border-radius:14px;">
<tr>
<td style="padding:24px 24px 8px 24px; font-size:14px; color:#3e4c57;">
<table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td valign="top" style="width:22px; padding-top:1px;"><span style="display:inline-block; width:16px; height:16px; border-radius:50%; background-color:#df8448; color:#ffffff; font-size:10px; font-weight:700; text-align:center; line-height:16px;">&#10003;</span></td>
<td style="padding-bottom:16px;">Track every order in real time, from checkout to delivery</td>
</tr></table>
</td>
</tr>
<tr>
<td style="padding:0 24px 8px 24px; font-size:14px; color:#3e4c57;">
<table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td valign="top" style="width:22px; padding-top:1px;"><span style="display:inline-block; width:16px; height:16px; border-radius:50%; background-color:#df8448; color:#ffffff; font-size:10px; font-weight:700; text-align:center; line-height:16px;">&#10003;</span></td>
<td style="padding-bottom:16px;">Save shipping addresses for faster checkout</td>
</tr></table>
</td>
</tr>
<tr>
<td style="padding:0 24px 24px 24px; font-size:14px; color:#3e4c57;">
<table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td valign="top" style="width:22px; padding-top:1px;"><span style="display:inline-block; width:16px; height:16px; border-radius:50%; background-color:#df8448; color:#ffffff; font-size:10px; font-weight:700; text-align:center; line-height:16px;">&#10003;</span></td>
<td>Browse your full order history in one place</td>
</tr></table>
</td>
</tr>
</table>
</td>
</tr>

<tr>
<td align="center" style="padding:32px 40px 8px 40px;">
<table role="presentation" cellpadding="0" cellspacing="0">
<tr>
<td align="center" style="border-radius:6px; background-color:#df8448;">
<a href="{{ config('app.frontend_url') }}/shop" target="_blank" style="display:inline-block; padding:16px 44px; font-size:12px; font-weight:700; letter-spacing:2px; text-transform:uppercase; color:#ffffff; text-decoration:none;">Start Shopping</a>
</td>
</tr>
</table>
</td>
</tr>

<tr>
<td style="padding:36px 40px 0 40px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr>
<td align="center" style="width:33.33%; padding:20px 8px;">
<div style="width:44px; height:44px; line-height:44px; border-radius:50%; background-color:#fdf1e7; color:#df8448; font-size:18px; margin:0 auto 10px auto;">&#128666;</div>
<p style="margin:0; font-size:11px; font-weight:700; letter-spacing:0.5px; text-transform:uppercase; color:#3e4c57;">Free Express<br>Shipping</p>
</td>
<td align="center" style="width:33.33%; padding:20px 8px; border-left:1px solid #f0ede8; border-right:1px solid #f0ede8;">
<div style="width:44px; height:44px; line-height:44px; border-radius:50%; background-color:#fdf1e7; color:#df8448; font-size:18px; margin:0 auto 10px auto;">&#128274;</div>
<p style="margin:0; font-size:11px; font-weight:700; letter-spacing:0.5px; text-transform:uppercase; color:#3e4c57;">Secure<br>Checkout</p>
</td>
<td align="center" style="width:33.33%; padding:20px 8px;">
<div style="width:44px; height:44px; line-height:44px; border-radius:50%; background-color:#fdf1e7; color:#df8448; font-size:18px; margin:0 auto 10px auto;">&#10084;</div>
<p style="margin:0; font-size:11px; font-weight:700; letter-spacing:0.5px; text-transform:uppercase; color:#3e4c57;">30-Day<br>Health Trial</p>
</td>
</tr>
</table>
</td>
</tr>

<tr>
<td style="padding:8px 40px 40px 40px;">
<div style="height:1px; background-color:#f0ede8; line-height:1px; font-size:1px; margin-bottom:24px;">&nbsp;</div>
<p style="margin:0; font-size:13px; line-height:1.6; color:#a0a0a0;">
Thanks,<br>The {{ config('app.name') }} Team
</p>
</td>
</tr>

</table>

<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px; width:100%; margin-top:24px;">
<tr>
<td align="center" style="padding-bottom:12px; font-size:12px; color:#8b8f93;">
<a href="{{ config('app.frontend_url') }}/contact" style="color:#8b8f93; text-decoration:underline;">Contact Us</a>
&nbsp;&middot;&nbsp;
<a href="{{ config('app.frontend_url') }}/privacy-policy" style="color:#8b8f93; text-decoration:underline;">Privacy Policy</a>
</td>
</tr>
<tr>
<td align="center" style="font-size:12px; line-height:1.6; color:#a0a0a0;">
This is an automated message, please don&rsquo;t reply directly to this email.<br>
&copy; {{ date('Y') }} {{ config('app.name') }} LLC. All rights reserved.<br>
123 Pet Lane, Suite 100, San Francisco, CA 94107
</td>
</tr>
</table>

</td>
</tr>
</table>
</body>
</html>
