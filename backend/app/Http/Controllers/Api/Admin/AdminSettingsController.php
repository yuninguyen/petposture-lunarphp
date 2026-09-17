<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\UpdateAnalyticsSettingsRequest;
use App\Http\Requests\Admin\UpdateBrandingSettingsRequest;
use App\Http\Requests\Admin\UpdateGeneralSettingsRequest;
use App\Services\Admin\AdminSettingsService;
use Illuminate\Http\JsonResponse;

class AdminSettingsController extends Controller
{
    public function general(AdminSettingsService $settings): JsonResponse
    {
        return response()->json(['data' => $settings->general()]);
    }

    public function updateGeneral(UpdateGeneralSettingsRequest $request, AdminSettingsService $settings): JsonResponse
    {
        return response()->json(['data' => $settings->updateGeneral($request->validated())]);
    }

    public function branding(AdminSettingsService $settings): JsonResponse
    {
        return response()->json(['data' => $settings->branding()]);
    }

    public function updateBranding(UpdateBrandingSettingsRequest $request, AdminSettingsService $settings): JsonResponse
    {
        return response()->json(['data' => $settings->updateBranding($request->validated())]);
    }

    public function analytics(AdminSettingsService $settings): JsonResponse
    {
        return response()->json(['data' => $settings->analytics()]);
    }

    public function updateAnalytics(UpdateAnalyticsSettingsRequest $request, AdminSettingsService $settings): JsonResponse
    {
        return response()->json(['data' => $settings->updateAnalytics($request->validated())]);
    }
}
