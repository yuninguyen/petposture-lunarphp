<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\Api\OrderResource;
use App\Http\Resources\Api\OrderTrackingResource;
use App\Models\OrderReturnRequest;
use App\Services\OrderOperationsService;
use App\Services\OrderTrackingAccessService;
use App\Services\StripePaymentIntentService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
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
     * Resolve an order by its redirect-checkout gateway session (Public) — used by the
     * checkout success page when a shopper is bounced back from a hosted payment page
     * (Airwallex/Payoneer/PingPong). A successful lookup rotates and returns a
     * fresh tracking access token because the browser only knows the session id.
     */
    public function byPaymentSession(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'gateway' => 'required|string|in:airwallex,payoneer,pingpong',
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
            'tracking_access_expires_at' => $order->tracking_access_token_expires_at?->toIso8601String(),
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

        $validated = Validator::make($request->all(), [
            'amount' => 'nullable|numeric|min:0.01',
        ])->validate();

        $order = Order::with(['lines', 'shippingAddress', 'billingAddress', 'orderEvents'])->find($id);

        if (! $order) {
            return response()->json(['message' => 'Order not found'], 404);
        }

        $amountMinor = isset($validated['amount']) ? (int) round((float) $validated['amount'] * 100) : null;

        return new OrderResource($this->orderOperationsService->refundOrder($order, $amountMinor));
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
