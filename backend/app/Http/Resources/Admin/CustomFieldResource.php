<?php

namespace App\Http\Resources\Admin;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CustomFieldResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $name = $this->name?->all() ?? [];
        $productTypes = $this->getRelation('productTypes');

        return [
            'id' => $this->id,
            'name' => $name,
            'display_name' => $this->resource->translate('name'),
            'handle' => $this->handle,
            'target' => $this->attribute_type === 'product_variant' ? 'variant' : 'product',
            'field_type' => 'text',
            'required' => (bool) $this->required,
            'product_type_ids' => $productTypes->pluck('id')->values()->all(),
            'product_types' => $productTypes->map(fn ($productType) => [
                'id' => $productType->id,
                'name' => $productType->name,
            ])->values()->all(),
            'position' => $this->position,
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
