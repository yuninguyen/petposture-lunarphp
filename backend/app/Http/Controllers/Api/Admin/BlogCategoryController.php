<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\BlogCategory;
use App\Http\Resources\Admin\BlogCategoryResource;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Str;

class BlogCategoryController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        $query = BlogCategory::withCount('posts');

        if ($request->has('search')) {
            $search = $request->input('search');
            $query->where('name', 'like', "%{$search}%")
                  ->orWhere('slug', 'like', "%{$search}%");
        }

        $perPage = $request->input('per_page', 10);
        
        $categories = $query->latest()->paginate($perPage);

        return BlogCategoryResource::collection($categories);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'slug' => 'nullable|string|max:255|unique:blog_categories,slug',
        ]);

        $category = BlogCategory::create([
            'name' => $validated['name'],
            'slug' => $validated['slug'] ?? Str::slug($validated['name']).'-'.rand(1000, 9999),
        ]);

        return response()->json(new BlogCategoryResource($category), 201);
    }

    /**
     * Display the specified resource.
     */
    public function show(BlogCategory $blogCategory)
    {
        $blogCategory->loadCount('posts');

        return new BlogCategoryResource($blogCategory);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, BlogCategory $blogCategory)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'slug' => 'nullable|string|max:255|unique:blog_categories,slug,' . $blogCategory->id,
        ]);

        if (empty($validated['slug'])) {
            $validated['slug'] = Str::slug($validated['name']).'-'.rand(1000, 9999);
        }

        $blogCategory->update($validated);

        return response()->json(new BlogCategoryResource($blogCategory));
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(BlogCategory $blogCategory)
    {
        $blogCategory->delete();

        return response()->json(null, Response::HTTP_NO_CONTENT);
    }

    /**
     * Remove the specified resources from storage.
     */
    public function bulkDestroy(Request $request)
    {
        $validated = $request->validate([
            'ids' => 'required|array',
            'ids.*' => 'integer|exists:blog_categories,id',
        ]);

        BlogCategory::whereIn('id', $validated['ids'])->delete();

        return response()->json(null, Response::HTTP_NO_CONTENT);
    }
}
