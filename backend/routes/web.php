<?php

use App\Http\Controllers\Api\SeoController;
use App\Http\Controllers\Api\SitemapController;
use Illuminate\Support\Facades\Route;
use Lunar\Models\Attribute;

Route::get('/', function () {
    return view('welcome');
});

Route::get('/_setup/fix-attribute-config', function () {
    $count = Attribute::whereNull('configuration')->update(['configuration' => '{}']);

    return response()->json(['status' => 'fixed', 'updated' => $count]);
});

Route::get('/sitemap.xml', [SitemapController::class, 'index']);
Route::get('/api/seo', [SeoController::class, 'show']); // ?path=shop/product-slug
