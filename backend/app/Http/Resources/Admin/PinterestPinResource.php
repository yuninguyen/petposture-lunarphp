<?php

namespace App\Http\Resources\Admin;

use App\Models\PinterestPin;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Storage;

/**
 * @mixin PinterestPin
 */
class PinterestPinResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $media = $this->relationLoaded('media') ? $this->media : $this->media()->first();
        $post = $this->relationLoaded('post') ? $this->post : $this->post()->first();

        return [
            'id' => $this->id,
            'post_id' => $this->post_id,
            'post' => $post ? ['id' => $post->id, 'title' => $post->title, 'slug' => $post->slug] : null,
            // The id of the media library entry, for the image picker; null once that entry has been deleted.
            'media_id' => $media ? (string) $media->id : null,
            'image' => $this->image,
            'image_url' => Storage::disk(config('curator.disk'))->url($this->image),
            // Lets the form warn when an image is not the 2:3 Pinterest likes (1000 x 1500).
            'image_width' => $media?->width,
            'image_height' => $media?->height,
            'title' => $this->title,
            'description' => $this->description,
            'destination_url' => $this->destination_url,
            'board' => $this->board,
            'status' => $this->status,
            'scheduled_date' => $this->scheduled_date?->toDateString(),
            'posted_at' => $this->posted_at?->toISOString(),
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }
}
