<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SeoMetadata;
use Illuminate\Http\JsonResponse;

class SeoController extends Controller
{
    public function show(string $path): JsonResponse
    {
        $seo = SeoMetadata::where('path', $path)->first();

        if (!$seo) {
            return response()->json(['error' => 'Not found'], 404);
        }

        return response()->json([
            'title' => $seo->title,
            'description' => $seo->description,
            'og_image' => $seo->og_image,
            'canonical_url' => $seo->canonical_url,
        ]);
    }
}