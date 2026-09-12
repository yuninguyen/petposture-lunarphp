<tr>
<td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; padding:4px 0; font-size:14px; color:#1a2128;">Subtotal &middot; {{ $itemCount }} {{ $itemCount === 1 ? 'item' : 'items' }}</td>
<td align="right" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; padding:4px 0; font-size:14px; font-weight:700; color:#1a1a1a;">${{ number_format($subTotal, 2) }}</td>
</tr>
@if($discountTotal > 0)
<tr>
<td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; padding:4px 0; font-size:14px; color:#1a2128;">Discount{{ !empty($couponCode) ? ' (' . strtoupper($couponCode) . ')' : '' }}</td>
<td align="right" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; padding:4px 0; font-size:14px; color:#df8448;">&minus;${{ number_format($discountTotal, 2) }}</td>
</tr>
@endif
<tr>
<td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; padding:4px 0; font-size:14px; color:#1a2128;">Shipping{{ !empty($shippingMethodLabel) ? ' - ' . $shippingMethodLabel : '' }}</td>
<td align="right" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; padding:4px 0; font-size:14px; font-weight:700; color:#1a1a1a;">{{ $shippingTotal > 0 ? '$' . number_format($shippingTotal, 2) : 'Free' }}</td>
</tr>
<tr>
<td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; padding:4px 0; font-size:14px; color:#1a2128;">Estimated Taxes</td>
<td align="right" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif; padding:4px 0; font-size:14px; font-weight:700; color:#1a1a1a;">${{ number_format($taxTotal, 2) }}</td>
</tr>
