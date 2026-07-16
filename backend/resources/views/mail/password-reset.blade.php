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
<td style="background-color:#fdf1e7; border-radius:100px; padding:6px 16px; font-size:11px; font-weight:700; letter-spacing:1.5px; text-transform:uppercase; color:#df8448;">Password Reset</td>
</tr>
</table>
<h1 style="margin:0; font-size:26px; line-height:1.3; font-weight:700; color:#3e4c57;">Reset your password</h1>
</td>
</tr>

<tr>
<td align="center" style="padding:12px 40px 0 40px;">
<p style="margin:0; font-size:15px; line-height:1.7; color:#666666; text-align:center;">
Hi {{ $userName }}, we received a request to reset the password for your {{ config('app.name') }} account. Click the button below to choose a new one.
</p>
</td>
</tr>

<tr>
<td align="center" style="padding:32px 40px 8px 40px;">
<table role="presentation" cellpadding="0" cellspacing="0">
<tr>
<td align="center" style="border-radius:6px; background-color:#df8448;">
<a href="{{ $resetUrl }}" target="_blank" style="display:inline-block; padding:16px 44px; font-size:12px; font-weight:700; letter-spacing:2px; text-transform:uppercase; color:#ffffff; text-decoration:none;">Reset Password</a>
</td>
</tr>
</table>
</td>
</tr>

<tr>
<td align="center" style="padding:20px 40px 0 40px;">
<p style="margin:0; font-size:13px; line-height:1.6; color:#a0a0a0; text-align:center;">
This link will expire in <strong style="color:#3e4c57;">60 minutes</strong>. If you didn&rsquo;t request this, you can safely ignore this email &mdash; your password will remain unchanged.
</p>
</td>
</tr>

<tr>
<td style="padding:32px 40px 40px 40px;">
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
2017 I St A, Sacramento, CA 95811, United States
</td>
</tr>
</table>

</td>
</tr>
</table>
</body>
</html>
