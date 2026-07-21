<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\AfterShipService;
use App\Services\OrderOperationsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Lunar\Models\Order;

class AfterShipWebhookController extends Controller
{
    public function __construct(
        private readonly AfterShipService $afterShip,
        private readonly OrderOperationsService $orderOperationsService,
    ) {
    }

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

        $order = Order::query()->where('meta->tracking_number', $trackingNumber)->first();

        if (! $order) {
            Log::info('AfterShip delivered webhook: no matching order', ['tracking_number' => $trackingNumber]);

            return response()->json(['message' => 'No matching order']);
        }

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

        $this->orderOperationsService->update($order, ['status' => 'delivered']);

        return response()->json(['message' => 'Order marked as delivered']);
    }
}
