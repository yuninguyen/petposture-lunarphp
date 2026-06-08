<?php

use App\Http\Controllers\Api\SeoController;
use App\Http\Controllers\Api\SitemapController;
use Illuminate\Support\Facades\Route;
use Lunar\Models\Attribute;

Route::get('/', function () {
    return view('welcome');
});

Route::get('/_setup/fix-attribute-config', function () {
    $fixed = [];

    foreach (Attribute::all() as $attribute) {
        if (! ($attribute->getRawOriginal('configuration'))
            || $attribute->getRawOriginal('configuration') === 'null'
            || $attribute->configuration === null) {
            $attribute->configuration = collect();
            $attribute->save();
            $fixed[] = $attribute->handle;
        }
    }

    return response()->json(['status' => 'fixed', 'updated' => $fixed]);
});

Route::get('/sitemap.xml', [SitemapController::class, 'index']);
Route::get('/api/seo', [SeoController::class, 'show']); // ?path=shop/product-slug
