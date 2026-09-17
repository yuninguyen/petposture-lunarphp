<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\TestSmtpSettingsRequest;
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

    public function testSmtp(TestSmtpSettingsRequest $request, SecureSettingsService $settings): JsonResponse
    {
        $result = $settings->testSmtp($request->validated(), (string) $request->user()->email);

        return response()->json(['data' => $result['data']], $result['status_code']);
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
