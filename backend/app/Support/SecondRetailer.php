<?php

namespace App\Support;

use App\Models\AffiliateNetwork;
use Lunar\Models\Product;

/**
 * The second store a Pick can be bought from (for example PetSmart, next to Chewy). It exists only when the admin
 * entered a web address AND the slug of an affiliate network that exists, so a button is never drawn for a typo,
 * and the same rule decides both whether the page shows the button and whether /go may follow it.
 */
final class SecondRetailer
{
    /** @return array{url: string, network: AffiliateNetwork}|null */
    public static function of(Product $product): ?array
    {
        $url = RetailerUrl::web($product->translateAttribute('second_retailer_url'));
        $slug = trim((string) $product->translateAttribute('second_retailer_slug'));

        if ($url === null || $slug === '') {
            return null;
        }

        $network = AffiliateNetwork::where('slug', $slug)->first();

        return $network ? ['url' => $url, 'network' => $network] : null;
    }
}
