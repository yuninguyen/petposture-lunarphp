<?php

namespace App\Tax\Providers;

use App\Tax\Contracts\SalesTaxProviderInterface;
use Illuminate\Support\Facades\Http;
use RuntimeException;

class StripeTaxSalesTaxProvider implements SalesTaxProviderInterface
{
    public function quote(array $address, int $taxableAmount): array
    {
        $secret = (string) config('services.stripe.secret');

        if ($secret === '') {
            throw new RuntimeException('Stripe Tax is not configured.');
        }

        $country = $this->normalizeCountry($address['country'] ?? null);
        $state = strtoupper(trim((string) ($address['state'] ?? '')));
        $postcode = trim((string) ($address['postcode'] ?? ''));
        $city = trim((string) ($address['city'] ?? ''));

        if ($country === '' || $state === '' || $postcode === '') {
            throw new RuntimeException('Stripe Tax requires country, state, and postcode.');
        }

        $response = Http::withBasicAuth($secret, '')
            ->asForm()
            ->post('https://api.stripe.com/v1/tax/calculations', array_filter([
                'currency' => 'usd',
                'customer_details[address][country]' => $country,
                'customer_details[address][state]' => $state,
                'customer_details[address][postal_code]' => $postcode,
                'customer_details[address][city]' => $city ?: null,
                'line_items[0][amount]' => max(0, $taxableAmount),
                'line_items[0][reference]' => 'checkout-subtotal',
                'line_items[0][tax_behavior]' => 'exclusive',
                'line_items[0][tax_code]' => (string) config('services.stripe.tax.default_product_tax_code', 'txcd_99999999'),
            ], static fn ($value) => $value !== null && $value !== ''));

        if (! $response->successful()) {
            throw new RuntimeException(
                $response->json('error.message')
                    ?? 'Stripe Tax calculation failed.'
            );
        }

        $taxAmount = (int) ($response->json('tax_amount_exclusive') ?? 0);
        $taxBreakdown = collect($response->json('tax_breakdown') ?? []);
        $stateRate = (float) $taxBreakdown
            ->filter(fn ($item) => str_contains(strtolower((string) ($item['jurisdiction'] ?? '')), 'state'))
            ->sum(fn ($item) => (float) ($item['tax_rate_details']['percentage_decimal'] ?? 0));
        $combinedRate = $taxableAmount > 0
            ? round(($taxAmount / $taxableAmount) * 100, 4)
            : 0.0;
        $localRate = round(max(0, $combinedRate - $stateRate), 4);

        return [
            'state_code' => $state,
            'state_rate_percentage' => $stateRate,
            'avg_local_rate_percentage' => $localRate,
            'rate_percentage' => $combinedRate,
            'tax_amount' => $taxAmount,
            'provider' => 'stripe-tax',
            'is_estimate' => false,
            'source_label' => 'Stripe Tax calculation',
            'source_url' => 'https://docs.stripe.com/tax',
            'effective_date' => now()->toDateString(),
        ];
    }

    private function normalizeCountry(?string $country): string
    {
        $value = strtoupper(trim((string) $country));

        return match ($value) {
            'UNITED STATES', 'USA' => 'US',
            default => $value,
        };
    }
}
