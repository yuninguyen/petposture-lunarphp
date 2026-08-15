<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Cache;

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
     *
     * Cached indefinitely — SettingCacheObserver forgets the per-key cache entry
     * whenever a Setting is saved/deleted, so this stays correct without a TTL.
     * The "exists" flag is cached separately from $default so two call sites
     * passing different defaults for the same missing key don't cross-contaminate.
     */
    public static function get(string $key, $default = null)
    {
        $cached = Cache::rememberForever("setting:{$key}", function () use ($key) {
            $setting = self::where('key', $key)->first();

            return $setting ? ['exists' => true, 'value' => $setting->cast_value] : ['exists' => false, 'value' => null];
        });

        return $cached['exists'] ? $cached['value'] : $default;
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
