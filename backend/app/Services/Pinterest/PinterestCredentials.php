<?php

namespace App\Services\Pinterest;

use App\Models\Setting;
use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Support\Facades\Crypt;

/**
 * The Pinterest app's details. What the owner saved in the admin wins; anything left blank falls back to the
 * `.env` values in config/services.php, so a server configured the old way keeps working. The app secret is stored
 * encrypted, can be replaced but never read back, and is never part of any response.
 */
class PinterestCredentials
{
    private const GROUP = 'pinterest';

    private const SANDBOX_BASE = 'https://api-sandbox.pinterest.com/v5';

    private const PRODUCTION_BASE = 'https://api.pinterest.com/v5';

    public function appId(): ?string
    {
        return $this->stored('app_id') ?? $this->fromConfig('app_id');
    }

    public function appSecret(): ?string
    {
        $stored = $this->stored('app_secret');

        if ($stored !== null) {
            try {
                return Crypt::decryptString($stored);
            } catch (DecryptException) {
                // An unreadable value (the app key changed) counts as not set: the owner enters it again.
                return $this->fromConfig('app_secret');
            }
        }

        return $this->fromConfig('app_secret');
    }

    public function redirectUri(): ?string
    {
        return $this->stored('redirect_uri') ?? $this->fromConfig('redirect_uri');
    }

    /** True while the app only has Trial access: calls go to Pinterest's sandbox, where pins are not public. */
    public function sandbox(): bool
    {
        $stored = Setting::get('pinterest.sandbox');

        if ($stored !== null) {
            return (bool) $stored;
        }

        return str_contains((string) config('services.pinterest.api_base'), 'sandbox');
    }

    public function apiBase(): string
    {
        if ($this->sandbox()) {
            return self::SANDBOX_BASE;
        }

        $base = (string) config('services.pinterest.api_base');

        return $base !== '' && ! str_contains($base, 'sandbox') ? $base : self::PRODUCTION_BASE;
    }

    public function isComplete(): bool
    {
        return filled($this->appId()) && filled($this->appSecret()) && filled($this->redirectUri());
    }

    public function hasSecret(): bool
    {
        return filled($this->appSecret());
    }

    /**
     * Saves what was sent. A blank or missing secret leaves the saved one as it is (the form never shows it, so an
     * untouched field must not wipe it).
     *
     * @param  array{app_id?: string|null, app_secret?: string|null, redirect_uri?: string|null, sandbox?: bool}  $values
     */
    public function update(array $values): void
    {
        foreach (['app_id', 'redirect_uri'] as $key) {
            if (array_key_exists($key, $values)) {
                Setting::set("pinterest.{$key}", trim((string) $values[$key]), 'string', self::GROUP);
            }
        }

        if (filled($values['app_secret'] ?? null)) {
            Setting::set('pinterest.app_secret', Crypt::encryptString((string) $values['app_secret']), 'string', self::GROUP);
        }

        if (array_key_exists('sandbox', $values)) {
            Setting::set('pinterest.sandbox', $values['sandbox'] ? '1' : '0', 'boolean', self::GROUP);
        }
    }

    private function stored(string $key): ?string
    {
        $value = Setting::get("pinterest.{$key}");

        return filled($value) ? (string) $value : null;
    }

    private function fromConfig(string $key): ?string
    {
        $value = config("services.pinterest.{$key}");

        return filled($value) ? (string) $value : null;
    }
}
