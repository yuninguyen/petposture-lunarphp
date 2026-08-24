<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateProductRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'product_type_id' => ['prohibited'],
            'status' => ['required', Rule::in(['draft', 'published'])],
            'brand_id' => ['nullable', 'integer', Rule::exists('lunar_brands', 'id')],
            'attributes' => ['required', 'array'],
            'collections' => ['sometimes', 'array', 'max:500'],
            'collections.*' => ['integer', 'distinct', Rule::exists('lunar_collections', 'id')->whereNull('deleted_at')],
            'media' => ['sometimes', 'array', 'max:100'],
            'media.*.id' => ['required', 'integer'],
            'media.*.source' => ['required', Rule::in(['spatie', 'curator'])],
        ];
    }

    public function withValidator($validator): void
    {
        $validator->after(function ($validator): void {
            $identities = collect($this->input('media', []))
                ->filter(fn ($item) => is_array($item) && isset($item['source'], $item['id']))
                ->map(fn ($item) => $item['source'].':'.$item['id']);

            if ($identities->duplicates()->isNotEmpty()) {
                $validator->errors()->add('media', 'The media list must not contain duplicate items.');
            }
        });
    }
}
