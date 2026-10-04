<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\AirwallexService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Str;

/**
 * THROWAWAY spike: finds out what the Airwallex Google Pay element leaves us after a payment
 * (shipping address / email / name). Delete together with its two routes and public/airwallex-wallet-spike.html.
 */
class AirwallexWalletSpikeController extends Controller
{
    public function create(AirwallexService $airwallex): JsonResponse
    {
        $token = 'SPIKE-'.Str::upper(Str::random(16));
        $intent = $airwallex->createPaymentIntent(500, 'USD', $token, rtrim((string) config('app.frontend_url'), '/').'/airwallex-wallet-spike.html');

        return response()->json(['intent' => $intent]);
    }

    public function show(AirwallexService $airwallex, string $intentId): JsonResponse
    {
        abort_unless(str_starts_with($intentId, 'int_'), 404);

        return response()->json(['intent' => $airwallex->retrieveIntent($intentId)]);
    }
}
