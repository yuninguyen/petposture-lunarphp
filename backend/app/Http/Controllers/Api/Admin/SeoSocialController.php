<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Setting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SeoSocialController extends Controller
{
    public function index(): JsonResponse
    {
        $keys = [
            'social_facebook',
            'social_instagram',
            'social_twitter',
            'social_tiktok',
            'social_pinterest',
            'social_youtube',
            'business_phone',
            'business_address',
        ];

        $settings = Setting::whereIn('key', $keys)->get()->pluck('value', 'key')->toArray();

        // Ensure all keys exist in the response
        $data = [];
        foreach ($keys as $key) {
            $data[$key] = $settings[$key] ?? '';
        }

        return response()->json($data);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'social_facebook' => 'nullable|url|max:255',
            'social_instagram' => 'nullable|url|max:255',
            'social_twitter' => 'nullable|url|max:255',
            'social_tiktok' => 'nullable|url|max:255',
            'social_pinterest' => 'nullable|url|max:255',
            'social_youtube' => 'nullable|url|max:255',
            'business_phone' => 'nullable|string|max:50',
            'business_address' => 'nullable|string|max:255',
        ]);

        foreach ($validated as $key => $value) {
            Setting::updateOrCreate(
                ['key' => $key],
                [
                    'value' => $value ?? '',
                    'type' => 'string',
                    'group' => 'seo_social',
                ]
            );
        }

        return response()->json(['message' => 'SEO & Social settings updated successfully.']);
    }
}
