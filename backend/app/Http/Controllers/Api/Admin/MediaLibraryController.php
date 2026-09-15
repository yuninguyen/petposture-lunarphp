<?php

namespace App\Http\Controllers\Api\Admin;

use App\Enums\ErrorCode;
use App\Http\Controllers\Controller;
use App\Models\CuratorMedia;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Spatie\MediaLibrary\MediaCollections\Models\Media;

class MediaLibraryController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'source' => ['nullable', 'string', Rule::in(['all', 'curator', 'spatie'])],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $source = $validated['source'] ?? 'all';
        $page = (int) ($validated['page'] ?? 1);
        $perPage = (int) ($validated['per_page'] ?? 24);

        $items = collect();

        if ($source === 'all' || $source === 'curator') {
            $curatorItems = CuratorMedia::query()
                ->latest()
                ->get()
                ->map(fn (CuratorMedia $media) => [
                    'id' => $media->id,
                    'source' => 'curator',
                    'url' => $media->url,
                    'thumbnail_url' => $media->thumbnail_url,
                    'name' => $media->name,
                    'folder' => $media->folder,
                    'collection_name' => null,
                    'model_type' => null,
                    'size' => $media->size,
                    'created_at' => $media->created_at?->toISOString(),
                ]);
            $items = $items->concat($curatorItems);
        }

        if ($source === 'all' || $source === 'spatie') {
            $spatieItems = Media::query()
                ->latest()
                ->get()
                ->map(fn (Media $media) => [
                    'id' => $media->id,
                    'source' => 'spatie',
                    'url' => $media->getUrl(),
                    'thumbnail_url' => $media->hasGeneratedConversion('small') ? $media->getUrl('small') : $media->getUrl(),
                    'name' => $media->name,
                    'folder' => null,
                    'collection_name' => $media->collection_name,
                    'model_type' => class_basename($media->model_type),
                    'size' => $media->size,
                    'created_at' => $media->created_at?->toISOString(),
                ]);
            $items = $items->concat($spatieItems);
        }

        // Sort descending by created_at
        $sorted = $items->sortByDesc(function (array $item) {
            return $item['created_at'] ? Carbon::parse($item['created_at'])->timestamp : 0;
        })->values();

        $total = $sorted->count();
        $sliced = $sorted->forPage($page, $perPage)->values();
        $lastPage = (int) max(1, ceil($total / $perPage));

        return response()->json([
            'data' => $sliced,
            'meta' => [
                'current_page' => $page,
                'last_page' => $lastPage,
                'per_page' => $perPage,
                'total' => $total,
            ],
            'current_page' => $page,
            'last_page' => $lastPage,
            'per_page' => $perPage,
            'total' => $total,
        ]);
    }

    public function destroy(Request $request, string $source, int|string $id): Response|JsonResponse
    {
        if ($source === 'spatie') {
            $media = Media::findOrFail($id);

            activity()
                ->causedBy($request->user())
                ->performedOn($media)
                ->withProperties([
                    'before' => [
                        'source' => 'spatie',
                        'id' => (int) $media->id,
                        'name' => $media->name,
                        'attached_to' => class_basename($media->model_type),
                        'model_id' => $media->model_id,
                    ],
                ])
                ->log('deleted');

            $media->delete();

            return response()->noContent();
        }

        if ($source === 'curator') {
            $curatorMedia = CuratorMedia::findOrFail($id);
            $usages = [];

            // Reference Path 1: Check FK references from breeds, solutions, posts
            foreach (['breeds' => 'Breed', 'solutions' => 'Solution', 'posts' => 'Post'] as $table => $label) {
                $titleColumn = $table === 'posts' ? 'title' : 'name';
                $rows = DB::table($table)->where('featured_media_id', $curatorMedia->id)
                    ->select('id', $titleColumn)
                    ->get();

                foreach ($rows as $row) {
                    $usages[] = [
                        'type' => $label,
                        'id' => $row->id,
                        'label' => $row->{$titleColumn} ?? "#{$row->id}",
                    ];
                }
            }

            // Reference Path 2: Check indirect references from Spatie Media (via custom_properties.curator_media_id)
            // Filtered in-memory as established in ProductController:372 and BackfillCuratorMediaFolders:36-47
            $spatieUsages = Media::query()
                ->with('model')
                ->get()
                ->filter(function (Media $spatieMedia) use ($curatorMedia) {
                    $curatorId = $spatieMedia->getCustomProperty('curator_media_id');
                    if ($curatorId === null) {
                        $props = $spatieMedia->custom_properties;
                        $props = is_string($props) ? json_decode($props, true) : (array) $props;
                        $curatorId = $props['curator_media_id'] ?? null;
                    }

                    return $curatorId !== null && (int) $curatorId === (int) $curatorMedia->id;
                });

            foreach ($spatieUsages as $spatieMedia) {
                $model = $spatieMedia->model;
                $label = null;
                if ($model && method_exists($model, 'translateAttribute')) {
                    $label = $model->translateAttribute('name');
                }
                $label = $label ?: ($model?->name ?? $model?->title ?? "#{$spatieMedia->model_id}");

                $usages[] = [
                    'type' => class_basename($spatieMedia->model_type),
                    'id' => $spatieMedia->model_id,
                    'label' => $label,
                ];
            }

            if (! empty($usages)) {
                return response()->json([
                    'code' => ErrorCode::MEDIA_IN_USE->value,
                    'message' => 'This file is currently used elsewhere and cannot be deleted.',
                    'details' => ['usages' => $usages],
                ], Response::HTTP_CONFLICT);
            }

            activity()
                ->causedBy($request->user())
                ->performedOn($curatorMedia)
                ->withProperties([
                    'before' => [
                        'source' => 'curator',
                        'id' => (int) $curatorMedia->id,
                        'name' => $curatorMedia->name,
                        'folder' => $curatorMedia->folder,
                    ],
                ])
                ->log('deleted');

            if ($curatorMedia->disk && $curatorMedia->path) {
                Storage::disk($curatorMedia->disk)->delete($curatorMedia->path);
            }
            $curatorMedia->delete();

            return response()->noContent();
        }

        abort(Response::HTTP_NOT_FOUND);
    }
}
