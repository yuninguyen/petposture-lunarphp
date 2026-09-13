<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\ProfilePasswordUpdateRequest;
use App\Http\Requests\Admin\ProfileUpdateRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Spatie\Activitylog\Models\Activity;

class ProfileController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        $user = $request->user();

        $roleLabels = $user->getRoleNames()->map(fn ($r) => Str::headline($r))->values()->all();

        $recentActivityItems = [];

        if (class_exists(Activity::class)) {
            $recentActivityItems = Activity::query()
                ->latest('id')
                ->limit(8)
                ->get()
                ->map(function ($entry) {
                    $baseType = class_basename($entry->subject_type ?: '');
                    $desc = trim($baseType.' '.($entry->description ?: ''));

                    return [
                        'id' => (int) $entry->id,
                        'description' => Str::headline($desc ?: 'Activity'),
                        'subject_type' => (string) $entry->subject_type,
                        'created_at' => $entry->created_at?->toIso8601String(),
                        'created_at_human' => $entry->created_at?->diffForHumans(),
                    ];
                })
                ->values()
                ->all();
        }

        return response()->json([
            'data' => [
                'id' => (int) $user->id,
                'name' => (string) $user->name,
                'email' => (string) $user->email,
                'role_labels' => $roleLabels,
                'joined_at' => $user->created_at?->toIso8601String(),
                'last_login_at' => $user->last_login_at?->toIso8601String(),
                'recent_activity' => [
                    'scope' => 'system',
                    'label' => 'Recent system activity',
                    'items' => $recentActivityItems,
                ],
            ],
        ]);
    }

    public function update(ProfileUpdateRequest $request): JsonResponse
    {
        $user = $request->user();
        $user->update($request->validated());

        return $this->show($request);
    }

    public function updatePassword(ProfilePasswordUpdateRequest $request): JsonResponse
    {
        $user = $request->user();
        $user->update([
            'password' => Hash::make($request->validated('password')),
        ]);

        return response()->json([
            'message' => 'Password updated successfully.',
        ]);
    }
}
