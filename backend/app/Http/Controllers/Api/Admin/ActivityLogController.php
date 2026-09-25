<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\CuratorMedia;
use App\Models\Post;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Lunar\Models\Order;
use Lunar\Models\Product;
use Spatie\Activitylog\Models\Activity;
use Spatie\MediaLibrary\MediaCollections\Models\Media;
use Spatie\Permission\Models\Role;

class ActivityLogController extends Controller
{
    private static function subjectTypeMap(): array
    {
        return [
            'product' => [(new Product())->getMorphClass(), 'product', Product::class],
            'order' => [(new Order())->getMorphClass(), 'order', Order::class],
            'post' => [Post::class],
            'user' => [User::class],
            'role' => [Role::class],
            'media' => [CuratorMedia::class, Media::class],
        ];
    }

    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'causer_id' => ['nullable', 'integer'],
            'actor' => ['nullable', 'string', 'max:255'],
            'subject_type' => ['nullable', 'string', 'max:255'],
            'date_from' => ['nullable', 'date'],
            'date_to' => ['nullable', 'date'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $query = Activity::query()
            ->where('log_name', 'default')
            ->with('causer')
            ->latest('id');

        if (! empty($validated['causer_id'])) {
            $query->where('causer_id', (int) $validated['causer_id']);
        }

        if (! empty($validated['actor'])) {
            $needle = '%'.addcslashes(trim($validated['actor']), '%_\\').'%';
            $query->whereHasMorph('causer', [User::class], function ($q) use ($needle) {
                $q->where(function ($q) use ($needle) {
                    $q->where('name', 'like', $needle)->orWhere('email', 'like', $needle);
                });
            });
        }

        if (! empty($validated['subject_type'])) {
            $typeKey = strtolower(trim((string) $validated['subject_type']));
            $typeMap = self::subjectTypeMap();
            if (array_key_exists($typeKey, $typeMap)) {
                $query->whereIn('subject_type', array_unique($typeMap[$typeKey]));
            } else {
                $query->where('subject_type', 'like', "%{$validated['subject_type']}%");
            }
        }

        if (! empty($validated['date_from'])) {
            $query->where('created_at', '>=', Carbon::parse($validated['date_from'])->startOfDay());
        }

        if (! empty($validated['date_to'])) {
            $query->where('created_at', '<=', Carbon::parse($validated['date_to'])->endOfDay());
        }

        $perPage = (int) ($validated['per_page'] ?? 20);
        $activities = $query->paginate($perPage);

        return response()->json([
            'data' => $activities->getCollection()->map(function (Activity $activity): array {
                $actor = null;
                if ($activity->causer) {
                    $actor = [
                        'id' => $activity->causer->id,
                        'name' => $activity->causer->name,
                        'email' => $activity->causer->email,
                    ];
                }

                $subjectType = null;
                if ($activity->subject_type) {
                    $raw = $activity->subject_type;
                    if ($raw === 'product' || $raw === (new Product())->getMorphClass()) {
                        $subjectType = 'Product';
                    } elseif ($raw === 'order' || $raw === (new Order())->getMorphClass()) {
                        $subjectType = 'Order';
                    } else {
                        $base = class_basename($raw);
                        $subjectType = ($base === 'CuratorMedia') ? 'Media' : $base;
                    }
                }

                return [
                    'id' => $activity->id,
                    'actor' => $actor,
                    'event' => $activity->event ?? $activity->description,
                    'subject_type' => $subjectType,
                    'subject_id' => $activity->subject_id ? (int) $activity->subject_id : null,
                    'description' => $activity->description,
                    'properties' => $activity->properties?->toArray() ?? [],
                    'created_at' => $activity->created_at?->toISOString(),
                ];
            })->values(),
            'meta' => [
                'current_page' => $activities->currentPage(),
                'last_page' => $activities->lastPage(),
                'per_page' => $activities->perPage(),
                'total' => $activities->total(),
            ],
        ]);
    }
}
