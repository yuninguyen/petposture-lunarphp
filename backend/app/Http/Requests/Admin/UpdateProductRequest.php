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
        $product = $this->route('product');
        $defaultUrlId = $product?->defaultUrl()->value('id');

        return [
            'product_type_id' => ['prohibited'],
            'slug' => [
                'sometimes',
                'string',
                'max:255',
                'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/',
                Rule::unique('lunar_urls', 'slug')->ignore($defaultUrlId),
            ],
            'status' => ['required', Rule::in(['draft', 'published'])],
            'brand_id' => ['nullable', 'integer', Rule::exists('lunar_brands', 'id')],
            'attributes' => ['required', 'array'],
            'collections' => ['sometimes', 'array', 'max:500'],
            'collections.*' => ['integer', 'distinct', Rule::exists('lunar_collections', 'id')->whereNull('deleted_at')],
            'media' => ['sometimes', 'array', 'max:100'],
            'media.*.id' => ['required', 'integer'],
            'media.*.source' => ['required', Rule::in(['spatie', 'curator'])],
            'media.*.alt' => ['nullable', 'string', 'max:255'],
            'seo' => ['sometimes', 'array'],
            'seo.title' => ['nullable', 'string', 'max:60'],
            'seo.description' => ['nullable', 'string', 'max:160'],
            'seo.keyphrase' => ['nullable', 'string', 'max:255'],
            'seo.og_title' => ['nullable', 'string', 'max:255'],
            'seo.og_description' => ['nullable', 'string', 'max:500'],
            'seo.og_image' => ['nullable', 'string', 'max:2048'],
            'seo.canonical_url' => ['nullable', 'url', 'max:2048'],
            'seo.is_indexable' => ['required_with:seo', 'boolean'],
            'seo.is_followable' => ['required_with:seo', 'boolean'],
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
