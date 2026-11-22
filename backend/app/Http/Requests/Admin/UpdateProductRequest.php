<?php

namespace App\Http\Requests\Admin;

use App\Models\AffiliateNetwork;
use App\Support\PickKind;
use App\Support\RetailerUrl;
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
            // The stores after the first one (the first is in the attributes). Any number up to a sensible cap.
            'merchants' => ['sometimes', 'array', 'max:10'],
            'merchants.*.id' => ['nullable', 'integer'],
            'merchants.*.affiliate_network_id' => ['required', 'integer', Rule::exists('affiliate_networks', 'id')],
            'merchants.*.url' => ['required', 'string', 'max:2048'],
            'merchants.*.price' => ['nullable', 'numeric', 'min:0', 'max:99999999'],
            'merchants.*.price_checked_date' => ['nullable', 'date_format:Y-m-d'],
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

            $this->validateRetailerLink($validator);
            $this->validateMerchants($validator);
        });
    }

    /**
     * Each other store needs a plain web link, and a store may appear once: not twice in the list, and not again
     * as the first store (whose network slug is in the attributes).
     */
    private function validateMerchants($validator): void
    {
        $merchants = $this->input('merchants');

        if (! is_array($merchants)) {
            return;
        }

        $attributes = $this->input('attributes');
        $firstSlug = is_array($attributes) && is_string($attributes['affiliate_network_slug'] ?? null)
            ? trim($attributes['affiliate_network_slug'])
            : trim((string) $this->route('product')?->translateAttribute('affiliate_network_slug'));
        $firstNetworkId = $firstSlug === '' ? null : AffiliateNetwork::where('slug', $firstSlug)->value('id');
        $seen = [];

        foreach ($merchants as $index => $merchant) {
            if (! is_array($merchant)) {
                continue;
            }

            if (is_string($merchant['url'] ?? null) && RetailerUrl::web($merchant['url']) === null) {
                $validator->errors()->add("merchants.{$index}.url", 'The store link must start with http:// or https://.');
            }

            $networkId = isset($merchant['affiliate_network_id']) ? (int) $merchant['affiliate_network_id'] : null;

            if ($networkId !== null && ($networkId === $firstNetworkId || in_array($networkId, $seen, true))) {
                $validator->errors()->add("merchants.{$index}.affiliate_network_id", 'This store is already on the list.');
            }

            if ($networkId !== null) {
                $seen[] = $networkId;
            }
        }
    }

    /**
     * The retailer link decides whether a product is a Pick, so a save may not leave a contradiction: a link that is
     * not a web address, or a Pick whose link was emptied. A Shop product may stay without a link, or get a good one.
     */
    private function validateRetailerLink($validator): void
    {
        $attributes = $this->input('attributes');

        if (! is_array($attributes) || ! array_key_exists('external_url', $attributes) || is_array($attributes['external_url'])) {
            return;
        }

        $url = trim((string) $attributes['external_url']);
        $product = $this->route('product');

        if ($url !== '' && RetailerUrl::web($url) === null) {
            $validator->errors()->add('attributes.external_url', 'The retailer link must start with http:// or https://.');
        } elseif ($url === '' && $product && PickKind::of($product) === PickKind::PICK) {
            $validator->errors()->add('attributes.external_url', 'A Pick needs its retailer link; it cannot be left empty.');
        }
    }
}
