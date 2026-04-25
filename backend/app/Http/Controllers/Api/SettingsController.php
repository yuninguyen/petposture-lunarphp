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

        // Expose structured settings for frontend
        return $this->success([
            'shop_name' => setting('shop_name', 'PetPosture'),
            'shop_logo' => $this->resolveAssetUrl($shopLogo),
            'description' => setting('shop_description'),
            'localization' => [
                'currency' => setting('default_currency', 'USD'),
                'symbol' => setting('currency_symbol', '$'),
            ]
        ]);
    }

    protected function resolveAssetUrl(?string $path): ?string
    {
        if (!$path) {
            return null;
        }

        if (filter_var($path, FILTER_VALIDATE_URL)) {
            return $path;
        }

        return asset('storage/' . ltrim($path, '/'));
    }
}
