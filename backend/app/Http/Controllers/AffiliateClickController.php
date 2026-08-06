<?php

namespace App\Http\Controllers;

use App\Models\AffiliateNetwork;
use App\Models\Post;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

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
}
