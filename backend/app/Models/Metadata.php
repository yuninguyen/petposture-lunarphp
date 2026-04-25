<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class Metadata extends Model
{
    protected $table = 'metadata';

    protected $fillable = [
        'model_type',
        'model_id',
        'key',
        'value',
        'type',
    ];

    /**
     * Get the parent model.
     */
    public function model(): MorphTo
    {
        return $this->morphTo();
    }

    /**
     * Accessor to get the value cast to its type.
     */
    public function getCastValueAttribute()
    {
        return match ($this->type) {
            'json' => json_decode($this->value, true),
            'int', 'integer' => (int) $this->value,
            'float', 'double' => (float) $this->value,
            'bool', 'boolean' => filter_var($this->value, FILTER_VALIDATE_BOOLEAN),
            default => $this->value,
        };
    }
}
