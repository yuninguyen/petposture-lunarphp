<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\Api\OrderResource;
use App\Services\ApplyCouponService;
use App\Services\CheckoutService;
use App\Services\SalesTaxService;
use App\Services\StripePaymentIntentService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
use Symfony\Component\HttpFoundation\Response;

class CheckoutController extends Controller
{
    public function __construct(
        private readonly CheckoutService $checkoutService,
        private readonly ApplyCouponService $applyCouponService,
        private readonly StripePaymentIntentService $stripePaymentIntentService,
        private readonly SalesTaxService $salesTaxService,
    ) {
    }

    /**
     * Replaces the old OrderController::store to use Lunar logic.
     */
    public function placeOrder(Request $request)
    {
        $validated = Validator::make($request->all(), [
            'items' => 'required|array',
            'items.*.variantId' => 'required|exists:lunar_product_variants,id',
            'items.*.quantity' => 'required|integer|min:1',
            'shipping' => 'required|array',
            'shipping.email' => 'required|email',
            'shipping.first_name' => 'required|string|max:255',
            'shipping.last_name' => 'required|string|max:255',
            'shipping.company' => 'nullable|string|max:255',
            'shipping.line_one' => 'required|string|max:255',
            'shipping.line_two' => 'nullable|string|max:255',
            'shipping.city' => 'required|string|max:255',
            'shipping.state' => 'required|string|max:255',
            'shipping.postcode' => 'required|string|max:32',
            'shipping.country' => 'required|string|max:255',
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
        ])->validate();

        try {
            $order = $this->checkoutService->placeOrder($validated, auth('sanctum')->id());

            return response()->json([
                'success' => true,
                'order' => new OrderResource($order),
            ], 201);
        } catch (\Throwable $e) {
            Log::error("Checkout Failed: " . $e->getMessage() . " at " . $e->getFile() . ":" . $e->getLine());

            return response()->json([
                'success' => false,
                'message' => 'Checkout failed.',
                'error' => $e->getMessage()
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
                'success' => false,
                'message' => 'Invalid request data.',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            $result = $this->applyCouponService->execute($validator->validated());

            return response()->json($result['body'], $result['status']);
        } catch (\Throwable $e) {
            Log::error("Coupon Application Error: " . $e->getMessage() . " in " . $e->getFile() . ":" . $e->getLine());
            return response()->json([
                'success' => false,
                'message' => 'Error applying coupon: ' . $e->getMessage(),
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
        } catch (\Throwable $e) {
            Log::error("Stripe Payment Intent Error: " . $e->getMessage() . " in " . $e->getFile() . ":" . $e->getLine());

            return response()->json([
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
        } catch (\Throwable $e) {
            Log::error("Stripe Webhook Error: " . $e->getMessage() . " in " . $e->getFile() . ":" . $e->getLine());

            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], Response::HTTP_BAD_REQUEST);
        }
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

}
