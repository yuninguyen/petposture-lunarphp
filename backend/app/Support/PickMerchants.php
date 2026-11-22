<?php

namespace App\Support;

use App\Models\PickMerchant;
use Illuminate\Support\Collection;
use Lunar\Models\Product;

/**
 * The stores a Pick can be bought from after its first one (for example PetSmart or Amazon next to Chewy). A store
 * counts only when its address is a plain web link AND its affiliate network exists, so a button is never drawn for
 * a broken row, and the same rule decides both whether the page shows a button and whether /go may follow it.
 */
final class PickMerchants
{
    /** @return Collection<int, PickMerchant> in the order the admin put them, each with its network loaded */
    public static function of(Product $product): Collection
    {
        return PickMerchant::query()
            ->with('network')
            ->where('product_id', $product->id)
            ->orderBy('position')
            ->orderBy('id')
            ->get()
            ->filter(fn (PickMerchant $merchant): bool => $merchant->network !== null && RetailerUrl::web($merchant->url) !== null)
            ->values();
    }
}
