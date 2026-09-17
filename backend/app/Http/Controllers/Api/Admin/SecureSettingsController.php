<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\UpdateAiSettingsRequest;
use App\Http\Requests\Admin\UpdateSmtpSettingsRequest;
use App\Services\Admin\SecureSettingsService;
use Illuminate\Http\JsonResponse;

class SecureSettingsController extends Controller
{
    public function smtp(SecureSettingsService $settings): JsonResponse
    {
        return response()->json(['data' => $settings->smtp()]);
    }

    public function updateSmtp(UpdateSmtpSettingsRequest $request, SecureSettingsService $settings): JsonResponse
    {
        return response()->json(['data' => $settings->updateSmtp($request->validated())]);
    }

    public function ai(SecureSettingsService $settings): JsonResponse
    {
        return response()->json(['data' => $settings->ai()]);
    }

    public function updateAi(UpdateAiSettingsRequest $request, SecureSettingsService $settings): JsonResponse
    {
        return response()->json(['data' => $settings->updateAi($request->validated())]);
    }
}
