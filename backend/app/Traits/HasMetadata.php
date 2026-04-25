<?php

namespace App\Traits;

use App\Models\Metadata;
use Illuminate\Database\Eloquent\Relations\MorphMany;

trait HasMetadata
{
    /**
     * Get all of the model's metadata.
     */
    public function metadata(): MorphMany
    {
        return $this->morphMany(Metadata::class, 'model');
    }

    /**
     * Set a metadata key/value pair.
     */
    public function setMeta(string $key, $value, string $type = 'string'): Metadata
    {
        $processedValue = is_array($value) ? json_encode($value) : $value;

        return $this->metadata()->updateOrCreate(
            ['key' => $key],
            [
                'value' => $processedValue,
                'type' => $type,
            ]
        );
    }

    /**
     * Get a metadata value by key.
     */
    public function getMeta(string $key, $default = null)
    {
        $meta = $this->metadata()->where('key', $key)->first();
        return $meta ? $meta->cast_value : $default;
    }

    /**
     * Delete a metadata key.
     */
    public function deleteMeta(string $key): void
    {
        $this->metadata()->where('key', $key)->delete();
    }

    /**
     * Helper to get multiple metadata as a key-value collection.
     */
    public function getAllMeta()
    {
        return $this->metadata->pluck('cast_value', 'key');
    }
}
