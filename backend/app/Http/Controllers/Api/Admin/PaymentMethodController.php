<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\TestPaymentMethodRequest;
use App\Http\Requests\Admin\UpdateCodPaymentMethodRequest;
use App\Http\Requests\Admin\UpdatePaymentMethodRequest;
use App\Services\Admin\PaymentMethodService;
use Illuminate\Http\JsonResponse;

class PaymentMethodController extends Controller
{
    public function updateCod(UpdateCodPaymentMethodRequest $request, PaymentMethodService $paymentMethods): JsonResponse
    {
        return response()->json([
            'data' => $paymentMethods->updateCod($request->boolean('enabled')),
        ]);
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

    public function index(PaymentMethodService $paymentMethods): JsonResponse
    {
        return response()->json([
            'data' => $paymentMethods->all(),
            'cod' => ['enabled' => $paymentMethods->codEnabled()],
        ]);
    }
}
