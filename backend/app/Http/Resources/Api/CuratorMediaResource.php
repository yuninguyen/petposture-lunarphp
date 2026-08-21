<?php

namespace App\Http\Resources\Api;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CuratorMediaResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => (string) $this->id,
            'url' => $this->url,
            'thumbnail_url' => $this->thumbnail_url,
            'name' => $this->name,
            'alt' => $this->alt,
            'width' => $this->width,
            'height' => $this->height,
        ];
    }
}
