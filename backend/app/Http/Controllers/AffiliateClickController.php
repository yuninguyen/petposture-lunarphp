<?php

namespace App\Http\Controllers;

use App\Models\AffiliateClick;
use App\Models\AffiliateNetwork;
use App\Models\Post;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Lunar\Models\Product;

class AffiliateClickController extends Controller
{
    public function redirect(Request $request, Post $post, int $item): RedirectResponse
    {
        $comparisonItem = collect($post->getAllMeta()->get('comparison_items', []))
            ->values()
            ->get($item);

        abort_unless($comparisonItem && filled($comparisonItem['affiliate_url'] ?? null), 404);

        $network = AffiliateNetwork::where('slug', $comparisonItem['retailer'] ?? null)->first();

        $post->clicks()->create([
            'affiliate_network_id' => $network?->id,
            'product_name' => $comparisonItem['product_name'] ?? null,
            'target_url' => $comparisonItem['affiliate_url'],
            'referrer' => $request->headers->get('referer'),
        ]);

        return redirect()->away($comparisonItem['affiliate_url']);
    }

    /** A click on a Pick's "Buy on ..." button: record it, then send the reader to the retailer. */
    public function redirectPick(Request $request, string $slug): RedirectResponse
    {
        $product = Product::query()
            ->where('status', 'published')
            ->whereHas('urls', fn ($query) => $query->where('slug', $slug))
            ->first();
        abort_unless($product, 404);

        // The URL is typed in the admin, so only follow plain web links.
        $url = trim((string) $product->translateAttribute('external_url'));
        abort_unless(filter_var($url, FILTER_VALIDATE_URL) && preg_match('#^https?://#i', $url), 404);

        $networkSlug = trim((string) $product->translateAttribute('affiliate_network_slug'));
        $network = $networkSlug === '' ? null : AffiliateNetwork::where('slug', $networkSlug)->first();

        AffiliateClick::create([
            'post_id' => null,
            'product_id' => $product->id,
            'affiliate_network_id' => $network?->id,
            'product_name' => (string) $product->translateAttribute('name'),
            'target_url' => $url,
            'referrer' => $request->headers->get('referer'),
        ]);

        return redirect()->away($url);
    }
}
