<?php

namespace App\Http\Controllers;

use App\Models\AffiliateClick;
use App\Models\AffiliateNetwork;
use App\Models\Post;
use App\Support\RetailerUrl;
use App\Support\SecondRetailer;
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

        // The button of a second store (?retailer=second): its own link and its own network, never the first
        // retailer's link as a fallback. Without a valid second retailer there is nowhere to send the reader.
        if ($request->query('retailer') === 'second') {
            $second = SecondRetailer::of($product);
            abort_unless($second !== null, 404);

            AffiliateClick::create([
                'post_id' => null,
                'product_id' => $product->id,
                'affiliate_network_id' => $second['network']->id,
                'product_name' => (string) $product->translateAttribute('name'),
                'target_url' => $second['url'],
                'referrer' => $request->headers->get('referer'),
            ]);

            return redirect()->away($second['url']);
        }

        // A variant of this product may have its own retailer page (e.g. another colour). A missing, unknown or
        // foreign variant id, or one without its own link, falls back to the product's link.
        $variant = is_numeric($request->query('variant'))
            ? $product->variants()->whereKey((int) $request->query('variant'))->with('values')->first()
            : null;

        // The URL is typed in the admin, so only follow plain web links.
        $url = ($variant ? RetailerUrl::web($variant->translateAttribute('external_url')) : null)
            ?? RetailerUrl::web($product->translateAttribute('external_url'));
        abort_unless($url !== null, 404);

        $variantLabel = $variant ? $variant->values->map(fn ($value) => $value->translate('name'))->implode(', ') : '';

        $networkSlug = trim((string) $product->translateAttribute('affiliate_network_slug'));
        $network = $networkSlug === '' ? null : AffiliateNetwork::where('slug', $networkSlug)->first();

        AffiliateClick::create([
            'post_id' => null,
            'product_id' => $product->id,
            'affiliate_network_id' => $network?->id,
            'product_name' => (string) $product->translateAttribute('name').($variantLabel !== '' ? " ({$variantLabel})" : ''),
            'target_url' => $url,
            'referrer' => $request->headers->get('referer'),
        ]);

        return redirect()->away($url);
    }
}
