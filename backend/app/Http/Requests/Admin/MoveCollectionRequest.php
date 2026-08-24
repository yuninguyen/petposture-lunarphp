<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class MoveCollectionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'collection_group_id' => ['required', 'integer', Rule::exists('lunar_collection_groups', 'id')],
            'parent_id' => ['nullable', 'integer', Rule::exists('lunar_collections', 'id')->whereNull('deleted_at')],
        ];
    }
}
