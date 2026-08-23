<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class StoreCustomFieldRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        $name = $this->input('name');

        if (! $this->filled('handle') && is_string($name)) {
            $this->merge(['handle' => Str::snake($name)]);
        }
    }

    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $attributeType = $this->input('target') === 'variant' ? 'product_variant' : 'product';
        $attributesTable = config('lunar.database.table_prefix').'attributes';
        $productTypesTable = config('lunar.database.table_prefix').'product_types';

        return [
            'name' => ['required', 'string', 'max:255'],
            'handle' => [
                'required',
                'string',
                'max:255',
                'regex:/^[a-z0-9_]+$/',
                Rule::unique($attributesTable, 'handle')->where(
                    fn ($query) => $query->where('attribute_type', $attributeType)
                ),
            ],
            'target' => ['required', Rule::in(['product', 'variant'])],
            'field_type' => ['required', Rule::in(['text'])],
            'required' => ['required', 'boolean'],
            'product_type_ids' => ['required', 'array', 'min:1'],
            'product_type_ids.*' => ['required', 'integer', 'distinct', Rule::exists($productTypesTable, 'id')],
        ];
    }
}
