<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Lunar\Models\ProductType;

class UpdateProductTypeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        $productType = $this->route('product_type');

        return [
            'name' => [
                'required',
                'string',
                'max:255',
                Rule::unique(ProductType::class, 'name')->ignore($productType?->id ?? $productType),
            ],
        ];
    }
}
