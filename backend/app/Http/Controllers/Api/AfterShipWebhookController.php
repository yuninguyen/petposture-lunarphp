<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\OrderShipment;
use App\Services\AfterShipService;
use App\Services\OrderOperationsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class AfterShipWebhookController extends Controller
{
    public function __construct(
        private readonly AfterShipService $afterShip,
        private readonly OrderOperationsService $orderOperationsService,
    ) {}

    public function handle(Request $request): JsonResponse
    {
        $signature = $request->header('Aftership-Hmac-Sha256');

        if (! $this->afterShip->verifyWebhookSignature($request->getContent(), $signature)) {
            return response()->json(['message' => 'Invalid signature'], 401);
        }

        $trackingNumber = (string) $request->input('msg.tracking_number', '');
        $tag = (string) $request->input('msg.tag', '');

        if ($trackingNumber === '' || $tag === '') {
            return response()->json(['message' => 'Missing tracking data'], 422);
        }

        if (strtolower($tag) !== 'delivered') {
            return response()->json(['message' => 'Ignored (not a delivered event)']);
        }

        $shipment = OrderShipment::query()->where('tracking_number', $trackingNumber)->first();

        if (! $shipment) {
            Log::info('AfterShip delivered webhook: no matching shipment', ['tracking_number' => $trackingNumber]);

            return response()->json(['message' => 'No matching shipment']);
        }

        $order = $shipment->order;

        if ($order->status === 'delivered') {
            return response()->json(['message' => 'Already delivered']);
        }

        if ($order->status !== 'shipped') {
            Log::info('AfterShip delivered webhook: order not in shipped status yet', [
                'tracking_number' => $trackingNumber,
                'order_status' => $order->status,
            ]);

            return response()->json(['message' => 'Order not shipped yet, ignoring']);
        }

        if ($shipment->status !== 'delivered') {
            $shipment->update(['status' => 'delivered', 'delivered_at' => now()]);
        }

        $allShipmentsDelivered = ! $order->shipments()->where('status', '!=', 'delivered')->exists();

        if (! $allShipmentsDelivered) {
            return response()->json(['message' => 'Shipment delivered, awaiting remaining package(s)']);
        }

        $this->orderOperationsService->update($order, ['status' => 'delivered']);

        return response()->json(['message' => 'Order marked as delivered']);
    }
}
