<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Lunar\Models\Currency;

class StoreProductRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'product_type_id' => ['required', 'integer', Rule::exists('lunar_product_types', 'id')],
            'sku' => ['required', 'string', 'max:255', Rule::unique('lunar_product_variants', 'sku')],
            'base_price' => ['required', $this->currencyDecimalRule()],
        ];
    }

    private function currencyDecimalRule(): \Closure
    {
        return function (string $attribute, mixed $value, \Closure $fail): void {
            if (! is_string($value) && ! is_int($value)) {
                $fail('The base price must be a non-negative decimal amount.');

                return;
            }

            $currency = Currency::getDefault();
            $decimalPlaces = $currency?->decimal_places ?? 0;
            $pattern = $decimalPlaces > 0
                ? '/^\d+(?:\.\d{1,'.$decimalPlaces.'})?$/'
                : '/^\d+$/';

            if (! preg_match($pattern, (string) $value)) {
                $fail("The base price may have at most {$decimalPlaces} decimal places.");

                return;
            }

            if ($currency && bccomp(bcmul((string) $value, (string) $currency->factor, 0), '2147483647', 0) === 1) {
                $fail('The base price is too large.');
            }
        };
    }
}
