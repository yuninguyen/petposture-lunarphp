<?php

namespace App\Http\Resources\Api;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PostResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $blogCategory = $this->blogCategory;
        $featuredImage = $this->resolveAssetUrl($this->featured_image);

        return [
            'id' => (string) $this->id,
            'title' => $this->title,
            'slug' => $this->slug,
            'content' => $this->content,
            'featured_image' => $featuredImage,
            'author' => $this->author,
            'read_time' => $this->read_time,
            'status' => $this->status,
            'created_at' => optional($this->created_at)?->toISOString(),
            'published_at' => optional($this->published_at)?->toISOString(),
            'category' => [
                'name' => $blogCategory?->name,
                'slug' => $blogCategory?->slug ?? (string) $blogCategory?->id,
            ],
            'blog_category' => $blogCategory ? [
                'id' => (string) $blogCategory->id,
                'name' => $blogCategory->name,
                'slug' => $blogCategory->slug,
            ] : null,
        ];
    }

    protected function resolveAssetUrl(?string $path): ?string
    {
        if (!$path) {
            return null;
        }

        if (filter_var($path, FILTER_VALIDATE_URL)) {
            return $path;
        }

        return asset('storage/' . ltrim($path, '/'));
    }
}
