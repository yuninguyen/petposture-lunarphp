<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreCollectionGroupRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255', Rule::unique('lunar_collection_groups', 'name')],
            'handle' => ['required', 'string', 'max:255', Rule::unique('lunar_collection_groups', 'handle')],
        ];
    }
}
