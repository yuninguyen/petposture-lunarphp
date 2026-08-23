<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\Admin\BlogTagResource;
use App\Models\BlogTag;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class BlogTagController extends Controller
{
    public function index(Request $request)
    {
        $perPage = $request->query('per_page', 10);
        $search = $request->query('search');

        $query = BlogTag::withCount('posts')->orderBy('name');

        if ($search) {
            $query->where('name', 'like', "%{$search}%");
        }

        return BlogTagResource::collection($query->paginate($perPage));
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'slug' => 'nullable|string|max:255|unique:blog_tags,slug',
        ]);

        $tag = BlogTag::create([
            'name' => $validated['name'],
            'slug' => $validated['slug'] ?? Str::slug($validated['name']).'-'.rand(1000, 9999),
        ]);

        return response()->json(new BlogTagResource($tag), 201);
    }

    public function show(BlogTag $blogTag)
    {
        return new BlogTagResource($blogTag->loadCount('posts'));
    }

    public function update(Request $request, BlogTag $blogTag): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'slug' => 'nullable|string|max:255|unique:blog_tags,slug,'.$blogTag->id,
        ]);

        if (empty($validated['slug'])) {
            $validated['slug'] = Str::slug($validated['name']).'-'.rand(1000, 9999);
        }

        $blogTag->update($validated);

        return response()->json(new BlogTagResource($blogTag));
    }

    public function destroy(BlogTag $blogTag): JsonResponse
    {
        $blogTag->delete();
        return response()->json(null, 204);
    }

    public function bulkDestroy(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'ids' => 'required|array',
            'ids.*' => 'integer|exists:blog_tags,id',
        ]);

        BlogTag::whereIn('id', $validated['ids'])->delete();

        return response()->json(null, 204);
    }
}
