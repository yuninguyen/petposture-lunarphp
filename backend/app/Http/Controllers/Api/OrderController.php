<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\Api\OrderResource;
use App\Services\OrderOperationsService;
use App\Services\StripePaymentIntentService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Lunar\Models\Order;

class OrderController extends Controller
{
    private const SHIPMENT_CARRIERS = 'manual,ups,usps,fedex,dhl';

    public function __construct(
        private readonly OrderOperationsService $orderOperationsService,
        private readonly StripePaymentIntentService $stripePaymentIntentService,
    ) {
    }

    /**
     * Track an order via Number and Email (Public).
     */
    public function track(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'tracking_number' => 'required|string',
            'email' => 'required|email',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $order = $this->findPublicOrderByCredentials(
            trim((string) $request->tracking_number),
            trim((string) $request->email),
        );

        if (!$order) {
            return response()->json(['message' => 'No order found with these credentials.'], 404);
        }

        return new OrderResource($order);
    }

    public function retryPayment(Request $request)
    {
        $validated = Validator::make($request->all(), [
            'tracking_number' => 'required|string',
            'email' => 'required|email',
        ])->validate();

        $order = $this->findPublicOrderByCredentials(
            trim((string) $validated['tracking_number']),
            trim((string) $validated['email']),
        );

        if (! $order) {
            return response()->json(['message' => 'No order found with these credentials.'], 404);
        }

        $paymentMethod = (string) (($order->meta['payment_method'] ?? '') ?: '');
        $paymentStatus = (string) (($order->meta['payment_status'] ?? '') ?: 'awaiting-payment');

        if ($paymentMethod !== 'card') {
            return response()->json(['message' => 'This order cannot be retried with card payment.'], 422);
        }

        if (in_array($paymentStatus, ['paid', 'cancelled'], true) || $order->status === 'cancelled') {
            return response()->json(['message' => 'This order is not eligible for payment retry.'], 422);
        }

        $paymentIntent = $this->stripePaymentIntentService->prepareRetryIntent($order);

        return response()->json([
            'success' => true,
            'payment_intent' => $paymentIntent,
            'order' => new OrderResource($order->refresh()->loadMissing(['lines', 'shippingAddress', 'billingAddress', 'orderEvents'])),
        ]);
    }

    /**
     * List all orders for the authenticated user.
     */
    public function index(Request $request)
    {
        $orders = $this->baseOrderQuery($request)
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

        if (!$order) {
            return response()->json(['message' => 'Order not found'], 404);
        }

        return new OrderResource($order);

        return new OrderResource($order);
    }

    public function update(Request $request, $id)
    {
        if (!$this->canManageOrders($request)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $validated = Validator::make($request->all(), [
            'status' => 'nullable|string|in:awaiting-payment,payment-offline,payment-received,processing,shipped,delivered,cancelled',
            'tracking_number' => 'nullable|string|max:255',
            'shipment_carrier' => 'nullable|string|in:' . self::SHIPMENT_CARRIERS,
            'shipment_tracking_url' => 'nullable|url|max:2000',
            'internal_note' => 'nullable|string|max:4000',
        ])->validate();

        $order = Order::with(['lines', 'shippingAddress', 'billingAddress', 'orderEvents'])->find($id);

        if (!$order) {
            return response()->json(['message' => 'Order not found'], 404);
        }

        return new OrderResource($this->orderOperationsService->update($order, $validated));
    }

    public function performAction(Request $request, $id, string $action)
    {
        if (!$this->canManageOrders($request)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $validated = Validator::make($request->all(), [
            'tracking_number' => 'nullable|string|max:255',
            'shipment_carrier' => 'nullable|string|in:' . self::SHIPMENT_CARRIERS,
            'shipment_tracking_url' => 'nullable|url|max:2000',
            'internal_note' => 'nullable|string|max:4000',
        ])->validate();

        $order = Order::with(['lines', 'shippingAddress', 'billingAddress', 'orderEvents'])->find($id);

        if (!$order) {
            return response()->json(['message' => 'Order not found'], 404);
        }

        return new OrderResource($this->orderOperationsService->performAction($order, $action, $validated));
    }

    public function createShipment(Request $request, $id)
    {
        if (!$this->canManageOrders($request)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $validated = Validator::make($request->all(), [
            'tracking_number' => 'required|string|max:255',
            'shipment_carrier' => 'nullable|string|in:' . self::SHIPMENT_CARRIERS,
            'shipment_tracking_url' => 'nullable|url|max:2000',
        ])->validate();

        $order = Order::with(['lines', 'shippingAddress', 'billingAddress', 'orderEvents'])->find($id);

        if (!$order) {
            return response()->json(['message' => 'Order not found'], 404);
        }

        return new OrderResource($this->orderOperationsService->createShipment($order, $validated));
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
        return (bool) $request->user()?->hasAnyRole([
            'super_admin',
            'admin',
            'staff',
            'Order Manager',
            'Support',
        ]);
    }

    private function findPublicOrderByCredentials(string $trackingNumber, string $email): ?Order
    {
        return Order::with(['lines', 'shippingAddress', 'billingAddress', 'orderEvents'])
            ->where(function ($query) use ($trackingNumber) {
                $query->where('reference', $trackingNumber)
                    ->orWhere('meta->tracking_number', $trackingNumber);
            })
            ->where('customer_reference', $email)
            ->first();
    }
}
