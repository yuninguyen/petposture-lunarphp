<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Post;
use Lunar\Models\Collection;
use Lunar\Models\Product;

class SitemapController extends Controller
{
    /**
     * Generate a dynamic XML sitemap for the headless frontend.
     */
    public function index()
    {
        $frontendUrl = config('app.frontend_url', 'http://localhost:3000');

        $urls = [];

        // 1. Static Pages
        $urls[] = ['loc' => $frontendUrl . '/', 'lastmod' => now()->toAtomString(), 'priority' => '1.0'];
        $urls[] = ['loc' => $frontendUrl . '/shop', 'lastmod' => now()->toAtomString(), 'priority' => '0.8'];
        $urls[] = ['loc' => $frontendUrl . '/our-mission', 'lastmod' => now()->toAtomString(), 'priority' => '0.6'];

        // 2. Lunar Collections (product categories)
        $collections = Collection::with(['defaultUrl', 'urls'])->get();
        foreach ($collections as $collection) {
            $slug = $collection->defaultUrl?->slug
                ?? $collection->urls->first()?->slug;
            if (! $slug) continue;
            $urls[] = [
                'loc'     => $frontendUrl . '/shop/' . $slug,
                'lastmod' => $collection->updated_at->toAtomString(),
                'priority' => '0.7',
            ];
        }

        // 3. Blog posts
        $posts = Post::where('status', 'published')->select('slug', 'updated_at')->get();
        foreach ($posts as $post) {
            $urls[] = [
                'loc'     => $frontendUrl . '/blog/' . $post->slug,
                'lastmod' => $post->updated_at->toAtomString(),
                'priority' => '0.6',
            ];
        }

        // 4. Dynamic Products
        $products = Product::query()
            ->where('status', 'published')
            ->whereHas('variants')
            ->with(['defaultUrl', 'urls', 'collections.defaultUrl'])
            ->get();

        foreach ($products as $product) {
            $productSlug = $product->defaultUrl?->slug
                ?? $product->urls->firstWhere('default', true)?->slug
                ?? $product->urls->first()?->slug;
            $categorySlug = $product->collections->first()?->defaultUrl?->slug ?? 'categories';

            if (! $productSlug) {
                continue;
            }

            $urls[] = [
                'loc' => $frontendUrl . '/shop/' . $categorySlug . '/' . $productSlug,
                'lastmod' => $product->updated_at->toAtomString(),
                'priority' => '0.9'
            ];
        }

        return response()->view('api.sitemap', compact('urls'))
            ->header('Content-Type', 'text/xml');
    }
}
