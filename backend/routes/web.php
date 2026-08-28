<?php

use App\Http\Controllers\AffiliateClickController;
use App\Http\Controllers\Api\NewsletterController;
use App\Http\Controllers\Api\SeoController;
use App\Http\Controllers\Api\SitemapController;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return redirect('/admin/login');
});

Route::get('/sitemap.xml', [SitemapController::class, 'index']);
Route::get('/api/seo', [SeoController::class, 'show']); // ?path=shop/product-slug

Route::get('/newsletter/confirm/{subscriber}/{token}', [NewsletterController::class, 'confirm'])
    ->middleware('signed')
    ->name('newsletter.confirm');
Route::get('/newsletter/unsubscribe/{subscriber}/{token}', [NewsletterController::class, 'unsubscribe'])
    ->middleware('signed')
    ->name('newsletter.unsubscribe');

Route::get('/go/{post}/{item}', [AffiliateClickController::class, 'redirect'])->name('affiliate.go');
