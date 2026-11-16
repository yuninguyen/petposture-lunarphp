<?php

namespace App\Services\Pinterest;

use App\Models\Setting;

/**
 * The owner's switches for automatic posting, kept in the settings table. Automatic posting is off until the owner
 * turns it on, and every limit has a cautious default.
 */
class PinterestPublishSettings
{
    private const GROUP = 'pinterest';

    private const DEFAULTS = [
        'auto_publish' => false,
        'max_per_day' => 3,
        'min_gap_minutes' => 180,
        'window_start' => '08:00',
        'window_end' => '21:00',
        'timezone' => 'America/New_York',
    ];

    private const TYPES = [
        'auto_publish' => 'boolean',
        'max_per_day' => 'integer',
        'min_gap_minutes' => 'integer',
        'window_start' => 'string',
        'window_end' => 'string',
        'timezone' => 'string',
    ];

    public static function keys(): array
    {
        return array_keys(self::DEFAULTS);
    }

    public function all(): array
    {
        $values = [];

        foreach (self::DEFAULTS as $key => $default) {
            $values[$key] = Setting::get("pinterest.{$key}", $default);
        }

        return $values;
    }

    public function get(string $key): mixed
    {
        return Setting::get("pinterest.{$key}", self::DEFAULTS[$key]);
    }

    /** Saves only the keys it knows; returns the settings as they are now. */
    public function update(array $values): array
    {
        foreach (array_intersect_key($values, self::DEFAULTS) as $key => $value) {
            Setting::set("pinterest.{$key}", is_bool($value) ? ($value ? '1' : '0') : $value, self::TYPES[$key], self::GROUP);
        }

        return $this->all();
    }
}
