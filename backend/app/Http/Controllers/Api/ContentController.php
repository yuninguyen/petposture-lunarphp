<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\Api\PostResource;
use App\Models\BlogCategory;
use App\Models\Post;
use App\Traits\HttpResponses;

class ContentController extends Controller
{
    use HttpResponses;

    public function posts()
    {
        $posts = Post::where('is_published', true)
            ->where('published_at', '<=', now())
            ->with('blogCategory')
            ->latest()
            ->paginate(12);

        return PostResource::collection($posts);
    }

    public function post($slug)
    {
        $post = Post::where('slug', $slug)
            ->where('is_published', true)
            ->with('blogCategory')
            ->firstOrFail();

        return new PostResource($post);
    }

    public function categories()
    {
        $categories = BlogCategory::all();

        return $this->success($categories);
    }
}
