<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Services\Admin\PaymentMethodService;
use Illuminate\Http\JsonResponse;

class PaymentMethodController extends Controller
{
    public function index(PaymentMethodService $paymentMethods): JsonResponse
    {
        return response()->json([
            'data' => $paymentMethods->all(),
        ]);
    }
}
