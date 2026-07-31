<?php

namespace App\Services;

use App\Models\User;
use App\Models\UserWishlistItem;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;
use Lunar\Models\Product;

class WishlistService
{
    private const PRODUCT_EAGER_LOADS = [
        'variants.prices',
        'variants.values.option',
        'variants.images',
        'thumbnail',
        'images',
        'defaultUrl',
        'urls',
        'collections.defaultUrl',
        'productOptions.values',
    ];

    public function list(User $user): Collection
    {
        $productIds = $user->wishlistItems()
            ->orderByDesc('created_at')
            ->pluck('lunar_product_id');

        $products = Product::whereIn('id', $productIds)
            ->with(self::PRODUCT_EAGER_LOADS)
            ->get()
            ->keyBy('id');

        return $productIds
            ->map(fn ($id) => $products->get($id))
            ->filter()
            ->values();
    }

    public function add(User $user, int $productId): void
    {
        $product = Product::where('id', $productId)->where('status', 'published')->first();

        if (! $product) {
            throw ValidationException::withMessages([
                'product_id' => ['This product is not available.'],
            ]);
        }

        UserWishlistItem::firstOrCreate([
            'user_id' => $user->id,
            'lunar_product_id' => $productId,
        ]);
    }

    public function remove(User $user, int $productId): void
    {
        $user->wishlistItems()->where('lunar_product_id', $productId)->delete();
    }
}
