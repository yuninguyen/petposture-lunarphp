<?php

use App\Http\Controllers\AffiliateClickController;
use App\Http\Controllers\Api\NewsletterController;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return redirect('/admin/login');
});

Route::get('/sitemap.xml', function () {
    $frontendUrl = rtrim((string) config('app.frontend_url'), '/');

    return redirect()->away($frontendUrl.'/sitemap.xml', 301);
});

Route::get('/newsletter/confirm/{subscriber}/{token}', [NewsletterController::class, 'confirm'])
    ->middleware('signed')
    ->name('newsletter.confirm');
Route::get('/newsletter/unsubscribe/{subscriber}/{token}', [NewsletterController::class, 'unsubscribe'])
    ->middleware('signed')
    ->name('newsletter.unsubscribe');

Route::get('/go/{post}/{item}', [AffiliateClickController::class, 'redirect'])->name('affiliate.go');
