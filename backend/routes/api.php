<?php

use App\Http\Controllers\Api\AfterShipWebhookController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BrandController;
use App\Http\Controllers\Api\BreedController;
use App\Http\Controllers\Api\SolutionController;
use App\Http\Controllers\Api\CartController;
use App\Http\Controllers\Api\CheckoutController;
use App\Http\Controllers\Api\CommentController;
use App\Http\Controllers\Api\ContactController;
use App\Http\Controllers\Api\ContentController;
use App\Http\Controllers\Api\NewsletterController;
use App\Http\Controllers\Api\OrderController;
use App\Http\Controllers\Api\PasswordResetController;
use App\Http\Controllers\Api\PostController;
use App\Http\Controllers\Api\ProductController;
use App\Http\Controllers\Api\ReturnRequestController;
use App\Http\Controllers\Api\SettingsController;
use App\Http\Controllers\Api\SiteMediaController;
use App\Http\Controllers\Api\UserAddressController;
use App\Http\Controllers\Api\WishlistController;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;

// Health check — used by uptime monitors and CI readiness probes
Route::get('/health', function () {
    $allOk = true;

    // Database
    try {
        DB::connection()->getPdo();
    } catch (Exception $e) {
        $allOk = false;
    }

    // Cache
    try {
        Cache::put('_health_check', 1, 5);
        if ((int) Cache::get('_health_check') !== 1) {
            $allOk = false;
        }
    } catch (Exception $e) {
        $allOk = false;
    }

    return response()->json([
        'status' => $allOk ? 'ok' : 'degraded',
        'ts' => now()->toIso8601String(),
    ], $allOk ? 200 : 503);
});

// Public Routes
Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:auth');
Route::post('/register', [AuthController::class, 'register'])->middleware('throttle:auth');

Route::get('/products', [ProductController::class, 'index']);
Route::get('/products/facets', [ProductController::class, 'facets']);
Route::get('/products/{slug}', [ProductController::class, 'show']);
Route::get('/products/{slug}/reviews', [ProductController::class, 'reviews']);
Route::get('/products/{slug}/related', [ProductController::class, 'related']);
Route::get('/brands', [BrandController::class, 'index']);
Route::get('/brands/{id}/products', [BrandController::class, 'products']);
Route::get('/breeds', [BreedController::class, 'index']);
Route::get('/breeds/{slug}', [BreedController::class, 'show']);
Route::get('/solutions', [SolutionController::class, 'index']);
Route::get('/solutions/{slug}', [SolutionController::class, 'show']);
Route::post('/products/{slug}/reviews', [ProductController::class, 'storeReview'])->middleware('throttle:api-write');
Route::post('/orders/track', [OrderController::class, 'track'])->middleware('throttle:10,1');
Route::get('/orders/by-payment-session', [OrderController::class, 'byPaymentSession'])->middleware('throttle:10,1');
Route::post('/orders/retry-payment', [OrderController::class, 'retryPayment'])->middleware('throttle:10,1');
Route::post('/orders/return-requests', [ReturnRequestController::class, 'store'])->middleware('throttle:10,1');
Route::post('/orders/return-requests/preview', [ReturnRequestController::class, 'preview'])->middleware('throttle:api-write');
Route::get('/api-test', function () {
    return ['status' => 'ok', 'v' => 3];
});
Route::post('/apply-coupon', [CheckoutController::class, 'applyCoupon'])->middleware('throttle:api-write');
Route::post('/newsletter/subscribe', [NewsletterController::class, 'subscribe'])->middleware('throttle:api-write');
Route::post('/contact', [ContactController::class, 'submit'])->middleware('throttle:api-write');
Route::post('/auth/forgot-password', [PasswordResetController::class, 'sendResetLink'])->middleware('throttle:auth');
Route::post('/auth/reset-password', [PasswordResetController::class, 'resetPassword'])->middleware('throttle:auth');
Route::get('/checkout/payment-methods', [CheckoutController::class, 'paymentMethods']);
Route::get('/checkout/shipping-rates', [CheckoutController::class, 'shippingRates']);
Route::post('/checkout/session', [CheckoutController::class, 'upsertSession'])->middleware('throttle:api-write');
Route::get('/checkout/session/{token}', [CheckoutController::class, 'showSession'])->middleware('throttle:api-write');
Route::post('/checkout/session/{token}/payment-intent', [CheckoutController::class, 'prepareSessionPaymentIntent'])->middleware('throttle:api-write');
Route::post('/checkout/session/{token}/confirm', [CheckoutController::class, 'confirmSession'])->middleware('throttle:api-write');
Route::post('/checkout/payment-intent', [CheckoutController::class, 'preparePaymentIntent'])->middleware('throttle:api-write');
Route::post('/checkout/paypal-order', [CheckoutController::class, 'preparePayPalOrder'])->middleware('throttle:api-write');
Route::post('/checkout/paypal-capture', [CheckoutController::class, 'capturePayPalOrder'])->middleware('throttle:api-write');
Route::post('/checkout/tax-quote', [CheckoutController::class, 'taxQuote'])->middleware('throttle:api-write');
Route::post('/checkout/airwallex-session', [CheckoutController::class, 'prepareAirwallexSession'])->middleware('throttle:api-write');
Route::post('/checkout/payoneer-session', [CheckoutController::class, 'preparePayoneerSession'])->middleware('throttle:api-write');
Route::post('/checkout/pingpong-session', [CheckoutController::class, 'preparePingPongSession'])->middleware('throttle:api-write');
Route::post('/webhooks/stripe', [CheckoutController::class, 'stripeWebhook']);
Route::post('/webhooks/paypal', [CheckoutController::class, 'paypalWebhook']);
Route::post('/webhooks/airwallex', [CheckoutController::class, 'airwallexWebhook']);
Route::post('/webhooks/payoneer', [CheckoutController::class, 'payoneerWebhook']);
Route::post('/webhooks/pingpong', [CheckoutController::class, 'pingpongWebhook']);
Route::post('/webhooks/aftership', [AfterShipWebhookController::class, 'handle']);

Route::get('/posts', [ContentController::class, 'posts']);
Route::get('/posts/{slug}', [ContentController::class, 'post']);
Route::get('/posts/{slug}/comments', [CommentController::class, 'index']);
Route::post('/posts/{slug}/comments', [CommentController::class, 'store'])->middleware('throttle:api-write');
Route::get('/categories', [ContentController::class, 'categories']);
Route::get('/blog/categories', [ContentController::class, 'categories']);
Route::get('/pages/{slug}', [ContentController::class, 'page']);

Route::get('/settings', [SettingsController::class, 'index']);
Route::get('/site-media', [SiteMediaController::class, 'index']);

// Cart — works for both guest (X-Cart-Token header) and auth users
Route::get('/cart', [CartController::class, 'show']);
Route::post('/cart/lines', [CartController::class, 'addLine'])->middleware('throttle:api-write');
Route::put('/cart/lines/{lineId}', [CartController::class, 'updateLine'])->middleware('throttle:api-write');
Route::delete('/cart/lines/{lineId}', [CartController::class, 'removeLine'])->middleware('throttle:api-write');
Route::delete('/cart', [CartController::class, 'clear'])->middleware('throttle:api-write');

Route::prefix('/admin')
    ->middleware(['auth:sanctum', 'role:super_admin|admin|staff'])
    ->group(function () {
        Route::get('/posts', [PostController::class, 'index']);
        Route::post('/posts', [PostController::class, 'store']);
        Route::get('/posts/{post}', [PostController::class, 'show']);
        Route::get('/posts/{post}/preview-url', [PostController::class, 'previewUrl']);
        Route::put('/posts/{post}', [PostController::class, 'update']);
        Route::patch('/posts/{post}', [PostController::class, 'update']);
        Route::delete('/posts/{post}', [PostController::class, 'destroy']);
        Route::post('/posts/bulk-delete', [PostController::class, 'bulkDestroy']);
        Route::post('/posts/{post}/duplicate', [PostController::class, 'duplicate']);
        Route::post('/posts/generate-seo', [\App\Http\Controllers\Api\Admin\AiSeoController::class, 'generate']);
        Route::get('/blog/categories', [PostController::class, 'categories']);
        Route::get('/blog/tags', [\App\Http\Controllers\Api\Admin\BlogTagController::class, 'index']);
        Route::post('/orders/{id}/refund', [OrderController::class, 'refund']);
        Route::post('/orders/{id}/return', [OrderController::class, 'return']);
        Route::get('/return-requests', [ReturnRequestController::class, 'index']);
        Route::get('/return-requests/{id}', [ReturnRequestController::class, 'show']);
        Route::post('/return-requests/{id}/approve', [ReturnRequestController::class, 'approve']);
        Route::post('/return-requests/{id}/reject', [ReturnRequestController::class, 'reject']);
        Route::post('/return-requests/{id}/complete', [ReturnRequestController::class, 'complete']);
        Route::get('/media', [\App\Http\Controllers\Api\Admin\MediaController::class, 'index']);
        Route::post('/media', [\App\Http\Controllers\Api\Admin\MediaController::class, 'store'])->middleware('throttle:api-write');
        Route::get('/affiliate-networks', [\App\Http\Controllers\Api\Admin\AffiliateNetworkController::class, 'index']);
    });

// Protected Routes
Route::group(['middleware' => ['auth:sanctum']], function () {
    Route::get('/me', [AuthController::class, 'me']);
    Route::post('/logout', [AuthController::class, 'logout']);

    // Address book
    Route::get('/me/addresses', [UserAddressController::class, 'index']);
    Route::post('/me/addresses', [UserAddressController::class, 'store']);
    Route::put('/me/addresses/{id}', [UserAddressController::class, 'update']);
    Route::patch('/me/addresses/{id}', [UserAddressController::class, 'update']);
    Route::delete('/me/addresses/{id}', [UserAddressController::class, 'destroy']);

    // Wishlist
    Route::get('/me/wishlist', [WishlistController::class, 'index']);
    Route::post('/me/wishlist', [WishlistController::class, 'store']);
    Route::delete('/me/wishlist/{productId}', [WishlistController::class, 'destroy']);

    // Checkout & Orders
    Route::get('/orders', [OrderController::class, 'index']);
    Route::get('/orders/{id}', [OrderController::class, 'show']);
    Route::patch('/orders/{id}', [OrderController::class, 'update']);
    Route::post('/orders/{id}/actions/{action}', [OrderController::class, 'performAction']);
    Route::post('/orders/{id}/shipments', [OrderController::class, 'createShipment']);
});
Route::post('/checkout/place-order', [CheckoutController::class, 'placeOrder'])->middleware('throttle:api-write');
