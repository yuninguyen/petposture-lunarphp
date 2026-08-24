<?php

namespace App\Services;

use Illuminate\Support\Str;
use Lunar\Models\Product;

class ProductRouteService
{
    public function categorySlug(Product $product): string
    {
        if (! $product->relationLoaded('collections')) {
            $product->load('collections.defaultUrl');
        }

        $firstCollection = $product->collections->first();

        return $firstCollection?->defaultUrl?->slug
            ?? ($firstCollection ? Str::slug($firstCollection->translateAttribute('name')) : 'categories');
    }

    public function slug(Product $product): string
    {
        $product->loadMissing(['defaultUrl', 'urls']);

        return $product->defaultUrl?->slug
            ?? $product->urls->firstWhere('default', true)?->slug
            ?? $product->urls->first()?->slug
            ?? $product->translateAttribute('legacy_product_slug')
            ?? (string) $product->id;
    }

    public function path(Product $product): string
    {
        return '/shop/'.$this->categorySlug($product).'/'.$this->slug($product);
    }
}
