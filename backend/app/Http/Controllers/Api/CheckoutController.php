<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\Api\CheckoutSessionResource;
use App\Http\Resources\Api\OrderResource;
use App\Models\UserAddress;
use App\Services\ApplyCouponService;
use App\Services\CheckoutService;
use App\Services\CheckoutSessionService;
use App\Services\SalesTaxService;
use App\Services\ShippingService;
use App\Services\StripePaymentIntentService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\Response;

class CheckoutController extends Controller
{
    public function __construct(
        private readonly CheckoutService $checkoutService,
        private readonly CheckoutSessionService $checkoutSessionService,
        private readonly ApplyCouponService $applyCouponService,
        private readonly StripePaymentIntentService $stripePaymentIntentService,
        private readonly SalesTaxService $salesTaxService,
        private readonly ShippingService $shippingService,
    ) {
    }

    /**
     * Replaces the old OrderController::store to use Lunar logic.
     */
    public function placeOrder(Request $request)
    {
        $userId = auth('sanctum')->id();

        $validated = Validator::make($request->all(), [
            'items' => 'required|array',
            'items.*.variantId' => 'required|exists:lunar_product_variants,id',
            'items.*.quantity' => 'required|integer|min:1',
            'shipping_address_id' => 'nullable|integer',
            'shipping' => 'nullable|array',
            'shipping.email' => 'nullable|email',
            'shipping.first_name' => 'nullable|string|max:255',
            'shipping.last_name' => 'nullable|string|max:255',
            'shipping.company' => 'nullable|string|max:255',
            'shipping.line_one' => 'nullable|string|max:255',
            'shipping.line_two' => 'nullable|string|max:255',
            'shipping.city' => 'nullable|string|max:255',
            'shipping.state' => 'nullable|string|max:255',
            'shipping.postcode' => 'nullable|string|max:32',
            'shipping.country' => 'nullable|string|max:255',
            'shipping.phone' => 'nullable|string|max:50',
            'billing_same_as_shipping' => 'nullable|boolean',
            'billing' => 'nullable|array',
            'billing.first_name' => 'nullable|string|max:255',
            'billing.last_name' => 'nullable|string|max:255',
            'billing.company' => 'nullable|string|max:255',
            'billing.line_one' => 'nullable|string|max:255',
            'billing.line_two' => 'nullable|string|max:255',
            'billing.city' => 'nullable|string|max:255',
            'billing.state' => 'nullable|string|max:255',
            'billing.postcode' => 'nullable|string|max:32',
            'billing.country' => 'nullable|string|max:255',
            'billing.phone' => 'nullable|string|max:50',
            'shipping_method' => 'nullable|string',
            'payment_method' => 'nullable|string',
            'payment_context' => 'nullable|array',
            'coupon_code' => 'nullable|string',
            'customer_note' => 'nullable|string|max:2000',
            'attribution' => 'nullable|array',
            'attribution.origin' => 'nullable|string|max:255',
            'attribution.session_page_views' => 'nullable|integer|min:1',
        ])->validate();

        $validated['attribution']['device_type'] = $this->resolveDeviceType($request->userAgent());

        // Populate shipping from saved address when authenticated user passes shipping_address_id
        if (! empty($validated['shipping_address_id']) && $userId) {
            $savedAddress = UserAddress::query()
                ->where('user_id', $userId)
                ->find((int) $validated['shipping_address_id']);

            if ($savedAddress) {
                $validated['shipping'] = array_merge($validated['shipping'] ?? [], [
                    'first_name' => $savedAddress->first_name,
                    'last_name'  => $savedAddress->last_name,
                    'line_one'   => $savedAddress->line_one,
                    'line_two'   => $savedAddress->line_two,
                    'city'       => $savedAddress->city,
                    'state'      => $savedAddress->state,
                    'postcode'   => $savedAddress->postcode,
                    'country'    => $savedAddress->country_code,
                    'phone'      => $savedAddress->phone,
                ]);
            }
        }

        // email is required; if not in shipping block, fall back to authenticated user's email
        if (empty($validated['shipping']['email']) && $userId) {
            $validated['shipping']['email'] = auth('sanctum')->user()?->email ?? '';
        }

        if (empty($validated['shipping']['email'])) {
            throw ValidationException::withMessages(['shipping.email' => 'The shipping.email field is required.']);
        }

        // Idempotency: client can pass Idempotency-Key header to prevent duplicate orders
        // on double-click / network retry. Key is scoped per IP+email.
        $idempotencyKey = $request->header('Idempotency-Key');
        if ($idempotencyKey) {
            $cacheKey = 'checkout:idem:' . md5($idempotencyKey . ($validated['shipping']['email'] ?? ''));
            $cached   = Cache::get($cacheKey);
            if ($cached) {
                return response()->json(['success' => true, 'order' => $cached, '_idempotent' => true], 201);
            }
        }

        try {
            $order = $this->checkoutService->placeOrder($validated, $userId, $request->ip());
            $result = new OrderResource($order);

            if ($idempotencyKey) {
                Cache::put($cacheKey, $result, now()->addHours(24));
            }

            return response()->json(['success' => true, 'order' => $result], 201);
        } catch (ValidationException $e) {
            throw $e;
        } catch (\Throwable $e) {
            Log::error("Checkout Failed: {$e->getMessage()} at {$e->getFile()}:{$e->getLine()}");

            return response()->json([
                'code'    => \App\Enums\ErrorCode::CHECKOUT_FAILED->value,
                'success' => false,
                'message' => 'Checkout failed. Please try again.',
            ], 500);
        }
    }

    /**
     * Apply a coupon to the checkout session.
     */
    public function applyCoupon(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'coupon_code' => 'required|string',
            'items' => 'required|array',
            'items.*.variantId' => 'required|exists:lunar_product_variants,id',
            'items.*.quantity' => 'required|integer|min:1',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'code'    => \App\Enums\ErrorCode::VALIDATION_ERROR->value,
                'success' => false,
                'message' => 'Invalid request data.',
                'errors'  => $validator->errors(),
            ], 422);
        }

        try {
            $result = $this->applyCouponService->execute($validator->validated());

            return response()->json($result['body'], $result['status']);
        } catch (ValidationException $e) {
            throw $e;
        } catch (\Throwable $e) {
            Log::error("Coupon Application Error: {$e->getMessage()} in {$e->getFile()}:{$e->getLine()}");

            return response()->json([
                'code'    => \App\Enums\ErrorCode::COUPON_INVALID->value,
                'success' => false,
                'message' => 'Error applying coupon. Please try again.',
            ], 500);
        }
    }

    public function paymentMethods()
    {
        return response()->json([
            'success' => true,
            'methods' => $this->checkoutService->supportedPaymentMethods(),
        ]);
    }

    public function upsertSession(Request $request)
    {
        $validated = Validator::make($request->all(), [
            'token' => 'nullable|uuid',
            'items' => 'nullable|array',
            'items.*.variantId' => 'required_with:items|exists:lunar_product_variants,id',
            'items.*.quantity' => 'required_with:items|integer|min:1',
            'shipping' => 'nullable|array',
            'billing_same_as_shipping' => 'nullable|boolean',
            'billing' => 'nullable|array',
            'shipping_method' => 'nullable|string',
            'payment_method' => 'nullable|string',
            'payment_context' => 'nullable|array',
            'coupon_code' => 'nullable|string',
            'customer_note' => 'nullable|string|max:2000',
            'currency' => 'nullable|string|max:10',
        ])->validate();

        $session = $this->checkoutSessionService->upsert(
            $validated['token'] ?? null,
            $validated,
            auth('sanctum')->id(),
        );

        return response()->json([
            'success' => true,
            'session' => new CheckoutSessionResource($session),
        ]);
    }

    public function showSession(string $token)
    {
        return response()->json([
            'success' => true,
            'session' => new CheckoutSessionResource(
                $this->checkoutSessionService->getByToken($token)
            ),
        ]);
    }

    public function prepareSessionPaymentIntent(string $token)
    {
        try {
            $session = $this->checkoutSessionService->getByToken($token);
            $intent  = $this->checkoutSessionService->preparePaymentIntent($session);

            return response()->json([
                'success'        => true,
                'payment_intent' => $intent,
                'session'        => new CheckoutSessionResource($session->fresh()),
            ]);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            throw $e;
        } catch (\Throwable $e) {
            Log::error("Session Payment Intent Error: {$e->getMessage()} in {$e->getFile()}:{$e->getLine()}");

            return response()->json([
                'code'    => \App\Enums\ErrorCode::PAYMENT_INTENT_ERROR->value,
                'success' => false,
                'message' => 'Unable to prepare payment. Please try again.',
            ], 500);
        }
    }

    public function confirmSession(string $token)
    {
        try {
            $session = $this->checkoutSessionService->getByToken($token);
            $order = $this->checkoutSessionService->confirm($session);

            return response()->json([
                'success' => true,
                'order' => new OrderResource($order),
                'session' => new CheckoutSessionResource($session->fresh()),
            ], 201);
        } catch (ValidationException $e) {
            throw $e;
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            throw $e;
        } catch (\Throwable $e) {
            Log::error("Checkout Session Confirmation Failed: {$e->getMessage()} at {$e->getFile()}:{$e->getLine()}");

            return response()->json([
                'code'    => \App\Enums\ErrorCode::CHECKOUT_FAILED->value,
                'success' => false,
                'message' => 'Checkout confirmation failed. Please try again.',
            ], 500);
        }
    }

    public function preparePaymentIntent(Request $request)
    {
        $validated = Validator::make($request->all(), [
            'payment_method'        => 'required|string|in:card',
            'items'                 => 'required|array|min:1',
            'items.*.variantId'     => 'required|exists:lunar_product_variants,id',
            'items.*.quantity'      => 'required|integer|min:1',
            'coupon_code'           => 'nullable|string',
            'shipping_method'       => 'nullable|string',
            'shipping.state'        => 'nullable|string|max:255',
            'shipping.country'      => 'nullable|string|max:255',
            'shipping.city'         => 'nullable|string|max:255',
            'shipping.postcode'     => 'nullable|string|max:32',
            'currency'              => 'nullable|string|max:10',
            'email'                 => 'nullable|email',
        ])->validate();

        try {
            $amount = $this->checkoutService->calculateTotal(
                $validated['items'],
                $validated['coupon_code'] ?? null,
                $validated['shipping'] ?? null,
                $validated['shipping_method'] ?? null,
            );

            return response()->json([
                'success' => true,
                'payment_intent' => $this->stripePaymentIntentService->create([
                    'amount'   => $amount,
                    'currency' => $validated['currency'] ?? 'usd',
                    'email'    => $validated['email'] ?? '',
                ]),
            ]);
        } catch (ValidationException $e) {
            throw $e;
        } catch (\Throwable $e) {
            Log::error("Stripe Payment Intent Error: {$e->getMessage()} in {$e->getFile()}:{$e->getLine()}");

            return response()->json([
                'code'    => \App\Enums\ErrorCode::PAYMENT_INTENT_ERROR->value,
                'success' => false,
                'message' => 'Unable to prepare payment. Please try again.',
            ], 500);
        }
    }

    public function stripeWebhook(Request $request)
    {
        try {
            $result = $this->stripePaymentIntentService->handleWebhook(
                (string) $request->getContent(),
                $request->header('Stripe-Signature')
            );

            return response()->json([
                'success' => true,
                'result' => $result,
            ], Response::HTTP_OK);
        } catch (ValidationException $e) {
            throw $e;
        } catch (\Throwable $e) {
            Log::error("Stripe Webhook Error: {$e->getMessage()} in {$e->getFile()}:{$e->getLine()}");

            return response()->json([
                'code'    => \App\Enums\ErrorCode::PAYMENT_FAILED->value,
                'success' => false,
                'message' => 'Webhook processing failed.',
            ], Response::HTTP_BAD_REQUEST);
        }
    }

    public function shippingRates(Request $request)
    {
        $validated = Validator::make($request->all(), [
            'subtotal_minor' => 'nullable|integer|min:0',
            'coupon_code'    => 'nullable|string',
        ])->validate();

        $subtotalMinor = (int) ($validated['subtotal_minor'] ?? 0);
        $couponCode    = $validated['coupon_code'] ?? null;
        $isFreeShipping = false;

        if ($couponCode) {
            $discount = \Lunar\Models\Discount::active()->where('coupon', $couponCode)->first();
            $isFreeShipping = (bool) ($discount?->data['free_shipping'] ?? false);
        }

        return response()->json([
            'success' => true,
            'rates'   => $this->shippingService->availableMethods($subtotalMinor, $isFreeShipping),
        ]);
    }

    public function taxQuote(Request $request)
    {
        $validated = Validator::make($request->all(), [
            'shipping.state' => 'nullable|string|max:255',
            'shipping.country' => 'nullable|string|max:255',
            'shipping.city' => 'nullable|string|max:255',
            'shipping.postcode' => 'nullable|string|max:32',
            'subtotal_amount' => 'required|numeric|min:0',
            'discount_amount' => 'nullable|numeric|min:0',
        ])->validate();

        $subtotal = (float) ($validated['subtotal_amount'] ?? 0);
        $discount = (float) ($validated['discount_amount'] ?? 0);
        $taxableAmount = (int) round(max(0, $subtotal - $discount) * 100);

        return response()->json([
            'success' => true,
            'quote' => $this->salesTaxService->quote($validated['shipping'] ?? [], $taxableAmount),
        ]);
    }

    private function resolveDeviceType(?string $userAgent): string
    {
        if (! $userAgent) {
            return 'Unknown';
        }

        if (preg_match('/tablet|ipad/i', $userAgent)) {
            return 'Tablet';
        }

        if (preg_match('/mobile|android|iphone/i', $userAgent)) {
            return 'Mobile';
        }

        return 'Desktop';
    }
}
