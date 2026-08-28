<?php

namespace App\Observers;

use Illuminate\Support\Str;
use Lunar\Models\Product;

class ProductBadgeIndexObserver
{
    public function saving(Product $product): void
    {
        $badge = trim((string) $product->translateAttribute('badge'));

        $product->setAttribute('badge_slug', $badge === '' ? null : Str::slug($badge));
    }
}
