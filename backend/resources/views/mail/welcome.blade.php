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
<td align="center" style="padding:40px 40px 24px 40px;">
<img src="{{ config('app.frontend_url') }}/assets/Logo-PetPosture-1-e1761840892773.png" height="36" alt="{{ config('app.name') }}" style="display:block; height:36px; width:auto;">
</td>
</tr>

<tr>
<td style="padding:0 40px;">
<div style="height:1px; background-color:#f0ede8; line-height:1px; font-size:1px;">&nbsp;</div>
</td>
</tr>

<tr>
<td style="padding:36px 40px 8px 40px;">
<p style="margin:0 0 4px 0; font-size:11px; font-weight:700; letter-spacing:2px; text-transform:uppercase; color:#df8448;">Account Confirmed</p>
<h1 style="margin:0; font-size:26px; line-height:1.3; font-weight:700; color:#3e4c57;">Welcome aboard, {{ $user->name }}!</h1>
</td>
</tr>

<tr>
<td style="padding:12px 40px 0 40px;">
<p style="margin:0; font-size:15px; line-height:1.7; color:#666666;">
Your {{ config('app.name') }} account has been created with the email <strong style="color:#3e4c57;">{{ $user->email }}</strong>. Here&rsquo;s what you can do next:
</p>
</td>
</tr>

<tr>
<td style="padding:24px 40px 0 40px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr>
<td style="padding-bottom:14px; font-size:14px; color:#3e4c57;">
<span style="display:inline-block; width:6px; height:6px; border-radius:50%; background-color:#df8448; margin-right:12px;">&nbsp;</span>
Track every order in real time, from checkout to delivery
</td>
</tr>
<tr>
<td style="padding-bottom:14px; font-size:14px; color:#3e4c57;">
<span style="display:inline-block; width:6px; height:6px; border-radius:50%; background-color:#df8448; margin-right:12px;">&nbsp;</span>
Save shipping addresses for faster checkout
</td>
</tr>
<tr>
<td style="font-size:14px; color:#3e4c57;">
<span style="display:inline-block; width:6px; height:6px; border-radius:50%; background-color:#df8448; margin-right:12px;">&nbsp;</span>
Browse your full order history in one place
</td>
</tr>
</table>
</td>
</tr>

<tr>
<td align="center" style="padding:32px 40px 40px 40px;">
<table role="presentation" cellpadding="0" cellspacing="0">
<tr>
<td align="center" style="border-radius:6px; background-color:#df8448;">
<a href="{{ config('app.frontend_url') }}/shop" target="_blank" style="display:inline-block; padding:16px 40px; font-size:12px; font-weight:700; letter-spacing:2px; text-transform:uppercase; color:#ffffff; text-decoration:none;">Start Shopping</a>
</td>
</tr>
</table>
</td>
</tr>

<tr>
<td style="padding:0 40px 40px 40px;">
<div style="height:1px; background-color:#f0ede8; line-height:1px; font-size:1px; margin-bottom:24px;">&nbsp;</div>
<p style="margin:0; font-size:13px; line-height:1.6; color:#a0a0a0;">
Thanks,<br>The {{ config('app.name') }} Team
</p>
</td>
</tr>

</table>

<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px; width:100%; margin-top:24px;">
<tr>
<td align="center" style="font-size:12px; line-height:1.6; color:#a0a0a0;">
&copy; {{ date('Y') }} {{ config('app.name') }}. All rights reserved.<br>
This is an automated message, please don&rsquo;t reply directly to this email.
</td>
</tr>
</table>

</td>
</tr>
</table>
</body>
</html>
