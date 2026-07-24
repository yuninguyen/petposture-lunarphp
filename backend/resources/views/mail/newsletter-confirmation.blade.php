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
<td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; background-color:#fdf1e7; border-radius:100px; padding:6px 16px; font-size:11px; font-weight:700; letter-spacing:1.5px; text-transform:uppercase; color:#df8448;">&#10003; Subscribed</td>
</tr>
</table>
<h1 style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; margin:0; font-size:26px; line-height:1.3; font-weight:700; color:#3e4c57;">You&rsquo;re in!</h1>
</td>
</tr>

<tr>
<td align="center" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; padding:12px 40px 0 40px;">
<p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; margin:0; font-size:15px; line-height:1.7; color:#666666; text-align:center;">
Thanks for subscribing to {{ config('app.name') }} updates at <strong style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; color:#3e4c57;">{{ $email }}</strong>. You&rsquo;ll be the first to hear about new arrivals, exclusive discounts, and pet care tips.
</p>
</td>
</tr>

<tr>
<td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; padding:32px 40px 0 40px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; background-color:#fcfbf8; border:1px solid #eee3d7; border-radius:14px;">
<tr>
<td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; padding:28px 24px 18px 24px; font-size:14px; line-height:16px; color:#3e4c57;">
<span style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; display:inline-block; width:16px; height:16px; border-radius:50%; background-color:#df8448; color:#ffffff; font-size:10px; font-weight:700; text-align:center; line-height:16px; vertical-align:middle;">&#10003;</span>&nbsp;&nbsp;<span style="vertical-align:middle;">New product launches</span>
</td>
</tr>
<tr>
<td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; padding:0 24px 18px 24px; font-size:14px; line-height:16px; color:#3e4c57;">
<span style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; display:inline-block; width:16px; height:16px; border-radius:50%; background-color:#df8448; color:#ffffff; font-size:10px; font-weight:700; text-align:center; line-height:16px; vertical-align:middle;">&#10003;</span>&nbsp;&nbsp;<span style="vertical-align:middle;">Exclusive discounts and promotions</span>
</td>
</tr>
<tr>
<td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; padding:0 24px 28px 24px; font-size:14px; line-height:16px; color:#3e4c57;">
<span style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; display:inline-block; width:16px; height:16px; border-radius:50%; background-color:#df8448; color:#ffffff; font-size:10px; font-weight:700; text-align:center; line-height:16px; vertical-align:middle;">&#10003;</span>&nbsp;&nbsp;<span style="vertical-align:middle;">Pet health &amp; posture tips</span>
</td>
</tr>
</table>
</td>
</tr>

<tr>
<td align="center" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; padding:32px 40px 8px 40px;">
<table role="presentation" cellpadding="0" cellspacing="0">
<tr>
<td align="center" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; border-radius:6px; background-color:#df8448;">
<a href="{{ config('app.frontend_url') }}/shop" target="_blank" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; display:inline-block; padding:16px 44px; font-size:12px; font-weight:700; letter-spacing:0.5px; text-transform:uppercase; color:#ffffff; text-decoration:none;">Shop Now</a>
</td>
</tr>
</table>
</td>
</tr>

<tr>
<td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; padding:36px 40px 40px 40px;">
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; height:1px; background-color:#f0ede8; line-height:1px; font-size:1px; margin-bottom:24px;">&nbsp;</div>
<p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; margin:0; font-size:13px; line-height:1.6; color:#a0a0a0;">
If you didn&rsquo;t subscribe, you can safely ignore this email.<br>
Thanks,<br>The {{ config('app.name') }} Team
</p>
</td>
</tr>

</table>

<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; max-width:600px; width:100%; margin-top:28px;">
<tr>
<td align="center" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; padding-bottom:12px; font-size:12px; color:#8b8f93;">
<a href="{{ config('app.frontend_url') }}/contact" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; color:#8b8f93; text-decoration:underline;">Contact Us</a>
&nbsp;&middot;&nbsp;
<a href="{{ config('app.frontend_url') }}/privacy-policy" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; color:#8b8f93; text-decoration:underline;">Privacy Policy</a>
</td>
</tr>
<tr>
<td align="center" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; font-size:12px; line-height:1.6; color:#a0a0a0;">
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
