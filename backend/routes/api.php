<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CartController;
use App\Http\Controllers\Api\CheckoutController;
use App\Http\Controllers\Api\CommentController;
use App\Http\Controllers\Api\ContentController;
use App\Http\Controllers\Api\BrandController;
use App\Http\Controllers\Api\ContactController;
use App\Http\Controllers\Api\NewsletterController;
use App\Http\Controllers\Api\PasswordResetController;
use App\Http\Controllers\Api\OrderController;
use App\Http\Controllers\Api\PostController;
use App\Http\Controllers\Api\ProductController;
use App\Http\Controllers\Api\SettingsController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

// Health check — used by uptime monitors and CI readiness probes
Route::get('/health', function () {
    $checks = [];
    $allOk  = true;

    // Database
    try {
        \Illuminate\Support\Facades\DB::connection()->getPdo();
        $checks['database'] = 'ok';
    } catch (\Exception $e) {
        $checks['database'] = 'error: ' . $e->getMessage();
        $allOk = false;
    }

    // Cache
    try {
        \Illuminate\Support\Facades\Cache::put('_health_check', 1, 5);
        $checks['cache'] = \Illuminate\Support\Facades\Cache::get('_health_check') === 1 ? 'ok' : 'error';
    } catch (\Exception $e) {
        $checks['cache'] = 'error';
        $allOk = false;
    }

    // Mail configured
    $mailMailer = config('mail.default');
    $checks['mail'] = $mailMailer !== 'log' ? 'configured (' . $mailMailer . ')' : 'log only — not configured';

    // Stripe configured
    $stripeKey = \App\Models\Setting::get('stripe_secret') ?: config('services.stripe.secret');
    $checks['stripe'] = $stripeKey ? (str_starts_with($stripeKey, 'sk_live_') ? 'live' : 'test') : 'not configured';

    // Lunar default channel/currency
    try {
        $currency = \Lunar\Models\Currency::getDefault();
        $checks['lunar_currency'] = $currency ? $currency->code : 'not set';
    } catch (\Exception $e) {
        $checks['lunar_currency'] = 'error';
        $allOk = false;
    }

    // Products published
    try {
        $checks['products'] = \Lunar\Models\Product::where('status', 'published')->count() . ' published';
    } catch (\Exception $e) {
        $checks['products'] = 'error';
    }

    return response()->json([
        'status'   => $allOk ? 'ok' : 'degraded',
        'env'      => app()->environment(),
        'ts'       => now()->toIso8601String(),
        'checks'   => $checks,
    ], $allOk ? 200 : 503);
});

// Public Routes
Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:auth');
Route::post('/register', [AuthController::class, 'register'])->middleware('throttle:auth');

Route::get('/products', [ProductController::class, 'index']);
Route::get('/products/{slug}', [ProductController::class, 'show']);
Route::get('/products/{slug}/reviews', [ProductController::class, 'reviews']);
Route::get('/products/{slug}/related', [ProductController::class, 'related']);
Route::get('/brands', [BrandController::class, 'index']);
Route::get('/brands/{id}/products', [BrandController::class, 'products']);
Route::post('/products/{slug}/reviews', [ProductController::class, 'storeReview'])->middleware('throttle:api-write');
Route::post('/orders/track', [OrderController::class, 'track']);
Route::post('/orders/retry-payment', [OrderController::class, 'retryPayment']);
Route::get('/api-test', function () {
    return ['status' => 'ok', 'v' => 3];
});
Route::post('/apply-coupon', [CheckoutController::class, 'applyCoupon'])->middleware('throttle:api-write');
Route::post('/newsletter/subscribe', [NewsletterController::class, 'subscribe']);
Route::post('/contact', [ContactController::class, 'submit'])->middleware('throttle:api-write');
Route::post('/auth/forgot-password', [PasswordResetController::class, 'sendResetLink'])->middleware('throttle:auth');
Route::post('/auth/reset-password', [PasswordResetController::class, 'resetPassword'])->middleware('throttle:auth');
Route::get('/checkout/payment-methods', [CheckoutController::class, 'paymentMethods']);
Route::post('/checkout/payment-intent', [CheckoutController::class, 'preparePaymentIntent'])->middleware('throttle:api-write');
Route::post('/checkout/tax-quote', [CheckoutController::class, 'taxQuote'])->middleware('throttle:api-write');
Route::post('/webhooks/stripe', [CheckoutController::class, 'stripeWebhook']);

Route::get('/posts', [ContentController::class, 'posts']);
Route::get('/posts/{slug}', [ContentController::class, 'post']);
Route::get('/posts/{slug}/comments', [CommentController::class, 'index']);
Route::post('/posts/{slug}/comments', [CommentController::class, 'store']);
Route::get('/categories', [ContentController::class, 'categories']);
Route::get('/blog/categories', [ContentController::class, 'categories']);

Route::get('/settings', [SettingsController::class, 'index']);

// Cart — works for both guest (X-Cart-Token header) and auth users
Route::get('/cart', [CartController::class, 'show']);
Route::post('/cart/lines', [CartController::class, 'addLine'])->middleware('throttle:api-write');
Route::put('/cart/lines/{lineId}', [CartController::class, 'updateLine'])->middleware('throttle:api-write');
Route::delete('/cart/lines/{lineId}', [CartController::class, 'removeLine']);
Route::delete('/cart', [CartController::class, 'clear']);

Route::prefix('/admin')
    ->middleware(['auth:sanctum', 'role:super_admin|admin|staff'])
    ->group(function () {
        Route::get('/posts', [PostController::class, 'index']);
        Route::post('/posts', [PostController::class, 'store']);
        Route::get('/posts/{post}', [PostController::class, 'show']);
        Route::put('/posts/{post}', [PostController::class, 'update']);
        Route::patch('/posts/{post}', [PostController::class, 'update']);
        Route::delete('/posts/{post}', [PostController::class, 'destroy']);
        Route::get('/blog/categories', [PostController::class, 'categories']);
    });

// Protected Routes
Route::group(['middleware' => ['auth:sanctum']], function () {
    Route::get('/me', [AuthController::class, 'me']);
    Route::post('/logout', [AuthController::class, 'logout']);

    // Checkout & Orders
    Route::get('/orders', [OrderController::class, 'index']);
    Route::get('/orders/{id}', [OrderController::class, 'show']);
    Route::patch('/orders/{id}', [OrderController::class, 'update']);
    Route::post('/orders/{id}/actions/{action}', [OrderController::class, 'performAction']);
    Route::post('/orders/{id}/shipments', [OrderController::class, 'createShipment']);
});
Route::post('/checkout/place-order', [CheckoutController::class, 'placeOrder'])->middleware('throttle:api-write');

