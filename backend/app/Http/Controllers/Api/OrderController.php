<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\Api\OrderResource;
use App\Http\Resources\Api\OrderTrackingResource;
use App\Mail\TrackingLinkResend;
use App\Models\OrderReturnRequest;
use App\Services\OrderOperationsService;
use App\Services\OrderTrackingAccessService;
use App\Services\StripePaymentIntentService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Lunar\Models\Order;

class OrderController extends Controller
{
    private const SHIPMENT_CARRIERS = 'manual,ups,usps,fedex,dhl';

    public function __construct(
        private readonly OrderOperationsService $orderOperationsService,
        private readonly StripePaymentIntentService $stripePaymentIntentService,
        private readonly OrderTrackingAccessService $orderTrackingAccessService,
    ) {}

    public function track(Request $request)
    {
        $validated = Validator::make($request->all(), [
            'tracking_token' => 'required|string|max:255',
            'email' => 'required|email',
        ])->validate();

        $order = $this->orderTrackingAccessService->find(
            trim((string) $validated['tracking_token']),
            trim((string) $validated['email']),
        );

        if (! $order) {
            Log::warning('Public order tracking lookup failed.', [
                'credential_hash' => hash('sha256', strtolower(trim((string) $validated['email'])).'|'.trim((string) $validated['tracking_token'])),
                'ip' => $request->ip(),
                'user_agent_hash' => hash('sha256', (string) $request->userAgent()),
            ]);

            return response()->json(['message' => 'Unable to access this order.'], 404);
        }

        $hasActiveReturnRequest = OrderReturnRequest::query()
            ->where('order_id', $order->id)
            ->whereIn('status', [OrderReturnRequest::STATUS_REQUESTED, OrderReturnRequest::STATUS_APPROVED])
            ->exists();

        return (new OrderTrackingResource($order))->additional([
            'has_active_return_request' => $hasActiveReturnRequest,
        ]);
    }

    /**
     * Public, enumeration-safe "forgot my tracking link" flow: a shopper who no
     * longer has the confirmation email supplies their order number + email; if
     * it matches, we email them a fresh tracking link instead of returning the
     * order data directly. The response is identical whether or not it matched,
     * so this endpoint never confirms/denies which order numbers or emails exist.
     */
    public function resendTrackingLink(Request $request)
    {
        $validated = Validator::make($request->all(), [
            'order_number' => 'required|string|max:255',
            'email' => 'required|email',
            'context' => 'nullable|string|in:tracking,returns',
        ])->validate();

        $reference = ltrim(trim((string) $validated['order_number']), '#');

        $order = Order::query()
            ->whereRaw('LOWER(reference) = ?', [Str::lower($reference)])
            ->whereRaw('LOWER(customer_reference) = ?', [Str::lower(trim((string) $validated['email']))])
            ->first();

        if ($order) {
            $token = $this->orderTrackingAccessService->issue($order);
            Mail::send(new TrackingLinkResend($order, $token, $validated['context'] ?? 'tracking'));
        } else {
            Log::warning('Public tracking-link resend lookup failed.', [
                'credential_hash' => hash('sha256', strtolower(trim((string) $validated['email'])).'|'.strtolower($reference)),
                'ip' => $request->ip(),
                'user_agent_hash' => hash('sha256', (string) $request->userAgent()),
            ]);
        }

        return response()->json([
            'message' => 'If that matches an order on file, we\'ve sent a tracking link to the email on record.',
        ]);
    }

    /**
     * Resolve an order by its redirect-checkout gateway session (Public) — used by the
     * checkout success page when a shopper is bounced back from a hosted payment page
     * (Airwallex/Payoneer/PingPong/PayPal). A successful lookup rotates and returns a
     * fresh tracking access token because the browser only knows the session id.
     */
    public function byPaymentSession(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'gateway' => 'required|string|in:airwallex,payoneer,pingpong,paypal',
            'session_id' => 'required|string',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $gateway = (string) $request->query('gateway');
        $sessionId = (string) $request->query('session_id');

        $order = Order::query()
            ->where("meta->{$gateway}_session_id", $sessionId)
            ->where('created_at', '>', now()->subHours(24))
            ->with(['shippingAddress', 'billingAddress', 'lines'])
            ->first();

        if (! $order) {
            return response()->json(['message' => 'Unable to access this order.'], 404);
        }

        $this->orderTrackingAccessService->issue($order);
        $hasActiveReturnRequest = OrderReturnRequest::query()
            ->where('order_id', $order->id)
            ->whereIn('status', [OrderReturnRequest::STATUS_REQUESTED, OrderReturnRequest::STATUS_APPROVED])
            ->exists();

        return (new OrderTrackingResource($order))->additional([
            'has_active_return_request' => $hasActiveReturnRequest,
        ]);
    }

    public function retryPayment(Request $request)
    {
        $validated = Validator::make($request->all(), [
            'tracking_token' => 'required|string|max:255',
            'email' => 'required|email',
        ])->validate();

        $order = $this->orderTrackingAccessService->find(
            trim((string) $validated['tracking_token']),
            trim((string) $validated['email']),
        );

        if (! $order) {
            return response()->json(['message' => 'Unable to access this order.'], 404);
        }

        $paymentMethod = (string) (($order->meta['payment_method'] ?? '') ?: '');
        $paymentStatus = (string) (($order->meta['payment_status'] ?? '') ?: 'awaiting-payment');

        $retryEligible = $paymentMethod === 'card'
            && ! in_array($paymentStatus, ['paid', 'cancelled'], true)
            && in_array($order->status, ['awaiting-payment', 'payment-offline'], true)
            && $order->created_at?->greaterThan(now()->subHours(24));

        if (! $retryEligible) {
            return response()->json(['message' => 'Payment retry is unavailable.'], 422);
        }

        $paymentIntent = $this->stripePaymentIntentService->prepareRetryIntent($order);

        return response()->json([
            'success' => true,
            'payment_intent' => $paymentIntent,
            'order' => new OrderTrackingResource($order->refresh()->loadMissing('shippingAddress')),
        ]);
    }

    public function trackingAccess(Request $request, $id)
    {
        $order = $this->baseOrderQuery($request)->find($id);

        if (! $order) {
            return response()->json(['message' => 'Order not found'], 404);
        }

        $token = $this->orderTrackingAccessService->issue($order);

        return response()->json([
            'tracking_access_token' => $token,
            'tracking_access_expires_at' => optional($order->getAttribute('tracking_access_token_expires_at'))->toIso8601String(),
        ]);
    }

    /**
     * List all orders for the authenticated user.
     */
    public function index(Request $request)
    {
        $validated = Validator::make($request->all(), [
            'status' => 'nullable|string|in:awaiting-payment,payment-offline,payment-received,processing,shipped,delivered,cancelled',
        ])->validate();

        $orders = $this->baseOrderQuery($request)
            ->when(isset($validated['status']), fn ($query) => $query->where('status', $validated['status']))
            ->with(['lines', 'shippingAddress', 'billingAddress', 'orderEvents'])
            ->latest()
            ->paginate(10);

        return OrderResource::collection($orders);
    }

    /**
     * Show a specific order.
     */
    public function show(Request $request, $id)
    {
        $order = $this->baseOrderQuery($request)
            ->with(['lines', 'shippingAddress', 'billingAddress', 'orderEvents'])
            ->find($id);

        if (! $order) {
            return response()->json(['message' => 'Order not found'], 404);
        }

        return new OrderResource($order);
    }

    public function update(Request $request, $id)
    {
        if (! $request->user()?->can('update_order')) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $validated = Validator::make($request->all(), [
            'status' => 'nullable|string|in:awaiting-payment,payment-offline,payment-received,processing,shipped,delivered,cancelled',
            'tracking_number' => 'nullable|string|max:255',
            'shipment_carrier' => 'nullable|string|in:'.self::SHIPMENT_CARRIERS,
            'shipment_tracking_url' => 'nullable|url|max:2000',
            'internal_note' => 'nullable|string|max:4000',
        ])->validate();

        $order = Order::with(['lines', 'shippingAddress', 'billingAddress', 'orderEvents'])->find($id);

        if (! $order) {
            return response()->json(['message' => 'Order not found'], 404);
        }

        return new OrderResource($this->orderOperationsService->update($order, $validated));
    }

    public function performAction(Request $request, $id, string $action)
    {
        if (! $request->user()?->can('update_order')) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $validated = Validator::make($request->all(), [
            'tracking_number' => 'nullable|string|max:255',
            'shipment_carrier' => 'nullable|string|in:'.self::SHIPMENT_CARRIERS,
            'shipment_tracking_url' => 'nullable|url|max:2000',
            'internal_note' => 'nullable|string|max:4000',
        ])->validate();

        $order = Order::with(['lines', 'shippingAddress', 'billingAddress', 'orderEvents'])->find($id);

        if (! $order) {
            return response()->json(['message' => 'Order not found'], 404);
        }

        return new OrderResource($this->orderOperationsService->performAction($order, $action, $validated));
    }

    public function createShipment(Request $request, $id)
    {
        if (! $request->user()?->can('update_order')) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $validated = Validator::make($request->all(), [
            'tracking_number' => 'required|string|max:255',
            'shipment_carrier' => 'nullable|string|in:'.self::SHIPMENT_CARRIERS,
            'shipment_tracking_url' => 'nullable|url|max:2000',
            'items' => ['nullable', 'array'],
            'items.*.order_line_id' => ['required_with:items', 'integer'],
            'items.*.quantity' => ['required_with:items', 'integer', 'min:1'],
        ])->validate();

        $order = Order::with(['lines', 'shippingAddress', 'billingAddress', 'orderEvents'])->find($id);

        if (! $order) {
            return response()->json(['message' => 'Order not found'], 404);
        }

        return new OrderResource($this->orderOperationsService->recordShipment($order, $validated));
    }

    public function refund(Request $request, $id)
    {
        if (! $request->user()?->can('refund_order')) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $order = Order::with(['lines', 'shippingAddress', 'billingAddress', 'orderEvents'])->find($id);

        if (! $order) {
            return response()->json(['message' => 'Order not found'], 404);
        }

        $validated = Validator::make($request->all(), [
            'amount' => 'nullable|numeric|min:0.01',
            'reason' => ['required', 'string', Rule::in(array_keys(OrderOperationsService::REFUND_REASON_LABELS))],
        ])->validate();

        $amountMinor = isset($validated['amount']) ? (int) round((float) $validated['amount'] * 100) : null;

        return new OrderResource($this->orderOperationsService->refundOrder($order, $amountMinor, $validated['reason']));
    }

    public function return(Request $request, $id)
    {
        if (! $request->user()?->can('update_order')) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $order = Order::with(['lines', 'shippingAddress', 'billingAddress', 'orderEvents'])->find($id);

        if (! $order) {
            return response()->json(['message' => 'Order not found'], 404);
        }

        return new OrderResource($this->orderOperationsService->returnOrder($order));
    }

    private function baseOrderQuery(Request $request)
    {
        $query = Order::query();

        if ($this->canManageOrders($request)) {
            return $query;
        }

        return $query->where('user_id', $request->user()->id);
    }

    private function canManageOrders(Request $request): bool
    {
        return (bool) $request->user()?->can('view_any_order');
    }
}
