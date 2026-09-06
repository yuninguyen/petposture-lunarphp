<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Traits\HttpResponses;

class SettingsController extends Controller
{
    use HttpResponses;

    public function index()
    {
        $shopLogo = setting('shop_logo');
        $shopFavicon = setting('shop_favicon');
        $adminLogo = setting('admin_logo');
        $adminFavicon = setting('admin_favicon');

        // Expose structured settings for frontend
        return $this->success([
            'shop_name' => setting('shop_name', 'PetPosture'),
            'shop_logo' => $this->resolveAssetUrl($shopLogo),
            'shop_favicon' => $this->resolveAssetUrl($shopFavicon),
            'admin_logo' => $this->resolveAssetUrl($adminLogo),
            'admin_favicon' => $this->resolveAssetUrl($adminFavicon),
            'description' => setting('shop_description'),
            // Single source of truth for the storefront URL — the admin uses
            // this for its View/preview links so they always match the
            // environment the backend was configured for.
            'frontend_url' => rtrim((string) config('app.frontend_url', ''), '/'),
            'localization' => [
                'currency' => setting('default_currency', 'USD'),
                'symbol' => setting('currency_symbol', '$'),
            ],
            'social' => [
                'facebook' => setting('social_facebook'),
                'instagram' => setting('social_instagram'),
                'twitter' => setting('social_twitter'),
                'tiktok' => setting('social_tiktok'),
                'pinterest' => setting('social_pinterest'),
                'youtube' => setting('social_youtube'),
            ],
            'contact' => [
                'phone' => setting('business_phone'),
                'address' => setting('business_address'),
            ],
            'analytics' => [
                'google_analytics_id' => setting('google_analytics_id'),
            ],
        ]);
    }

    protected function resolveAssetUrl(?string $path): ?string
    {
        if (! $path) {
            return null;
        }

        if (filter_var($path, FILTER_VALIDATE_URL)) {
            return $path;
        }

        return asset('storage/'.ltrim($path, '/'));
    }
}
