<?php

namespace App\Support;

use App\Models\Post;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Lunar\Models\Product;

/**
 * What readers may see of the post <-> Pick links. The links live in post_product and are never removed when a side is
 * unpublished; they are filtered here, on the way out, so publishing again brings them back. Both sides apply the same
 * rule: a post counts when it is live (published and past its publish date), a Pick when its product is published, has
 * a variant (the storefront cannot show one without) and still has a retailer link.
 */
final class PostPickLinks
{
    /** The Picks readers may see for a post, in the order they were chosen. */
    public static function picksOf(Post $post): Collection
    {
        // The chosen order is the order the links were added; PickKind::constrain wants a plain product query.
        $ids = DB::table('post_product')->where('post_id', $post->id)->orderBy('id')->pluck('lunar_product_id')->all();

        $query = Product::query()
            ->whereIn('id', $ids)
            ->where('status', 'published')
            ->whereHas('variants')
            ->with([
                'variants.prices',
                'variants.values.option',
                'variants.images',
                'thumbnail',
                'images',
                'defaultUrl',
                'urls',
                'collections.defaultUrl',
                'productOptions.values',
                'brand',
            ]);

        return PickKind::constrain($query, PickKind::PICK)->get()
            ->sortBy(fn (Product $product) => array_search($product->id, $ids, true))
            ->values();
    }

    /** The few fields a "Mentioned in" card needs; the article body is left out on purpose. */
    public static function summary(Post $post): array
    {
        $image = $post->featuredMedia?->url ?? $post->featured_image;
        if (is_string($image) && $image !== '' && ! filter_var($image, FILTER_VALIDATE_URL)) {
            $image = asset('storage/'.ltrim($image, '/'));
        }

        return [
            'id' => $post->id,
            'title' => $post->title,
            'slug' => $post->slug,
            'category' => $post->getRelationValue('blogCategory')?->name,
            'published_at' => $post->published_at?->toISOString(),
            'read_time' => $post->read_time,
            'featured_image' => is_string($image) && $image !== '' ? $image : null,
            'featured_image_alt' => $post->featured_image_alt,
        ];
    }

    /** The live posts that mention a Pick, newest first. Empty for a product that is not a Pick. */
    public static function postsOf(Product $product): Collection
    {
        if (PickKind::of($product) !== PickKind::PICK) {
            return collect();
        }

        return $product->posts()
            ->live()
            ->with(['blogCategory', 'featuredMedia'])
            ->latest('posts.published_at')
            ->get();
    }
}
