<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Setting extends Model
{
    protected $table = 'settings';

    protected $fillable = [
        'key',
        'value',
        'type',
        'group',
    ];

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

    /**
     * Helper to get a setting by key.
     */
    public static function get(string $key, $default = null)
    {
        $setting = self::where('key', $key)->first();
        return $setting ? $setting->cast_value : $default;
    }

    /**
     * Helper to set a setting key/value.
     */
    public static function set(string $key, $value, string $type = 'string', string $group = 'general')
    {
        $processedValue = is_array($value) ? json_encode($value) : $value;

        return self::updateOrCreate(
            ['key' => $key],
            [
                'value' => $processedValue,
                'type' => $type,
                'group' => $group,
            ]
        );
    }
}
