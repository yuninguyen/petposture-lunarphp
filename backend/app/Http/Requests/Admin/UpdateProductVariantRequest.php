<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Lunar\Models\Currency;

class UpdateProductVariantRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $variantId = $this->route('variant')?->id ?? $this->route('variant');

        return [
            'sku' => ['required', 'string', 'max:255', Rule::unique('lunar_product_variants', 'sku')->ignore($variantId)],
            'gtin' => ['nullable', 'string', 'max:255'],
            'mpn' => ['nullable', 'string', 'max:255'],
            'ean' => ['nullable', 'string', 'max:255'],
            'stock' => ['required', 'integer', 'min:0'],
            'backorder' => ['required', 'integer', 'min:0'],
            'purchasable' => ['required', Rule::in(['always', 'in_stock', 'in_stock_or_on_backorder'])],
            'unit_quantity' => ['required', 'integer', 'min:1'],
            'quantity_increment' => ['required', 'integer', 'min:1'],
            'min_quantity' => ['required', 'integer', 'min:1'],
            'tax_class_id' => ['required', 'integer', Rule::exists('lunar_tax_classes', 'id')],
            'tax_ref' => ['nullable', 'string', 'max:255'],
            'shippable' => ['required', 'boolean'],
            'length_value' => ['nullable', 'numeric', 'min:0', 'required_with:length_unit'],
            'length_unit' => ['nullable', 'required_with:length_value', Rule::in(['mm', 'cm', 'm', 'in', 'ft'])],
            'width_value' => ['nullable', 'numeric', 'min:0', 'required_with:width_unit'],
            'width_unit' => ['nullable', 'required_with:width_value', Rule::in(['mm', 'cm', 'm', 'in', 'ft'])],
            'height_value' => ['nullable', 'numeric', 'min:0', 'required_with:height_unit'],
            'height_unit' => ['nullable', 'required_with:height_value', Rule::in(['mm', 'cm', 'm', 'in', 'ft'])],
            'weight_value' => ['nullable', 'numeric', 'min:0', 'required_with:weight_unit'],
            'weight_unit' => ['nullable', 'required_with:weight_value', Rule::in(['g', 'kg', 'lb', 'oz'])],
            'base_price' => ['required', $this->currencyDecimalRule()],
            'attributes' => ['required', 'array'],
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
