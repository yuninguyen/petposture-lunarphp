<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CheckoutController;
use App\Http\Controllers\Api\ContentController;
use App\Http\Controllers\Api\OrderController;
use App\Http\Controllers\Api\PostController;
use App\Http\Controllers\Api\ProductController;
use App\Http\Controllers\Api\SettingsController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

// Public Routes
Route::post('/login', [AuthController::class, 'login']);
Route::post('/register', [AuthController::class, 'register']);

Route::get('/products', [ProductController::class, 'index']);
Route::get('/products/{slug}', [ProductController::class, 'show']);
Route::get('/products/{slug}/reviews', [ProductController::class, 'reviews']);
Route::post('/products/{slug}/reviews', [ProductController::class, 'storeReview']);
Route::post('/orders/track', [OrderController::class, 'track']);
Route::post('/orders/retry-payment', [OrderController::class, 'retryPayment']);
Route::get('/api-test', function () {
    return ['status' => 'ok', 'v' => 3];
});
Route::post('/apply-coupon', [CheckoutController::class, 'applyCoupon']);
Route::get('/checkout/payment-methods', [CheckoutController::class, 'paymentMethods']);
Route::post('/checkout/payment-intent', [CheckoutController::class, 'preparePaymentIntent']);
Route::post('/checkout/tax-quote', [CheckoutController::class, 'taxQuote']);
Route::post('/webhooks/stripe', [CheckoutController::class, 'stripeWebhook']);

Route::get('/posts', [ContentController::class, 'posts']);
Route::get('/posts/{slug}', [ContentController::class, 'post']);
Route::get('/categories', [ContentController::class, 'categories']);
Route::get('/blog/categories', [ContentController::class, 'categories']);

Route::get('/settings', [SettingsController::class, 'index']);

Route::prefix('/admin')->group(function () {
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
Route::post('/checkout/place-order', [CheckoutController::class, 'placeOrder']);

