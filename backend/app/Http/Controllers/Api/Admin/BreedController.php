<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Breed;
use App\Http\Resources\Admin\BreedResource;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;

class BreedController extends Controller
{
    public function index(Request $request)
    {
        $query = Breed::withCount(['posts', 'products'])->with(['featuredMedia']);

        if ($request->has('search')) {
            $search = $request->input('search');
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('slug', 'like', "%{$search}%");
            });
        }

        $perPage = $request->input('per_page', 10);
        $breeds = $query->latest()->paginate($perPage);

        return BreedResource::collection($breeds);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'slug' => 'required|string|max:255|unique:breeds,slug',
            'body_type' => 'nullable|string|max:255',
            'description' => 'nullable|string',
            'featured_image' => 'nullable|string',
            'featured_image_alt' => 'nullable|string|max:255',
            'featured_media_id' => 'nullable|integer|exists:curator_media,id',
            'seo' => 'nullable|array',
            'seo.title' => 'nullable|string|max:60',
            'seo.keyphrase' => 'nullable|string|max:255',
            'seo.description' => 'nullable|string|max:160',
            'seo.og_title' => 'nullable|string|max:255',
            'seo.og_description' => 'nullable|string|max:500',
            'seo.og_image' => 'nullable|string|max:2048',
            'product_ids' => 'nullable|array',
            'product_ids.*' => 'integer|exists:lunar_products,id',
            'post_ids' => 'nullable|array',
            'post_ids.*' => 'integer|exists:posts,id',
        ]);

        $breed = DB::transaction(function () use ($validated) {
            $seoData = $validated['seo'] ?? null;
            unset($validated['seo']);

            $breed = Breed::create([
                'name' => $validated['name'],
                'slug' => $validated['slug'],
                'body_type' => $validated['body_type'] ?? null,
                'description' => $validated['description'] ?? null,
                'featured_image' => $validated['featured_image'] ?? null,
                'featured_image_alt' => $validated['featured_image_alt'] ?? null,
                'featured_media_id' => $validated['featured_media_id'] ?? null,
            ]);

            if ($seoData !== null) {
                $breed->seo()->create($seoData);
            }

            if (isset($validated['product_ids'])) {
                $breed->products()->sync($validated['product_ids']);
            }
            if (isset($validated['post_ids'])) {
                $breed->posts()->sync($validated['post_ids']);
            }

            return $breed;
        });

        $breed->loadCount(['posts', 'products'])->load('featuredMedia');
        return new BreedResource($breed);
    }

    public function show(Breed $breed)
    {
        $breed->loadCount(['posts', 'products'])->load(['featuredMedia', 'seo', 'products', 'posts']);
        return new BreedResource($breed);
    }

    public function update(Request $request, Breed $breed)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'slug' => 'required|string|max:255|unique:breeds,slug,' . $breed->id,
            'body_type' => 'nullable|string|max:255',
            'description' => 'nullable|string',
            'featured_image' => 'nullable|string',
            'featured_image_alt' => 'nullable|string|max:255',
            'featured_media_id' => 'nullable|integer|exists:curator_media,id',
            'seo' => 'nullable|array',
            'seo.title' => 'nullable|string|max:60',
            'seo.keyphrase' => 'nullable|string|max:255',
            'seo.description' => 'nullable|string|max:160',
            'seo.og_title' => 'nullable|string|max:255',
            'seo.og_description' => 'nullable|string|max:500',
            'seo.og_image' => 'nullable|string|max:2048',
            'product_ids' => 'nullable|array',
            'product_ids.*' => 'integer|exists:lunar_products,id',
            'post_ids' => 'nullable|array',
            'post_ids.*' => 'integer|exists:posts,id',
        ]);

        DB::transaction(function () use ($request, $breed, $validated) {
            $seoData = $validated['seo'] ?? null;
            unset($validated['seo']);

            $breed->update([
                'name' => $validated['name'],
                'slug' => $validated['slug'],
                'body_type' => $validated['body_type'] ?? null,
                'description' => $validated['description'] ?? null,
                'featured_image' => $validated['featured_image'] ?? null,
                'featured_image_alt' => $validated['featured_image_alt'] ?? null,
                'featured_media_id' => $validated['featured_media_id'] ?? null,
            ]);

            if ($seoData !== null) {
                $breed->seo()->updateOrCreate([], $seoData);
            }

            if (isset($validated['product_ids'])) {
                $breed->products()->sync($validated['product_ids']);
            }
            if (isset($validated['post_ids'])) {
                $breed->posts()->sync($validated['post_ids']);
            }
        });

        $breed->refresh()->loadCount(['posts', 'products'])->load(['featuredMedia', 'seo']);
        return new BreedResource($breed);
    }

    public function destroy(Breed $breed)
    {
        $breed->delete();
        return response()->json(null, Response::HTTP_NO_CONTENT);
    }

    public function bulkDestroy(Request $request)
    {
        $validated = $request->validate([
            'ids' => 'required|array',
            'ids.*' => 'integer|exists:breeds,id',
        ]);

        Breed::whereIn('id', $validated['ids'])->delete();
        return response()->json(null, Response::HTTP_NO_CONTENT);
    }
}
