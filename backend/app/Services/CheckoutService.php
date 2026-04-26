<?php

namespace App\Services;

use App\Payments\PaymentGatewayManager;
use App\Services\SalesTaxService;
use Illuminate\Support\Facades\DB;
use Lunar\Base\ShippingManifestInterface;
use Lunar\DataTypes\Price as PriceDataType;
use Lunar\DataTypes\ShippingOption;
use Lunar\Models\Cart;
use Lunar\Models\Channel;
use Lunar\Models\Contracts\Order;
use Lunar\Models\Country;
use Lunar\Models\Currency;
use Lunar\Models\Discount;
use Lunar\Models\OrderLine;
use Lunar\Models\ProductVariant;
use Lunar\Models\TaxClass;

class CheckoutService
{
    public function __construct(
        private readonly SalesTaxService $salesTaxService,
        private readonly PaymentGatewayManager $paymentGatewayManager,
        private readonly OrderEventService $orderEventService,
    ) {
    }

    public function placeOrder(array $payload, ?int $userId = null): Order
    {
        return DB::transaction(function () use ($payload, $userId) {
            /** @var \Lunar\Models\Order $order */
            $shippingMethod = $payload['shipping_method'] ?? 'standard';
            $paymentPreparation = $this->paymentGatewayManager
                ->forMethod($payload['payment_method'] ?? 'cod')
                ->prepare($payload);
            $customerNote = $this->nullableString($payload['customer_note'] ?? null);
            $shippingInput = $payload['shipping'] ?? [];
            $billingInput = !empty($payload['billing_same_as_shipping'])
                ? $shippingInput
                : (($payload['billing'] ?? []) ?: $shippingInput);

            $cart = Cart::create([
                'currency_id' => Currency::getDefault()->id,
                'channel_id' => Channel::getDefault()->id,
                'user_id' => $userId,
            ]);

            foreach ($payload['items'] as $item) {
                $variant = ProductVariant::findOrFail($item['variantId']);
                $cart->add($variant, $item['quantity']);
            }

            if (!empty($payload['coupon_code'])) {
                $cart->coupon_code = $payload['coupon_code'];
            }

            $cart->save();
            $cart->calculate();

            $shippingCountry = $this->resolveCountry($shippingInput);
            $billingCountry = $this->resolveCountry($billingInput) ?? $shippingCountry;
            $shippingEmail = (string) ($shippingInput['email'] ?? '');

            $cart->shippingAddress()->create(array_merge(
                $this->buildAddressData($shippingInput, $shippingEmail, $shippingCountry),
                ['type' => 'shipping']
            ));
            $cart->billingAddress()->create(array_merge(
                $this->buildAddressData($billingInput, $shippingEmail, $billingCountry),
                ['type' => 'billing']
            ));

            $cart->load(['shippingAddress', 'billingAddress']);
            $cart->calculate();

            $shippingManifest = app(ShippingManifestInterface::class);
            $shippingOptions = $shippingManifest->getOptions($cart);

            $shippingOption = $shippingOptions->first(
                fn($option) => $option->identifier === $shippingMethod
            ) ?? $shippingOptions->first();

            if (!$shippingOption) {
                $shippingOption = $this->makeFallbackShippingOption($cart, $shippingMethod);
            }

            // Avoid the internal refresh here so the reset breakdown survives
            // long enough for Lunar to rebuild the shipping totals correctly.
            $cart->shippingBreakdown = null;
            $cart->setShippingOption($shippingOption, false);
            $cart->calculate();

            $order = $cart->createOrder();
            $discountValue = $this->resolveDiscountValue($payload['coupon_code'] ?? null, $cart->currency);
            $subTotalValue = $this->resolveCartSubTotal($cart);
            $taxContext = $this->resolveTaxContext(
                $shippingInput,
                max(0, $subTotalValue - $discountValue),
            );
            $this->normalizeOrderFinancials(
                $order,
                $shippingOption,
                $payload['coupon_code'] ?? null,
                $taxContext,
            );

            $orderMeta = (array) ($order->meta ?? []);
            $orderMeta['shipping_method'] = $shippingMethod;
            $orderMeta['tracking_number'] = $order->reference;
            $orderMeta['customer_note'] = $customerNote;
            $orderMeta['internal_note'] = $orderMeta['internal_note'] ?? null;
            $orderMeta['tax_state'] = $taxContext['state_code'];
            $orderMeta['tax_rate_percentage'] = $taxContext['rate_percentage'];
            $orderMeta['tax_state_rate_percentage'] = $taxContext['state_rate_percentage'];
            $orderMeta['tax_avg_local_rate_percentage'] = $taxContext['avg_local_rate_percentage'];
            $orderMeta['tax_amount'] = $taxContext['tax_amount'];
            $orderMeta['tax_provider'] = $taxContext['provider'];
            $orderMeta['tax_provider_requested'] = $taxContext['provider_requested'];
            $orderMeta['tax_provider_fallback_applied'] = $taxContext['provider_fallback_applied'];
            $orderMeta['tax_provider_fallback'] = $taxContext['provider_fallback'];
            $orderMeta['tax_provider_fallback_reason'] = $taxContext['provider_fallback_reason'];
            $orderMeta['tax_is_estimate'] = $taxContext['is_estimate'];
            $orderMeta['tax_source_label'] = $taxContext['source_label'];
            $orderMeta['tax_source_url'] = $taxContext['source_url'];
            $orderMeta['tax_effective_date'] = $taxContext['effective_date'];
            $orderMeta['coupon_code'] = $payload['coupon_code'] ?? null;
            $orderMeta = array_merge($orderMeta, $paymentPreparation->toMeta());
            $order->update([
                'customer_reference' => $shippingEmail,
                'status' => $paymentPreparation->orderStatus,
                'meta' => $orderMeta,
                'notes' => $customerNote,
            ]);

            $this->orderEventService->record(
                $order,
                'order.created',
                'Order created',
                'Checkout completed by customer.',
                dedupeAgainstLatest: false,
            );

            return $order->refresh()->loadMissing(['lines', 'shippingAddress', 'billingAddress', 'orderEvents']);
        });
    }

    public function supportedPaymentMethods(): array
    {
        return $this->paymentGatewayManager->supportedMethods();
    }

    /**
     * Calculate the order total server-side from cart contents.
     * Used by preparePaymentIntent so the Stripe amount is never client-supplied.
     * Returns total in minor currency units (cents).
     */
    public function calculateTotal(
        array $items,
        ?string $couponCode,
        ?array $shipping,
        ?string $shippingMethod
    ): int {
        $currency = Currency::getDefault();
        $subTotal = 0;

        foreach ($items as $item) {
            $variant = ProductVariant::with(['prices' => fn ($q) => $q->where('currency_id', $currency->id)])
                ->findOrFail($item['variantId']);
            $price = $variant->prices->sortBy('min_quantity')->first();
            $subTotal += $this->normalizeAmount($price?->price) * max(1, (int) $item['quantity']);
        }

        $discount = $couponCode
            ? Discount::active()->where('coupon', $couponCode)->first()
            : null;

        $discountValue = $this->resolveDiscountValue($couponCode, $currency);

        // resolveDiscountValue only covers fixed discounts; handle percentage here
        if ($discount && $discountValue === 0 && $discount->type === \Lunar\DiscountTypes\AmountOff::class) {
            $percentage = (float) ($discount->data['percentage'] ?? 0);
            if ($percentage > 0) {
                $discountValue = (int) round($subTotal * ($percentage / 100));
            }
        }

        $isFreeShipping = (bool) ($discount?->data['free_shipping'] ?? false);
        $shippingValue = (! $isFreeShipping && ($shippingMethod ?? 'standard') === 'express') ? 2500 : 0;

        $taxableAmount = max(0, $subTotal - $discountValue);
        $taxAmount = 0;

        if (! empty($shipping)) {
            $taxContext = $this->resolveTaxContext($shipping, $taxableAmount);
            $taxAmount = (int) max(0, $taxContext['tax_amount'] ?? 0);
        }

        return max(1, $subTotal + $shippingValue - $discountValue + $taxAmount);
    }

    private function resolveCountry(array $address): ?Country
    {
        $countryInput = trim((string) ($address['country'] ?? 'US'));
        $countryCode = strtoupper($countryInput);

        return Country::query()
            ->where('iso2', $countryCode)
            ->orWhere('name', $countryInput)
            ->first()
            ?? Country::where('iso2', 'US')->first()
            ?? Country::first();
    }

    private function buildAddressData(array $address, string $email, ?Country $country): array
    {
        return [
            'first_name' => trim((string) ($address['first_name'] ?? 'Customer')),
            'last_name' => trim((string) ($address['last_name'] ?? '')),
            'company_name' => $this->nullableString($address['company'] ?? null),
            'line_one' => trim((string) ($address['line_one'] ?? '')),
            'line_two' => $this->nullableString($address['line_two'] ?? null),
            'city' => trim((string) ($address['city'] ?? '')),
            'state' => trim((string) ($address['state'] ?? '')),
            'postcode' => trim((string) ($address['postcode'] ?? '')),
            'country_id' => $country?->id,
            'contact_email' => $email,
            'contact_phone' => $this->nullableString($address['phone'] ?? null),
        ];
    }

    private function makeFallbackShippingOption(Cart $cart, string $shippingMethod): ShippingOption
    {
        $taxClass = TaxClass::first() ?? TaxClass::create(['name' => 'Default']);
        $shippingAmount = $shippingMethod === 'express' ? 2500 : 0;
        $shippingName = $shippingMethod === 'express'
            ? 'Express Shipping'
            : 'Standard Shipping';

        return new ShippingOption(
            $shippingName,
            $shippingName,
            $shippingMethod,
            new PriceDataType($shippingAmount, $cart->currency, 1),
            $taxClass,
            null,
            $shippingMethod
        );
    }

    private function normalizeOrderFinancials(
        Order $order,
        ShippingOption $shippingOption,
        ?string $couponCode = null,
        array $taxContext = []
    ): void {
        /** @var \Lunar\Models\Order $order */
        $currency = Currency::query()->where('code', $order->currency_code)->first() ?? Currency::getDefault();
        $shippingValue = $shippingOption->price->value;
        $discountValue = $this->resolveDiscountValue($couponCode, $currency);
        $taxRatePercentage = (float) ($taxContext['rate_percentage'] ?? 0);
        $subTotalValue = 0;
        $lineSubTotals = [];

        $order->loadMissing(['lines']);

        foreach ($order->lines->where('type', '!=', 'shipping') as $line) {
            $unitPrice = $this->resolveOrderLineUnitPrice($line, $currency);
            $lineSubTotal = $unitPrice * max(1, (int) $line->quantity);
            $subTotalValue += $lineSubTotal;
            $lineSubTotals[$line->id] = $lineSubTotal;

            $line->update([
                'unit_price' => $unitPrice,
                'sub_total' => $lineSubTotal,
                'discount_total' => 0,
                'tax_total' => 0,
                'total' => $lineSubTotal,
            ]);
        }

        $shippingLine = $order->lines->firstWhere('type', 'shipping');

        if ($shippingLine instanceof OrderLine) {
            $shippingLine->update([
                'unit_price' => $shippingValue,
                'sub_total' => $shippingValue,
                'discount_total' => 0,
                'tax_total' => 0,
                'total' => $shippingValue,
            ]);
        }

        $taxableValue = max(0, $subTotalValue - $discountValue);
        $taxTotalValue = array_key_exists('tax_amount', $taxContext)
            ? (int) max(0, $taxContext['tax_amount'])
            : (int) round($taxableValue * ($taxRatePercentage / 100));
        $allocatedTax = 0;
        $taxableLines = $order->lines->where('type', '!=', 'shipping')->values();

        foreach ($taxableLines as $index => $line) {
            $lineSubTotal = $lineSubTotals[$line->id] ?? 0;
            $lineDiscount = $subTotalValue > 0
                ? (int) round($discountValue * ($lineSubTotal / $subTotalValue))
                : 0;

            if ($index === $taxableLines->count() - 1) {
                $lineTax = $taxTotalValue - $allocatedTax;
            } else {
                $lineTaxableValue = max(0, $lineSubTotal - $lineDiscount);
                $lineTax = (int) round($lineTaxableValue * ($taxRatePercentage / 100));
                $allocatedTax += $lineTax;
            }

            $line->update([
                'discount_total' => $lineDiscount,
                'tax_total' => $lineTax,
                'total' => max(0, $lineSubTotal - $lineDiscount + $lineTax),
            ]);
        }

        $order->update([
            'sub_total' => $subTotalValue,
            'discount_total' => $discountValue,
            'shipping_total' => $shippingValue,
            'tax_total' => $taxTotalValue,
            'total' => max(0, $subTotalValue + $shippingValue - $discountValue + $taxTotalValue),
        ]);

        $order->refresh();
    }

    private function resolveTaxContext(array $shippingInput, int $taxableAmount): array
    {
        $quote = $this->salesTaxService->quote(
            [
                'state' => $shippingInput['state'] ?? null,
                'country' => $shippingInput['country'] ?? 'US',
                'postcode' => $shippingInput['postcode'] ?? null,
                'city' => $shippingInput['city'] ?? null,
            ],
            $taxableAmount,
        );

        return [
            'state_code' => $quote['state_code'] ?? null,
            'state_rate_percentage' => $quote['state_rate_percentage'] ?? 0,
            'avg_local_rate_percentage' => $quote['avg_local_rate_percentage'] ?? 0,
            'rate_percentage' => $quote['rate_percentage'] ?? 0,
            'tax_amount' => $quote['tax_amount'] ?? 0,
            'provider' => $quote['provider'] ?? 'state-average',
            'provider_requested' => $quote['provider_requested'] ?? ($quote['provider'] ?? 'state-average'),
            'provider_fallback_applied' => $quote['provider_fallback_applied'] ?? false,
            'provider_fallback' => $quote['provider_fallback'] ?? null,
            'provider_fallback_reason' => $quote['provider_fallback_reason'] ?? null,
            'is_estimate' => $quote['is_estimate'] ?? true,
            'source_label' => $quote['source_label'] ?? null,
            'source_url' => $quote['source_url'] ?? null,
            'effective_date' => $quote['effective_date'] ?? null,
        ];
    }

    private function resolveCartSubTotal(Cart $cart): int
    {
        $cart->loadMissing(['lines.purchasable.prices']);

        return (int) $cart->lines->sum(function ($line) use ($cart) {
            $purchasable = $line->purchasable;

            if (!$purchasable) {
                return 0;
            }

            $price = $this->normalizeAmount(
                $purchasable->prices->firstWhere('currency_id', $cart->currency_id)?->price
            );

            return $price * max(1, (int) $line->quantity);
        });
    }

    private function resolveOrderLineUnitPrice(OrderLine $line, Currency $currency): int
    {
        $storedUnitPrice = $this->normalizeAmount($line->unit_price);

        if ($storedUnitPrice > 0) {
            return $storedUnitPrice;
        }

        $purchasable = $line->purchasable;

        if (!$purchasable) {
            return 0;
        }

        return $this->normalizeAmount(
            $purchasable->prices->firstWhere('currency_id', $currency->id)?->price
        );
    }

    private function normalizeAmount(mixed $amount): int
    {
        if (is_object($amount) && property_exists($amount, 'value')) {
            return (int) $amount->value;
        }

        if (is_object($amount) && method_exists($amount, 'value')) {
            return (int) $amount->value();
        }

        return is_numeric($amount) ? (int) $amount : 0;
    }

    private function resolveDiscountValue(?string $couponCode, Currency $currency): int
    {
        if (!$couponCode) {
            return 0;
        }

        $discount = Discount::active()->where('coupon', $couponCode)->first();
        $fixedValues = $discount?->data['fixed_values'] ?? [];

        return (int) ($fixedValues[$currency->code] ?? 0);
    }

    private function nullableString(mixed $value): ?string
    {
        $value = is_string($value) ? trim($value) : null;

        return $value !== '' ? $value : null;
    }
}
