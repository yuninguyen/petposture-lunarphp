@php
    $meta = (array) ($order->meta ?? []);
    $paymentMethod = strtolower((string) ($meta['payment_method'] ?? ''));
    $paymentGateway = strtolower((string) ($meta['payment_gateway'] ?? ''));
    $cardFunding = strtolower((string) ($meta['card_funding'] ?? ''));
    $cardBrand = strtolower((string) ($meta['card_brand'] ?? ''));
    $cardLast4 = (string) ($meta['card_last4'] ?? '');
    $paypalEmail = (string) ($meta['paypal_payer_email'] ?? '');

    $moneyValue = function ($amt) {
        if (is_object($amt) && method_exists($amt, 'decimal')) {
            return (float) $amt->decimal();
        }
        if (is_numeric($amt)) {
            return ((float) $amt) / 100;
        }
        return 0.0;
    };
    $amountValue = isset($amount) ? (float) $amount : $moneyValue($order->total ?? 0);
    $currencyCode = $order->currency_code ?? 'USD';

    $fundingLabel = match ($cardFunding) {
        'credit' => 'Credit Card',
        'debit' => 'Debit Card',
        'prepaid' => 'Prepaid Card',
        default => 'Card',
    };

    $cardBrandIcons = [
        'visa' => ['src' => 'https://cdn.shopifycloud.com/checkout-web/assets/c1/assets/visa.sxIq5Dot.svg', 'alt' => 'VISA'],
        'mastercard' => ['src' => 'https://cdn.shopifycloud.com/checkout-web/assets/c1/assets/mastercard.1c4_lyMp.svg', 'alt' => 'MASTERCARD'],
        'amex' => ['src' => 'https://cdn.shopifycloud.com/checkout-web/assets/c1/assets/amex.Csr7hRoy.svg', 'alt' => 'AMEX'],
        'discover' => ['src' => 'https://cdn.shopifycloud.com/checkout-web/assets/c1/assets/discover.C7UbFpNb.svg', 'alt' => 'Discover'],
        'diners' => ['src' => 'https://cdn.shopifycloud.com/checkout-web/assets/c1/assets/diners_club.B9hVEmwz.svg', 'alt' => 'Diners Club'],
        'jcb' => ['src' => 'https://cdn.shopifycloud.com/checkout-web/assets/c1/assets/jcb.BgZHqF0u.svg', 'alt' => 'JCB'],
        'unionpay' => ['src' => 'https://cdn.shopifycloud.com/checkout-web/assets/c1/assets/unionpay.8M-Boq_z.svg', 'alt' => 'UnionPay'],
    ];

    $hasCardIcon = $cardBrand !== '' && isset($cardBrandIcons[$cardBrand]);
@endphp

@if($paymentMethod === 'paypal' || $paymentGateway === 'paypal')
    <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; margin:0; font-size:14px; color:#1a2128;">
        PayPal{{ $paypalEmail !== '' ? ' (' . e($paypalEmail) . ')' : '' }}
    </p>
@elseif($paymentMethod === 'card' || $cardBrand !== '' || $cardLast4 !== '' || $cardFunding !== '')
    @if($hasCardIcon && $cardLast4 !== '')
        <table role="presentation" cellpadding="0" cellspacing="0">
            <tr>
                <td style="padding-right:8px;">
                    <img src="{{ $cardBrandIcons[$cardBrand]['src'] }}" alt="{{ $cardBrandIcons[$cardBrand]['alt'] }}" width="36" height="24" style="display:block; border:0;">
                </td>
                <td valign="middle">
                    <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; margin:0; font-size:14px; color:#1a2128;">
                        &bull;&bull;&bull;&bull; {{ e($cardLast4) }} &middot; ${{ number_format($amountValue, 2) }} {{ e($currencyCode) }}
                    </p>
                </td>
            </tr>
        </table>
    @elseif($cardBrand !== '' && $cardLast4 !== '')
        <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; margin:0; font-size:14px; color:#1a2128;">
            {{ ucfirst(e($cardBrand)) }} &bull;&bull;&bull;&bull; {{ e($cardLast4) }} &middot; ${{ number_format($amountValue, 2) }} {{ e($currencyCode) }}
        </p>
    @else
        <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; margin:0; font-size:14px; color:#1a2128;">
            {{ $fundingLabel }}
        </p>
    @endif
@elseif(!empty($meta['payment_label']))
    <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; margin:0; font-size:14px; color:#1a2128;">
        {{ e($meta['payment_label']) }}
    </p>
@elseif($paymentMethod !== '')
    <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; margin:0; font-size:14px; color:#1a2128;">
        {{ ucwords(str_replace(['_', '-'], ' ', e($paymentMethod))) }}
    </p>
@else
    <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; margin:0; font-size:14px; color:#1a2128;">
        Card
    </p>
@endif
