<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ReorderCollectionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'sibling_id' => ['required', 'integer', Rule::exists('lunar_collections', 'id')->whereNull('deleted_at')],
            'position' => ['required', Rule::in(['before', 'after'])],
        ];
    }
}
