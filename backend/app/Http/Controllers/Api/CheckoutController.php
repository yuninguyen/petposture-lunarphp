<?php

namespace App\Http\Controllers\Api;

use App\Enums\ErrorCode;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\UpsertCheckoutSessionRequest;
use App\Http\Resources\Api\CheckoutSessionResource;
use App\Http\Resources\Api\OrderCreatedResource;
use App\Http\Resources\Api\OrderResource;
use App\Models\CheckoutSession;
use App\Models\UserAddress;
use App\Services\AirwallexService;
use App\Services\ApplyCouponService;
use App\Services\CheckoutService;
use App\Services\CheckoutSessionService;
use App\Services\OrderOperationsService;
use App\Services\PayoneerService;
use App\Services\PayPalService;
use App\Services\PingPongService;
use App\Services\SalesTaxService;
use App\Services\ShippingService;
use App\Services\StripePaymentIntentService;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Lunar\Models\Discount;
use Lunar\Models\Order;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;

class CheckoutController extends Controller
{
    public function __construct(
        private readonly CheckoutService $checkoutService,
        private readonly CheckoutSessionService $checkoutSessionService,
        private readonly ApplyCouponService $applyCouponService,
        private readonly StripePaymentIntentService $stripePaymentIntentService,
        private readonly PayPalService $payPalService,
        private readonly AirwallexService $airwallexService,
        private readonly PayoneerService $payoneerService,
        private readonly PingPongService $pingPongService,
        private readonly OrderOperationsService $orderOperationsService,
        private readonly SalesTaxService $salesTaxService,
        private readonly ShippingService $shippingService,
    ) {}

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
        $validated['attribution']['user_agent'] = $request->userAgent();

        // Populate shipping from saved address when authenticated user passes shipping_address_id
        if (! empty($validated['shipping_address_id']) && $userId) {
            $savedAddress = UserAddress::query()
                ->where('user_id', $userId)
                ->find((int) $validated['shipping_address_id']);

            if ($savedAddress) {
                $validated['shipping'] = array_merge($validated['shipping'] ?? [], [
                    'first_name' => $savedAddress->first_name,
                    'last_name' => $savedAddress->last_name,
                    'line_one' => $savedAddress->line_one,
                    'line_two' => $savedAddress->line_two,
                    'city' => $savedAddress->city,
                    'state' => $savedAddress->state,
                    'postcode' => $savedAddress->postcode,
                    'country' => $savedAddress->country_code,
                    'phone' => $savedAddress->phone,
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
            $cacheKey = 'checkout:idem:'.md5($idempotencyKey.($validated['shipping']['email'] ?? ''));
            $cached = Cache::get($cacheKey);
            if ($cached) {
                return response()->json(['success' => true, 'order' => $cached, '_idempotent' => true], 201);
            }
        }

        try {
            $order = $this->checkoutService->placeOrder($validated, $userId, $request->ip());
            $result = new OrderCreatedResource($order);

            if ($idempotencyKey) {
                Cache::put($cacheKey, $result, now()->addHours(24));
            }

            if ($userId && ! empty($validated['shipping'])) {
                $this->saveShippingAddressForUser($userId, $validated['shipping']);
            }

            return response()->json(['success' => true, 'order' => $result], 201);
        } catch (ValidationException $e) {
            throw $e;
        } catch (\Throwable $e) {
            Log::error("Checkout Failed: {$e->getMessage()} at {$e->getFile()}:{$e->getLine()}");

            return response()->json([
                'code' => ErrorCode::CHECKOUT_FAILED->value,
                'success' => false,
                'message' => 'Checkout failed. Please try again.',
            ], 500);
        }
    }

    /**
     * Save the shipping address used at checkout to the logged-in customer's
     * address book, matching the "Shopify always saves it" convention — no
     * checkbox opt-in, since remembering the customer's own data for their
     * own next order isn't a consent-requiring action. Skips if a matching
     * address (same line_one + postcode) already exists. Never allowed to
     * fail the order itself — this is a convenience side effect only.
     *
     * @param  array<string, mixed>  $shipping
     */
    private function saveShippingAddressForUser(int $userId, array $shipping): void
    {
        try {
            $lineOne = trim((string) ($shipping['line_one'] ?? ''));
            $postcode = trim((string) ($shipping['postcode'] ?? ''));

            if ($lineOne === '' || $postcode === '') {
                return;
            }

            $alreadySaved = UserAddress::query()
                ->where('user_id', $userId)
                ->where('line_one', $lineOne)
                ->where('postcode', $postcode)
                ->exists();

            if ($alreadySaved) {
                return;
            }

            $countryName = trim((string) ($shipping['country'] ?? 'United States'));
            $countryCode = $countryName === 'United States' ? 'US' : strtoupper(substr($countryName, 0, 2));

            $isFirstAddress = ! UserAddress::query()->where('user_id', $userId)->exists();

            UserAddress::create([
                'user_id' => $userId,
                'label' => 'Home',
                'first_name' => (string) ($shipping['first_name'] ?? ''),
                'last_name' => (string) ($shipping['last_name'] ?? ''),
                'line_one' => $lineOne,
                'line_two' => $shipping['line_two'] ?? null,
                'city' => (string) ($shipping['city'] ?? ''),
                'state' => (string) ($shipping['state'] ?? ''),
                'postcode' => $postcode,
                'country_code' => $countryCode,
                'phone' => $shipping['phone'] ?? null,
                'is_default' => $isFirstAddress,
            ]);
        } catch (\Throwable $e) {
            Log::error("Failed to auto-save shipping address for user {$userId}: {$e->getMessage()}");
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
                'code' => ErrorCode::VALIDATION_ERROR->value,
                'success' => false,
                'message' => 'Invalid request data.',
                'errors' => $validator->errors(),
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
                'code' => ErrorCode::COUPON_INVALID->value,
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

    public function upsertSession(UpsertCheckoutSessionRequest $request)
    {
        $validated = $request->checkoutPayload();
        $token = $validated['token'] ?? null;
        unset($validated['token']);

        if ($token) {
            $existingSession = $this->checkoutSessionService->getByToken($token);
            $this->authorizeSessionOwner($request, $existingSession);
        }

        $session = $this->checkoutSessionService->upsert(
            $token,
            $validated,
            auth('sanctum')->id(),
        );

        $response = response()->json([
            'success' => true,
            'session' => new CheckoutSessionResource($session),
        ]);

        if ($session->guestProof) {
            $cookieName = $this->checkoutSessionService->proofCookieName($session->token);
            $response->cookie(
                $cookieName,
                $this->checkoutSessionService->signGuestProof($session->guestProof),
                24 * 60,
                '/api',
                null,
                $request->isSecure() || app()->environment('production'),
                true,
                false,
                'lax',
            );
        }

        return $response;
    }

    public function showSession(Request $request, string $token)
    {
        $session = $this->checkoutSessionService->getByToken($token);
        $cookieName = $this->checkoutSessionService->proofCookieName($token);
        $isOwner = $this->checkoutSessionService->isOwnedByContext(
            $session,
            auth('sanctum')->id(),
            $request->cookie($cookieName),
        );

        if ($session->user_id && ! $isOwner) {
            abort(Response::HTTP_FORBIDDEN);
        }

        return response()->json([
            'success' => true,
            'session' => $isOwner
                ? new CheckoutSessionResource($session)
                : [
                    'token' => $session->token,
                    'status' => $session->status,
                    'expires_at' => optional($session->expires_at)?->toIso8601String(),
                ],
        ]);
    }

    public function prepareSessionPaymentIntent(Request $request, string $token)
    {
        $session = $this->checkoutSessionService->getByToken($token);
        $this->authorizeSessionOwner($request, $session);
        $idempotencyKey = $this->idempotencyKey($request);

        try {
            $intent = $this->checkoutSessionService->preparePaymentIntent($session, $idempotencyKey);

            return response()->json([
                'success' => true,
                'payment_intent' => $intent,
                'session' => new CheckoutSessionResource($session->fresh()),
            ]);
        } catch (ModelNotFoundException|HttpExceptionInterface $e) {
            throw $e;
        } catch (\Throwable $e) {
            Log::error("Session Payment Intent Error: {$e->getMessage()} in {$e->getFile()}:{$e->getLine()}");

            return response()->json([
                'code' => ErrorCode::PAYMENT_INTENT_ERROR->value,
                'success' => false,
                'message' => 'Unable to prepare payment. Please try again.',
            ], 500);
        }
    }

    public function confirmSession(Request $request, string $token)
    {
        $session = $this->checkoutSessionService->getForConfirmation($token);
        $this->authorizeSessionOwner($request, $session, $token);
        $idempotencyKey = $this->idempotencyKey($request);

        try {
            $order = $this->checkoutSessionService->confirm($session, $idempotencyKey);

            return response()->json([
                'success' => true,
                'order' => new OrderCreatedResource($order),
                'session' => new CheckoutSessionResource($session->fresh()),
            ], 201);
        } catch (ValidationException|ModelNotFoundException|HttpExceptionInterface $e) {
            throw $e;
        } catch (\Throwable $e) {
            Log::error("Checkout Session Confirmation Failed: {$e->getMessage()} at {$e->getFile()}:{$e->getLine()}");

            return response()->json([
                'code' => ErrorCode::CHECKOUT_FAILED->value,
                'success' => false,
                'message' => 'Checkout confirmation failed. Please try again.',
            ], 500);
        }
    }

    public function preparePaymentIntent(Request $request)
    {
        $validated = Validator::make($request->all(), [
            'payment_method' => 'required|string|in:card',
            'items' => 'required|array|min:1',
            'items.*.variantId' => 'required|exists:lunar_product_variants,id',
            'items.*.quantity' => 'required|integer|min:1',
            'coupon_code' => 'nullable|string',
            'shipping_method' => 'nullable|string',
            'shipping.state' => 'nullable|string|max:255',
            'shipping.country' => 'nullable|string|max:255',
            'shipping.city' => 'nullable|string|max:255',
            'shipping.postcode' => 'nullable|string|max:32',
            'currency' => 'nullable|string|max:10',
            'email' => 'nullable|email',
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
                    'amount' => $amount,
                    'currency' => $validated['currency'] ?? 'usd',
                    'email' => $validated['email'] ?? '',
                ]),
            ]);
        } catch (ValidationException $e) {
            throw $e;
        } catch (\Throwable $e) {
            Log::error("Stripe Payment Intent Error: {$e->getMessage()} in {$e->getFile()}:{$e->getLine()}");

            return response()->json([
                'code' => ErrorCode::PAYMENT_INTENT_ERROR->value,
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
                'code' => ErrorCode::PAYMENT_FAILED->value,
                'success' => false,
                'message' => 'Webhook processing failed.',
            ], Response::HTTP_BAD_REQUEST);
        }
    }

    public function preparePayPalOrder(Request $request)
    {
        $validated = Validator::make($request->all(), [
            'payment_method' => 'required|string|in:paypal',
            'items' => 'required|array|min:1',
            'items.*.variantId' => 'required|exists:lunar_product_variants,id',
            'items.*.quantity' => 'required|integer|min:1',
            'coupon_code' => 'nullable|string',
            'shipping_method' => 'nullable|string',
            'shipping.state' => 'nullable|string|max:255',
            'shipping.country' => 'nullable|string|max:255',
            'shipping.city' => 'nullable|string|max:255',
            'shipping.postcode' => 'nullable|string|max:32',
            'currency' => 'nullable|string|max:10',
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
                'paypal_order' => $this->payPalService->createOrder(
                    $amount,
                    $validated['currency'] ?? 'usd',
                ),
            ]);
        } catch (ValidationException $e) {
            throw $e;
        } catch (\Throwable $e) {
            Log::error("PayPal Order Error: {$e->getMessage()} in {$e->getFile()}:{$e->getLine()}");

            return response()->json([
                'code' => ErrorCode::PAYMENT_INTENT_ERROR->value,
                'success' => false,
                'message' => 'Unable to prepare PayPal payment. Please try again.',
            ], 500);
        }
    }

    public function capturePayPalOrder(Request $request)
    {
        $validated = Validator::make($request->all(), [
            'paypal_order_id' => 'required|string',
        ])->validate();

        try {
            $order = Order::query()
                ->where('meta->paypal_order_id', $validated['paypal_order_id'])
                ->firstOrFail();

            if (($order->meta['payment_status'] ?? null) === 'paid') {
                return response()->json([
                    'success' => true,
                    'order' => new OrderResource($order),
                    'capture' => ['status' => 'COMPLETED', 'already_captured' => true],
                ]);
            }

            $capture = $this->payPalService->captureOrder($validated['paypal_order_id']);

            $paymentStatus = match ($capture['status']) {
                'COMPLETED' => 'paid',
                'DECLINED', 'FAILED' => 'failed',
                default => 'pending',
            };

            $updatedOrder = $this->orderOperationsService->syncPayPalPayment($order, [
                'payment_status' => $paymentStatus,
                'event_type' => 'checkout.capture',
                'payer_email' => $capture['payer_email'],
                'capture_id' => $capture['capture_id'],
            ]);

            return response()->json([
                'success' => true,
                'order' => new OrderResource($updatedOrder),
                'capture' => $capture,
            ]);
        } catch (ModelNotFoundException $e) {
            throw $e;
        } catch (\Throwable $e) {
            Log::error("PayPal Capture Error: {$e->getMessage()} in {$e->getFile()}:{$e->getLine()}");

            return response()->json([
                'code' => ErrorCode::PAYMENT_FAILED->value,
                'success' => false,
                'message' => 'PayPal payment could not be captured. Please try again.',
            ], 500);
        }
    }

    public function paypalWebhook(Request $request)
    {
        try {
            $result = $this->payPalService->handleWebhook(
                (string) $request->getContent(),
                [
                    'auth_algo' => $request->header('PAYPAL-AUTH-ALGO'),
                    'cert_url' => $request->header('PAYPAL-CERT-URL'),
                    'transmission_id' => $request->header('PAYPAL-TRANSMISSION-ID'),
                    'transmission_sig' => $request->header('PAYPAL-TRANSMISSION-SIG'),
                    'transmission_time' => $request->header('PAYPAL-TRANSMISSION-TIME'),
                ]
            );

            return response()->json([
                'success' => true,
                'result' => $result,
            ], Response::HTTP_OK);
        } catch (\Throwable $e) {
            Log::error("PayPal Webhook Error: {$e->getMessage()} in {$e->getFile()}:{$e->getLine()}");

            return response()->json([
                'code' => ErrorCode::PAYMENT_FAILED->value,
                'success' => false,
                'message' => 'Webhook processing failed.',
            ], Response::HTTP_BAD_REQUEST);
        }
    }

    public function prepareAirwallexSession(Request $request)
    {
        return $this->prepareRedirectSession($request, 'airwallex', function (int $amount, string $currency, string $reference, string $returnUrl) {
            return $this->airwallexService->createCheckoutSession($amount, $currency, $reference, $returnUrl);
        });
    }

    public function preparePayoneerSession(Request $request)
    {
        return $this->prepareRedirectSession($request, 'payoneer', function (int $amount, string $currency, string $reference, string $returnUrl) {
            return $this->payoneerService->createCheckoutSession($amount, $currency, $reference, $returnUrl);
        });
    }

    public function preparePingPongSession(Request $request)
    {
        return $this->prepareRedirectSession($request, 'pingpong', function (int $amount, string $currency, string $reference, string $returnUrl) use ($request) {
            return $this->pingPongService->createCheckoutSession($amount, $currency, $reference, $returnUrl, (string) $request->ip());
        });
    }

    public function preparePayPalSession(Request $request)
    {
        return $this->prepareRedirectSession($request, 'paypal', function (int $amount, string $currency, string $reference, string $returnUrl) {
            $order = $this->payPalService->createOrder($amount, $currency, $returnUrl);

            return [
                'checkout_url' => $order['approve_url'],
                'paypal_order_id' => $order['paypal_order_id'],
            ];
        });
    }

    private function idempotencyKey(Request $request): string
    {
        $validated = Validator::make([
            'idempotency_key' => $request->header('Idempotency-Key'),
        ], [
            'idempotency_key' => ['required', 'string', 'max:255', 'regex:/^[\x20-\x7E]+$/'],
        ])->validate();

        return $validated['idempotency_key'];
    }

    private function authorizeSessionOwner(Request $request, CheckoutSession $session, ?string $contextToken = null): void
    {
        $cookieName = $this->checkoutSessionService->proofCookieName($contextToken ?? $session->token);

        abort_unless(
            $this->checkoutSessionService->isOwnedByContext(
                $session,
                auth('sanctum')->id(),
                $request->cookie($cookieName),
            ),
            Response::HTTP_FORBIDDEN,
        );
    }

    /**
     * Shared validation/total-calculation for the redirect-checkout gateways
     * (Airwallex, Payoneer, PingPong) — each just supplies its own session
     * creation call, mirroring how preparePayPalOrder() creates a PayPal order
     * before placeOrder() links it to the real Lunar order.
     */
    private function prepareRedirectSession(Request $request, string $method, \Closure $createSession)
    {
        $validated = Validator::make($request->all(), [
            'payment_method' => "required|string|in:{$method}",
            'items' => 'required|array|min:1',
            'items.*.variantId' => 'required|exists:lunar_product_variants,id',
            'items.*.quantity' => 'required|integer|min:1',
            'coupon_code' => 'nullable|string',
            'shipping_method' => 'nullable|string',
            'shipping.state' => 'nullable|string|max:255',
            'shipping.country' => 'nullable|string|max:255',
            'shipping.city' => 'nullable|string|max:255',
            'shipping.postcode' => 'nullable|string|max:32',
            'currency' => 'nullable|string|max:10',
        ])->validate();

        try {
            $amount = $this->checkoutService->calculateTotal(
                $validated['items'],
                $validated['coupon_code'] ?? null,
                $validated['shipping'] ?? null,
                $validated['shipping_method'] ?? null,
            );

            // Generated before the order exists (and before the vendor assigns its own
            // session id) so it can be baked into the return_url the shopper is bounced
            // back to — the success page resolves the order via this same token, stored
            // on the order as meta.{gateway}_session_id once placeOrder() runs.
            $sessionToken = strtoupper($method).'-'.Str::upper(Str::random(20));
            $returnUrl = rtrim((string) config('app.frontend_url'), '/')."/checkout/success?gateway={$method}&session_id={$sessionToken}";

            $session = $createSession($amount, $validated['currency'] ?? 'usd', $sessionToken, $returnUrl);
            $session['session_id'] = $sessionToken;

            return response()->json([
                'success' => true,
                'session' => $session,
            ]);
        } catch (ValidationException $e) {
            throw $e;
        } catch (\Throwable $e) {
            Log::error("{$method} Session Error: {$e->getMessage()} in {$e->getFile()}:{$e->getLine()}");

            return response()->json([
                'code' => ErrorCode::PAYMENT_INTENT_ERROR->value,
                'success' => false,
                'message' => 'Unable to prepare payment. Please try again.',
            ], 500);
        }
    }

    public function airwallexWebhook(Request $request)
    {
        try {
            $result = $this->airwallexService->handleWebhook(
                (string) $request->getContent(),
                $request->header('x-signature'),
                $request->header('x-timestamp')
            );

            return response()->json(['success' => true, 'result' => $result], Response::HTTP_OK);
        } catch (\Throwable $e) {
            Log::error("Airwallex Webhook Error: {$e->getMessage()} in {$e->getFile()}:{$e->getLine()}");

            return response()->json([
                'code' => ErrorCode::PAYMENT_FAILED->value,
                'success' => false,
                'message' => 'Webhook processing failed.',
            ], Response::HTTP_BAD_REQUEST);
        }
    }

    public function payoneerWebhook(Request $request)
    {
        try {
            $result = $this->payoneerService->handleWebhook(
                (string) $request->getContent(),
                $request->header('X-Payoneer-Signature')
            );

            return response()->json(['success' => true, 'result' => $result], Response::HTTP_OK);
        } catch (\Throwable $e) {
            Log::error("Payoneer Webhook Error: {$e->getMessage()} in {$e->getFile()}:{$e->getLine()}");

            return response()->json([
                'code' => ErrorCode::PAYMENT_FAILED->value,
                'success' => false,
                'message' => 'Webhook processing failed.',
            ], Response::HTTP_BAD_REQUEST);
        }
    }

    public function pingpongWebhook(Request $request)
    {
        try {
            $result = $this->pingPongService->handleWebhook($request->all());

            return response()->json(['success' => true, 'result' => $result], Response::HTTP_OK);
        } catch (\Throwable $e) {
            Log::error("PingPong Webhook Error: {$e->getMessage()} in {$e->getFile()}:{$e->getLine()}");

            return response()->json([
                'code' => ErrorCode::PAYMENT_FAILED->value,
                'success' => false,
                'message' => 'Webhook processing failed.',
            ], Response::HTTP_BAD_REQUEST);
        }
    }

    public function shippingRates(Request $request)
    {
        $validated = Validator::make($request->all(), [
            'subtotal_minor' => 'nullable|integer|min:0',
            'coupon_code' => 'nullable|string',
        ])->validate();

        $subtotalMinor = (int) ($validated['subtotal_minor'] ?? 0);
        $couponCode = $validated['coupon_code'] ?? null;
        $isFreeShipping = false;

        if ($couponCode) {
            $discount = Discount::active()->where('coupon', $couponCode)->first();
            $isFreeShipping = (bool) ($discount?->data['free_shipping'] ?? false);
        }

        return response()->json([
            'success' => true,
            'rates' => $this->shippingService->availableMethods($subtotalMinor, $isFreeShipping),
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
