@php
    $order = $returnRequest->order;
    $items = $returnRequest->items->loadMissing('orderLine.purchasable.product');
    $refundAmount = $returnRequest->refund_amount_minor !== null ? $returnRequest->refund_amount_minor / 100 : null;
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
<h1 style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; margin:0; font-size:24px; line-height:1.3; font-weight:500; color:#1a1a1a;">Your return has been approved</h1>
</td>
</tr>

<tr>
<td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; padding-bottom:32px;">
<p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; margin:0; font-size:15px; line-height:1.6; color:#707070;">
Hi {{ $order->shippingAddress?->first_name ?? 'there' }}, good news &mdash; your return request for order #{{ $order->reference }} has been approved. Please ship the item(s) back using the address below.
</p>
</td>
</tr>

<tr>
<td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; padding-bottom:32px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#faf9f8; border-radius:8px;">
<tr>
<td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; padding:24px;">
<p style="margin:0 0 14px; font-size:14px; line-height:1.6; color:#1a1a1a;">
<strong>Return to:</strong><br>
<span style="color:#707070; white-space:pre-line;">{{ $returnRequest->rma_address }}</span>
</p>
@if($refundAmount !== null)
<p style="margin:0; font-size:14px; line-height:1.6; color:#1a1a1a;"><strong>Estimated refund:</strong> <span style="color:#707070;">${{ number_format($refundAmount, 2) }}</span></p>
@endif
</td>
</tr>
</table>
</td>
</tr>

<tr>
<td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; padding-bottom:8px;">
<h2 style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; margin:0; font-size:19px; font-weight:500; color:#1a1a1a;">Items to return</h2>
</td>
</tr>

@foreach($items as $item)
@php
    $line = $item->orderLine;
    $purchasable = $line?->getRelationValue('purchasable');
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
@endphp
<tr>
<td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; padding:20px 0; border-bottom:1px solid #f2f2f2;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr>
<td width="56" valign="top">
<img src="{{ $imageUrl }}" width="48" height="48" alt="" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; display:block; width:48px; height:48px; border-radius:6px; object-fit:cover; border:1px solid #ececec;">
</td>
<td valign="top" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; padding-left:12px;">
<p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; margin:0; font-size:14px; font-weight:600; color:#1a1a1a;">{{ $line?->description }} &times; {{ $item->quantity }}</p>
@if($line?->option)
<p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; margin:4px 0 0; font-size:13px; color:#9a9a9a;">{{ $line->option }}</p>
@endif
</td>
</tr>
</table>
</td>
</tr>
@endforeach

@if($returnRequest->admin_note)
<tr>
<td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; padding-top:24px; padding-bottom:12px;">
<p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; margin:0; font-size:14px; line-height:1.6; color:#707070;">
<strong style="color:#1a1a1a;">Note from our team:</strong> {{ $returnRequest->admin_note }}
</p>
</td>
</tr>
@endif

<tr>
<td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; padding-top:32px; padding-bottom:16px;">
<p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; margin:0; font-size:15px; line-height:1.6; color:#707070;">
Have questions about the return process or your refund? Our support team is happy to help.
</p>
</td>
</tr>

<tr>
<td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; padding-bottom:32px;">
<table role="presentation" cellpadding="0" cellspacing="0">
<tr>
<td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; border-radius:6px; background-color:#df8448;">
<a href="mailto:support@petposture.com" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; display:inline-block; padding:15px 32px; font-size:14px; font-weight:600; color:#ffffff; text-decoration:none;">Contact support</a>
</td>
</tr>
</table>
</td>
</tr>

<tr>
<td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; padding-top:8px; border-top:1px solid #ececec;">
<p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; margin:16px 0 0; font-size:13px; color:#9a9a9a;">
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
