<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SeoMetadata;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SeoController extends Controller
{
    // GET /api/seo?path=/shop/product-slug
    public function show(Request $request): JsonResponse
    {
        $path = ltrim((string) $request->query('path', ''), '/');

        if ($path === '') {
            return response()->json(['error' => 'path query parameter is required'], 422);
        }

        $seo = SeoMetadata::where('path', $path)
            ->orWhere('path', '/' . $path)
            ->first();

        if (!$seo) {
            return response()->json(['error' => 'Not found'], 404);
        }

        return response()->json([
            'title'         => $seo->title,
            'description'   => $seo->description,
            'og_image'      => $seo->og_image,
            'canonical_url' => $seo->canonical_url,
        ]);
    }
}