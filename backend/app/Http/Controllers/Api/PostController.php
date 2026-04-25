<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\Api\PostResource;
use App\Models\Post;
use App\Models\BlogCategory;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class PostController extends Controller
{
    public function index(Request $request)
    {
        $query = Post::with('blogCategory')->latest();

        if ($request->has('category')) {
            $query->whereHas('blogCategory', function ($q) use ($request) {
                $q->where('slug', $request->category);
            });
        }

        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        return PostResource::collection($query->get());
    }

    public function categories()
    {
        return response()->json(BlogCategory::all());
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'content' => 'required|string',
            'blog_category_id' => 'required|exists:blog_categories,id',
            'featured_image' => 'nullable|string',
            'author' => 'nullable|string',
            'read_time' => 'nullable|string',
            'status' => 'required|in:draft,published',
        ]);

        $validated['slug'] = Str::slug($validated['title']) . '-' . rand(1000, 9999);

        if ($validated['status'] === 'published') {
            $validated['published_at'] = now();
        }

        $post = Post::create($validated);

        return (new PostResource($post->load('blogCategory')))
            ->response()
            ->setStatusCode(201);
    }

    public function show(Post $post)
    {
        return new PostResource($post->load('blogCategory'));
    }

    public function update(Request $request, Post $post)
    {
        $validated = $request->validate([
            'title' => 'sometimes|required|string|max:255',
            'content' => 'sometimes|required|string',
            'blog_category_id' => 'sometimes|required|exists:blog_categories,id',
            'featured_image' => 'nullable|string',
            'author' => 'nullable|string',
            'read_time' => 'nullable|string',
            'status' => 'sometimes|required|in:draft,published',
        ]);

        if (isset($validated['status']) && $validated['status'] === 'published' && !$post->published_at) {
            $validated['published_at'] = now();
        }

        $post->update($validated);

        return new PostResource($post->load('blogCategory'));
    }

    public function destroy(Post $post)
    {
        $post->delete();
        return response()->json(null, 204);
    }
}
