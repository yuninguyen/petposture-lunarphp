<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\FetchAiModelsRequest;
use App\Http\Requests\Admin\TestSmtpSettingsRequest;
use App\Http\Requests\Admin\UpdateAiSettingsRequest;
use App\Http\Requests\Admin\UpdateSmtpSettingsRequest;
use App\Services\Admin\SecureSettingsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

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

    public function revealAiSecret(Request $request, string $field, SecureSettingsService $settings): JsonResponse
    {
        $value = $settings->revealAiSecret($field);

        if ($value === null) {
            return response()->json(['message' => 'No stored value.'], 404)->header('Cache-Control', 'no-store');
        }

        activity()
            ->causedBy($request->user())
            ->event('revealed_secret')
            ->withProperties(['field' => $field])
            ->log('revealed_secret');

        return response()->json(['data' => ['value' => $value]])->header('Cache-Control', 'no-store');
    }

    public function fetchAiModels(FetchAiModelsRequest $request, SecureSettingsService $settings): JsonResponse
    {
        $result = $settings->fetchOpenAiModels($request->validated());

        return response()->json(['data' => $result['data']], $result['status_code']);
    }
}
