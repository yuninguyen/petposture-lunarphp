<?php

namespace App\Support;

use Illuminate\Database\Eloquent\Builder;
use Lunar\Models\Product;

/**
 * Whether a product is a Pick (an affiliate showcase product shown at /picks) or a Shop product (one PetPosture
 * sells itself). It is decided by data that is already there, never by a manual flag: a product with a retailer
 * link (the external_url attribute is a web address) is a Pick, everything else is a Shop product.
 * The label of a product and the list filter must agree, so the rule lives here once, in PHP and in SQL.
 */
final class PickKind
{
    public const PICK = 'pick';

    public const SHOP = 'shop';

    private const URL_PATH = 'attribute_data->external_url->value';

    /** The same rule the public Pick page uses to decide whether a product is a Pick. */
    public static function of(Product $product): string
    {
        return RetailerUrl::web($product->translateAttribute('external_url')) !== null ? self::PICK : self::SHOP;
    }

    /** Limits a products query to one kind. The SQL checks for an http(s) address, as RetailerUrl::web does. */
    public static function constrain(Builder $query, string $kind): Builder
    {
        $isPick = fn (Builder $q): Builder => $q
            ->where(self::URL_PATH, 'like', 'http://%')
            ->orWhere(self::URL_PATH, 'like', 'https://%');

        return $kind === self::PICK
            ? $query->where($isPick)
            : $query->where(fn (Builder $q): Builder => $q
                ->whereNull(self::URL_PATH)
                ->orWhere(fn (Builder $other): Builder => $other
                    ->where(self::URL_PATH, 'not like', 'http://%')
                    ->where(self::URL_PATH, 'not like', 'https://%')));
    }
}
