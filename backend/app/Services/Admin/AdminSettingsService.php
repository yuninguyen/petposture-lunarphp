<?php

namespace App\Services\Admin;

use App\Models\CuratorMedia;
use App\Models\Setting;

class AdminSettingsService
{
    private const GENERAL_FIELDS = [
        'shop_name' => ['group' => 'general', 'media' => false],
        'shop_logo' => ['group' => 'general', 'media' => true],
        'shop_favicon' => ['group' => 'general', 'media' => true],
        'shop_description' => ['group' => 'general', 'media' => false],
    ];

    private const BRANDING_FIELDS = [
        'admin_logo' => ['group' => 'admin', 'media' => true],
        'admin_favicon' => ['group' => 'admin', 'media' => true],
    ];

    private const ANALYTICS_FIELDS = [
        'google_analytics_id' => ['group' => 'general', 'media' => false],
    ];

    public function general(): array
    {
        return $this->read(self::GENERAL_FIELDS);
    }

    public function updateGeneral(array $payload): array
    {
        $this->update($payload, self::GENERAL_FIELDS);

        return $this->general();
    }

    public function branding(): array
    {
        return $this->read(self::BRANDING_FIELDS);
    }

    public function updateBranding(array $payload): array
    {
        $this->update($payload, self::BRANDING_FIELDS);

        return $this->branding();
    }

    public function analytics(): array
    {
        return $this->read(self::ANALYTICS_FIELDS);
    }

    public function updateAnalytics(array $payload): array
    {
        $this->update($payload, self::ANALYTICS_FIELDS);

        return $this->analytics();
    }

    private function read(array $fields): array
    {
        $values = [];

        foreach ($fields as $key => $definition) {
            $value = Setting::get($key);
            $values[$key] = $definition['media'] ? $this->mediaValue($value) : $value;
        }

        return $values;
    }

    private function update(array $payload, array $fields): void
    {
        foreach ($fields as $key => $definition) {
            if (! array_key_exists($key, $payload)) {
                continue;
            }

            $value = $payload[$key];
            if ($value === null) {
                Setting::where('key', $key)->first()?->delete();

                continue;
            }

            if ($definition['media']) {
                $media = CuratorMedia::findOrFail($value['media_id']);
                $value = $media->path;
            }

            Setting::set($key, $value, 'string', $definition['group']);
        }
    }

    private function mediaValue(mixed $stored): ?array
    {
        if (! is_string($stored) || $stored === '') {
            return null;
        }

        $media = CuratorMedia::where('path', $stored)->first();

        return [
            'id' => $media ? (string) $media->getKey() : null,
            'url' => $this->resolveAssetUrl($stored),
        ];
    }

    private function resolveAssetUrl(string $path): string
    {
        if (filter_var($path, FILTER_VALIDATE_URL)) {
            return $path;
        }

        return asset('storage/'.ltrim($path, '/'));
    }
}
