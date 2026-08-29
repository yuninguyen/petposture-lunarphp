<?php

namespace App\Http\Resources\Admin;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Str;
use Lunar\Base\FieldType;

class CollectionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $children = $this->relationLoaded('children') ? $this->children : collect();

        return [
            'id' => $this->id,
            'collection_group_id' => $this->collection_group_id,
            'parent_id' => $this->parent_id,
            'name' => [
                'en' => $this->translatedName('en'),
                'vi' => $this->translatedName('vi'),
            ],
            'slug' => $this->defaultUrl?->slug
                ?? Str::slug($this->translatedName('en') ?: $this->translatedName('vi')),
            'children_count' => $children->count(),
            'children' => static::collection($children),
        ];
    }

    private function translatedName(string $locale): string
    {
        $name = $this->attribute_data?->get('name');

        if (! $name instanceof FieldType) {
            return '';
        }

        $value = $name->getValue();

        if (! is_array($value) && ! $value instanceof \Illuminate\Support\Collection) {
            return $locale === 'en' ? (string) $value : '';
        }

        $translated = $value instanceof \Illuminate\Support\Collection
            ? $value->get($locale)
            : ($value[$locale] ?? null);

        return $translated instanceof FieldType
            ? (string) $translated->getValue()
            : (string) ($translated ?? '');
    }
}
