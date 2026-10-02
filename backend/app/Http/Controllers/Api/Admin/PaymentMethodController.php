<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\TestPaymentMethodRequest;
use App\Http\Requests\Admin\UpdateCodPaymentMethodRequest;
use App\Http\Requests\Admin\UpdatePaymentMethodRequest;
use App\Payments\Gateways\StripeCardGateway;
use App\Payments\PaymentGatewayManager;
use App\Services\Admin\PaymentMethodService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class PaymentMethodController extends Controller
{
    public function updateCod(UpdateCodPaymentMethodRequest $request, PaymentMethodService $paymentMethods): JsonResponse
    {
        return response()->json([
            'data' => $paymentMethods->updateCod($request->boolean('enabled')),
        ]);
    }

    public function updateMethod(Request $request, string $method, PaymentMethodService $paymentMethods, PaymentGatewayManager $gateways): JsonResponse
    {
        $validated = $request->validate(['enabled' => ['required', 'boolean']]);

        return response()->json([
            'data' => $paymentMethods->updateMethodEnabled($method, (bool) $validated['enabled'], $gateways),
        ]);
    }

    public function refreshStripeSync(PaymentMethodService $paymentMethods, PaymentGatewayManager $gateways): JsonResponse
    {
        $sync = $paymentMethods->refreshStripeSync();

        return response()->json([
            'data' => ['methods' => $paymentMethods->checkoutMethods($gateways), 'stripe_sync' => $sync],
        ]);
    }

    public function updateCardBrands(Request $request, PaymentMethodService $paymentMethods): JsonResponse
    {
        $validated = $request->validate([
            'brands' => ['present', 'array'],
            'brands.*' => ['string', Rule::in(StripeCardGateway::BRANDS)],
        ]);

        return response()->json(['data' => $paymentMethods->updateCardBrands($validated['brands'])]);
    }

    public function test(TestPaymentMethodRequest $request, string $gateway, PaymentMethodService $paymentMethods): JsonResponse
    {
        $result = $paymentMethods->testConnection($gateway, $request->validated());

        return response()->json(['data' => $result['data']], $result['status_code']);
    }

    public function update(UpdatePaymentMethodRequest $request, string $gateway, PaymentMethodService $paymentMethods): JsonResponse
    {
        return response()->json([
            'data' => $paymentMethods->update($gateway, $request->validated()),
        ]);
    }

    public function index(PaymentMethodService $paymentMethods, PaymentGatewayManager $gateways): JsonResponse
    {
        return response()->json([
            'data' => $paymentMethods->all(),
            'cod' => ['enabled' => $paymentMethods->codEnabled()],
            'methods' => $paymentMethods->checkoutMethods($gateways),
            'card_brands' => $paymentMethods->cardBrands(),
            'stripe_sync' => $paymentMethods->stripeSync(),
        ]);
    }
}
