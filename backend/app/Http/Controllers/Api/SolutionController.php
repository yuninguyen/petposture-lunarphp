<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\Api\PostResource;
use App\Http\Resources\Api\ProductResource;
use App\Models\Solution;

class SolutionController extends Controller
{
    public function index()
    {
        $solutions = Solution::withCount(['products', 'posts'])
            ->with('featuredMedia')
            ->orderBy('name')
            ->get()
            ->map(fn (Solution $solution) => [
                'id' => $solution->id,
                'name' => $solution->name,
                'slug' => $solution->slug,
                'description' => $solution->description,
                'featured_image' => $solution->featured_image,
                'featured_image_alt' => $solution->featured_image_alt,
                'featured_media' => $solution->featuredMedia,
                'products_count' => $solution->products_count,
                'posts_count' => $solution->posts_count,
            ]);

        return response()->json(['data' => $solutions]);
    }

    public function show(string $slug)
    {
        $solution = Solution::with(['featuredMedia', 'seo'])->where('slug', $slug)->firstOrFail();

        $products = $solution->products()
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

        $posts = $solution->posts()
            ->where('status', 'published')
            ->where('published_at', '<=', now())
            ->with(['blogCategory', 'metadata', 'seo', 'featuredMedia'])
            ->latest('published_at')
            ->get();

        return response()->json([
            'data' => [
                'id' => $solution->id,
                'name' => $solution->name,
                'slug' => $solution->slug,
                'description' => $solution->description,
                'featured_image' => $solution->featured_image,
                'featured_image_alt' => $solution->featured_image_alt,
                'featured_media' => $solution->featuredMedia,
                'seo' => $solution->seo,
                'products' => ProductResource::collection($products),
                'posts' => PostResource::collection($posts),
            ],
        ]);
    }
}
