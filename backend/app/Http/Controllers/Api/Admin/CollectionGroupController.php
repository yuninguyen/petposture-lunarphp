<?php

namespace App\Http\Controllers\Api\Admin;

use App\Enums\ErrorCode;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreCollectionGroupRequest;
use App\Http\Requests\Admin\UpdateCollectionGroupRequest;
use App\Http\Resources\Admin\CollectionGroupResource;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Lunar\Models\CollectionGroup;

class CollectionGroupController extends Controller
{
    public function index(): AnonymousResourceCollection
    {
        return CollectionGroupResource::collection(
            CollectionGroup::query()
                ->withCount(['collections' => fn ($query) => $query->whereNull('deleted_at')])
                ->orderBy('name')
                ->get()
        );
    }

    public function store(StoreCollectionGroupRequest $request)
    {
        $collectionGroup = CollectionGroup::query()->create([
            'name' => $request->validated('name'),
            'handle' => $request->validated('handle'),
        ]);

        return (new CollectionGroupResource($collectionGroup->loadCount(['collections' => fn ($query) => $query->whereNull('deleted_at')])))
            ->response()
            ->setStatusCode(Response::HTTP_CREATED);
    }

    public function show(CollectionGroup $collectionGroup): CollectionGroupResource
    {
        return new CollectionGroupResource($collectionGroup->loadCount(['collections' => fn ($query) => $query->whereNull('deleted_at')]));
    }

    public function update(
        UpdateCollectionGroupRequest $request,
        CollectionGroup $collectionGroup
    ): CollectionGroupResource {
        $collectionGroup->update([
            'name' => $request->validated('name'),
            'handle' => $request->validated('handle'),
        ]);

        return new CollectionGroupResource($collectionGroup->refresh()->loadCount(['collections' => fn ($query) => $query->whereNull('deleted_at')]));
    }

    public function destroy(CollectionGroup $collectionGroup): Response|JsonResponse
    {
        try {
            $collectionsCount = DB::transaction(function () use ($collectionGroup): int {
                $lockedCollectionGroup = CollectionGroup::query()->lockForUpdate()->findOrFail($collectionGroup->id);
                $count = $lockedCollectionGroup->collections()->withoutGlobalScopes()->count();

                if ($count === 0) {
                    $lockedCollectionGroup->delete();
                }

                return $count;
            });
        } catch (QueryException $exception) {
            $collectionsCount = $collectionGroup->collections()->withoutGlobalScopes()->count();

            if ($collectionsCount === 0) {
                throw $exception;
            }

            return $this->collectionGroupInUse($collectionGroup, $collectionsCount);
        }

        if ($collectionsCount > 0) {
            return $this->collectionGroupInUse($collectionGroup, $collectionsCount);
        }

        return response()->noContent();
    }

    private function collectionGroupInUse(
        CollectionGroup $collectionGroup,
        int $collectionsCount
    ): JsonResponse {
        return response()->json([
            'code' => ErrorCode::COLLECTION_GROUP_IN_USE->value,
            'message' => 'This collection group cannot be deleted because it is used by collections.',
            'details' => [
                'collection_group_id' => $collectionGroup->id,
                'collections_count' => $collectionsCount,
            ],
        ], Response::HTTP_CONFLICT);
    }
}
