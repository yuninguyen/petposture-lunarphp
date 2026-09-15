<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Notifications\DatabaseNotification;

class NotificationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $perPage = max(1, min(50, (int) $request->input('per_page', 15)));

        $notifications = $user->notifications()
            ->latest()
            ->paginate($perPage);

        return response()->json([
            'data' => $notifications->getCollection()->map(function (DatabaseNotification $notification): array {
                $data = (array) ($notification->data ?? []);

                return [
                    'id' => (string) $notification->id,
                    'type' => $data['type'] ?? class_basename($notification->type),
                    'icon' => $data['icon'] ?? null,
                    'color' => $data['color'] ?? null,
                    'title' => $data['title'] ?? 'Notification',
                    'body' => $data['body'] ?? '',
                    'url' => $data['url'] ?? null,
                    'read_at' => $notification->read_at?->toISOString(),
                    'created_at' => $notification->created_at?->toISOString(),
                ];
            })->values(),
            'meta' => [
                'current_page' => $notifications->currentPage(),
                'last_page' => $notifications->lastPage(),
                'per_page' => $notifications->perPage(),
                'total' => $notifications->total(),
                'unread_count' => $user->unreadNotifications()->count(),
            ],
        ]);
    }

    public function markAsRead(Request $request, string $id): JsonResponse
    {
        $notification = $request->user()
            ->notifications()
            ->where('id', $id)
            ->first();

        if (! $notification) {
            return response()->json([
                'message' => 'Notification not found',
            ], 404);
        }

        $notification->markAsRead();

        return response()->json([
            'success' => true,
        ]);
    }

    public function markAllAsRead(Request $request): JsonResponse
    {
        $request->user()->unreadNotifications->markAsRead();

        return response()->json([
            'success' => true,
        ]);
    }
}
