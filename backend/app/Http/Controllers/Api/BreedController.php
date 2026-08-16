<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\Api\PostResource;
use App\Http\Resources\Api\ProductResource;
use App\Models\Breed;

class BreedController extends Controller
{
    public function index()
    {
        $breeds = Breed::withCount(['products', 'posts'])
            ->orderBy('name')
            ->get()
            ->map(fn (Breed $breed) => [
                'id' => $breed->id,
                'name' => $breed->name,
                'slug' => $breed->slug,
                'body_type' => $breed->body_type,
                'description' => $breed->description,
                'products_count' => $breed->products_count,
                'posts_count' => $breed->posts_count,
            ]);

        return response()->json(['data' => $breeds]);
    }

    public function show(string $slug)
    {
        $breed = Breed::where('slug', $slug)->firstOrFail();

        $products = $breed->products()
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
            ])
            ->get();

        $posts = $breed->posts()
            ->where('status', 'published')
            ->where('published_at', '<=', now())
            ->with(['blogCategory', 'metadata', 'seo'])
            ->latest('published_at')
            ->get();

        return response()->json([
            'data' => [
                'id' => $breed->id,
                'name' => $breed->name,
                'slug' => $breed->slug,
                'body_type' => $breed->body_type,
                'description' => $breed->description,
                'products' => ProductResource::collection($products),
                'posts' => PostResource::collection($posts),
            ],
        ]);
    }
}
