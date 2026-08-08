<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\Api\PostResource;
use App\Models\BlogCategory;
use App\Models\Page;
use App\Models\Post;
use App\Traits\HttpResponses;

class ContentController extends Controller
{
    use HttpResponses;

    public function posts()
    {
        $posts = Post::where('status', 'published')
            ->where('published_at', '<=', now())
            ->with(['blogCategory', 'metadata'])
            ->latest()
            ->paginate(12);

        return PostResource::collection($posts);
    }

    public function post($slug)
    {
        $post = Post::where('slug', $slug)
            ->where('status', 'published')
            ->with(['blogCategory', 'metadata'])
            ->firstOrFail();

        return new PostResource($post);
    }

    public function page($slug)
    {
        $page = Page::where('slug', $slug)
            ->where('is_active', true)
            ->firstOrFail();

        return response()->json([
            'data' => [
                'slug' => $page->slug,
                'title' => $page->title,
                'content' => $page->content,
                'meta_title' => $page->meta_title,
                'meta_description' => $page->meta_description,
                'updated_at' => $page->updated_at,
            ],
        ]);
    }

    public function categories()
    {
        return response()->json([
            'data' => BlogCategory::all()->map(fn ($c) => [
                'id' => $c->id,
                'name' => $c->name,
                'slug' => $c->slug,
            ])->values(),
        ]);
    }
}
