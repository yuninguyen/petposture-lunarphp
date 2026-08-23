<?php

namespace App\Http\Resources\Admin;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SolutionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'slug' => $this->slug,
            'description' => $this->description,
            'featured_image' => $this->featured_image,
            'featured_image_alt' => $this->featured_image_alt,
            'featured_media_id' => $this->featured_media_id,
            'featured_media' => $this->whenLoaded('featuredMedia'),
            'products_count' => $this->whenCounted('products'),
            'posts_count' => $this->whenCounted('posts'),
            'products' => $this->whenLoaded('products'),
            'posts' => $this->whenLoaded('posts'),
            'seo' => $this->whenLoaded('seo'),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
