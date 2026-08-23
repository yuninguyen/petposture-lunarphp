<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Solution;
use App\Http\Resources\Admin\SolutionResource;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;

class SolutionController extends Controller
{
    public function index(Request $request)
    {
        $query = Solution::withCount(['posts', 'products'])->with(['featuredMedia']);

        if ($request->has('search')) {
            $search = $request->input('search');
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('slug', 'like', "%{$search}%");
            });
        }

        $perPage = $request->input('per_page', 10);
        $solutions = $query->latest()->paginate($perPage);

        return SolutionResource::collection($solutions);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'slug' => 'required|string|max:255|unique:solutions,slug',
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

        $solution = DB::transaction(function () use ($validated) {
            $seoData = $validated['seo'] ?? null;
            unset($validated['seo']);

            $solution = Solution::create([
                'name' => $validated['name'],
                'slug' => $validated['slug'],
                'description' => $validated['description'] ?? null,
                'featured_image' => $validated['featured_image'] ?? null,
                'featured_image_alt' => $validated['featured_image_alt'] ?? null,
                'featured_media_id' => $validated['featured_media_id'] ?? null,
            ]);

            if ($seoData !== null) {
                $solution->seo()->create($seoData);
            }

            if (isset($validated['product_ids'])) {
                $solution->products()->sync($validated['product_ids']);
            }
            if (isset($validated['post_ids'])) {
                $solution->posts()->sync($validated['post_ids']);
            }

            return $solution;
        });

        $solution->loadCount(['posts', 'products'])->load('featuredMedia');
        return new SolutionResource($solution);
    }

    public function show(Solution $solution)
    {
        $solution->loadCount(['posts', 'products'])->load(['featuredMedia', 'seo', 'products', 'posts']);
        return new SolutionResource($solution);
    }

    public function update(Request $request, Solution $solution)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'slug' => 'required|string|max:255|unique:solutions,slug,' . $solution->id,
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

        DB::transaction(function () use ($request, $solution, $validated) {
            $seoData = $validated['seo'] ?? null;
            unset($validated['seo']);

            $solution->update([
                'name' => $validated['name'],
                'slug' => $validated['slug'],
                'description' => $validated['description'] ?? null,
                'featured_image' => $validated['featured_image'] ?? null,
                'featured_image_alt' => $validated['featured_image_alt'] ?? null,
                'featured_media_id' => $validated['featured_media_id'] ?? null,
            ]);

            if ($seoData !== null) {
                $solution->seo()->updateOrCreate([], $seoData);
            }

            if (isset($validated['product_ids'])) {
                $solution->products()->sync($validated['product_ids']);
            }
            if (isset($validated['post_ids'])) {
                $solution->posts()->sync($validated['post_ids']);
            }
        });

        $solution->refresh()->loadCount(['posts', 'products'])->load(['featuredMedia', 'seo']);
        return new SolutionResource($solution);
    }

    public function destroy(Solution $solution)
    {
        $solution->delete();
        return response()->json(null, Response::HTTP_NO_CONTENT);
    }

    public function bulkDestroy(Request $request)
    {
        $validated = $request->validate([
            'ids' => 'required|array',
            'ids.*' => 'integer|exists:solutions,id',
        ]);

        Solution::whereIn('id', $validated['ids'])->delete();
        return response()->json(null, Response::HTTP_NO_CONTENT);
    }
}
