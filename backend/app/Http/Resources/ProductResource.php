<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ProductResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'category' => $this->category ? $this->category->name : 'Uncategorized',
            'price' => (float) $this->price,
            'oldPrice' => $this->old_price ? (float) $this->old_price : null,
            'rating' => (float) $this->rating,
            'reviews' => $this->reviews_count,
            'image' => $this->image_url,
            'badge' => $this->badge,
            'isNew' => (bool) $this->is_new,
            'description' => $this->description,
        ];
    }
}
