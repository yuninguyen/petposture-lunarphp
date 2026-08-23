<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateCustomFieldRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $productTypesTable = config('lunar.database.table_prefix').'product_types';

        return [
            'name' => ['required', 'string', 'max:255'],
            'handle' => ['prohibited'],
            'target' => ['prohibited'],
            'field_type' => ['prohibited'],
            'required' => ['required', 'boolean'],
            'product_type_ids' => ['required', 'array', 'min:1'],
            'product_type_ids.*' => ['required', 'integer', 'distinct', Rule::exists($productTypesTable, 'id')],
        ];
    }
}
