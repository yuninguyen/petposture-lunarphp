<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SiteMedia;
use App\Traits\HttpResponses;
use Illuminate\Http\Request;

class SiteMediaController extends Controller
{
    use HttpResponses;

    /**
     * Public read-only feed of admin-uploaded site media (Media Library →
     * Upload Files), used by storefront components (currently just Hero) to
     * swap out their default static image without a code change. Match by
     * `title` — e.g. a SiteMedia record titled "hero" overrides the Hero
     * background.
     */
    public function index(Request $request)
    {
        $collection = $request->query('collection', 'banner');

        $items = SiteMedia::query()
            ->where('collection', $collection)
            ->latest('id')
            ->get()
            ->flatMap(fn (SiteMedia $siteMedia) => $siteMedia->getMedia($collection)->map(fn ($media) => [
                'title' => $siteMedia->title,
                'url' => $media->getUrl(),
            ]));

        return $this->success($items);
    }
}
