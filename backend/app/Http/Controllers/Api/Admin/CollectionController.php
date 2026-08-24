<?php

namespace App\Http\Controllers\Api\Admin;

use App\Enums\ErrorCode;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\MoveCollectionRequest;
use App\Http\Requests\Admin\ReorderCollectionRequest;
use App\Http\Requests\Admin\StoreCollectionRequest;
use App\Http\Requests\Admin\UpdateCollectionRequest;
use App\Http\Resources\Admin\CollectionResource;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Lunar\FieldTypes\TranslatedText;
use Lunar\Models\Collection;
use Lunar\Models\CollectionGroup;

class CollectionController extends Controller
{
    public function index(): JsonResponse
    {
        $groups = CollectionGroup::query()
            ->orderBy('name')
            ->get()
            ->map(function (CollectionGroup $group): array {
                $nodes = Collection::query()
                    ->where('collection_group_id', $group->id)
                    ->whereNull('deleted_at')
                    ->defaultOrder()
                    ->get()
                    ->toTree();

                return [
                    'id' => $group->id,
                    'name' => $group->name,
                    'handle' => $group->handle,
                    'collections' => CollectionResource::collection($nodes),
                ];
            });

        return response()->json(['data' => $groups]);
    }

    public function store(StoreCollectionRequest $request): JsonResponse
    {
        $validated = $request->validated();

        $collection = DB::transaction(function () use ($validated): Collection {
            $group = CollectionGroup::query()->lockForUpdate()->findOrFail($validated['collection_group_id']);
            $parent = null;

            if ($validated['parent_id'] ?? null) {
                $parent = Collection::query()->whereNull('deleted_at')->lockForUpdate()->findOrFail($validated['parent_id']);

                if ($parent->collection_group_id !== $group->id) {
                    throw ValidationException::withMessages([
                        'parent_id' => 'The parent collection must belong to the selected collection group.',
                    ]);
                }
            }

            $collection = new Collection([
                'collection_group_id' => $group->id,
                'attribute_data' => [
                    'name' => new TranslatedText([
                        'en' => $validated['name'],
                        'vi' => $validated['name'],
                    ]),
                ],
            ]);

            if ($parent) {
                $collection->appendToNode($parent)->save();
            } else {
                $collection->saveAsRoot();
            }

            return $collection;
        });

        return (new CollectionResource($this->loadNode($collection)))
            ->response()
            ->setStatusCode(Response::HTTP_CREATED);
    }

    public function show(Collection $collection): CollectionResource
    {
        $activeCollection = Collection::query()
            ->whereNull('deleted_at')
            ->findOrFail($collection->id);

        return new CollectionResource($this->loadNode($activeCollection));
    }

    public function update(UpdateCollectionRequest $request, Collection $collection): CollectionResource
    {
        $validated = $request->validated();

        DB::transaction(function () use ($validated, $collection): void {
            $locked = Collection::query()->whereNull('deleted_at')->lockForUpdate()->findOrFail($collection->id);
            $attributeData = $locked->attribute_data ?? collect();
            $attributeData->put('name', new TranslatedText([
                'en' => $validated['name'],
                'vi' => $validated['name'],
            ]));
            $locked->attribute_data = $attributeData;
            $locked->save();
        });

        return new CollectionResource($this->loadNode($collection->fresh()));
    }

    public function destroy(Collection $collection): Response|JsonResponse
    {
        try {
            $usage = DB::transaction(function () use ($collection): array {
                CollectionGroup::query()->lockForUpdate()->findOrFail($collection->collection_group_id);
                $locked = Collection::query()->whereNull('deleted_at')->lockForUpdate()->findOrFail($collection->id);

                $childrenCount = Collection::query()->withoutGlobalScopes()
                    ->where('parent_id', $locked->id)
                    ->lockForUpdate()
                    ->count();
                $productsCount = $locked->products()->withTrashed()->count();

                if ($childrenCount === 0 && $productsCount === 0) {
                    $locked->delete();
                }

                return compact('childrenCount', 'productsCount');
            });
        } catch (QueryException $exception) {
            $usage = $this->usageCounts($collection);

            if ($usage['childrenCount'] === 0 && $usage['productsCount'] === 0) {
                throw $exception;
            }
        }

        if ($usage['childrenCount'] > 0 || $usage['productsCount'] > 0) {
            return response()->json([
                'code' => ErrorCode::COLLECTION_IN_USE->value,
                'message' => 'This collection cannot be deleted because it has children or products.',
                'details' => [
                    'collection_id' => $collection->id,
                    'children_count' => $usage['childrenCount'],
                    'products_count' => $usage['productsCount'],
                ],
            ], Response::HTTP_CONFLICT);
        }

        return response()->noContent();
    }

    public function reorder(ReorderCollectionRequest $request, Collection $collection): CollectionResource
    {
        $validated = $request->validated();

        DB::transaction(function () use ($collection, $validated): void {
            CollectionGroup::query()->lockForUpdate()->findOrFail($collection->collection_group_id);
            $ids = [$collection->id, (int) $validated['sibling_id']];
            sort($ids);
            Collection::query()->whereNull('deleted_at')->whereIn('id', $ids)->orderBy('id')->lockForUpdate()->get();

            $node = Collection::query()->whereNull('deleted_at')->findOrFail($collection->id);
            $sibling = Collection::query()->whereNull('deleted_at')->findOrFail($validated['sibling_id']);

            if ($node->id === $sibling->id ||
                $node->collection_group_id !== $sibling->collection_group_id ||
                $node->parent_id !== $sibling->parent_id) {
                throw ValidationException::withMessages([
                    'sibling_id' => 'The sibling must be a different active collection with the same group and parent.',
                ]);
            }

            $validated['position'] === 'before'
                ? $node->beforeNode($sibling)->save()
                : $node->afterNode($sibling)->save();
        });

        return new CollectionResource($this->loadNode($collection->fresh()));
    }

    public function move(MoveCollectionRequest $request, Collection $collection): CollectionResource
    {
        $validated = $request->validated();
        $targetGroupId = (int) $validated['collection_group_id'];
        $parentId = isset($validated['parent_id']) ? (int) $validated['parent_id'] : null;

        if ($targetGroupId === $collection->collection_group_id) {
            $this->moveWithinGroup($collection, $parentId);
        } else {
            $this->moveAcrossGroups($collection, $targetGroupId, $parentId);
        }

        return new CollectionResource($this->loadNode($collection->fresh()));
    }

    private function moveWithinGroup(Collection $collection, ?int $parentId): void
    {
        DB::transaction(function () use ($collection, $parentId): void {
            CollectionGroup::query()->lockForUpdate()->findOrFail($collection->collection_group_id);
            $node = Collection::query()->whereNull('deleted_at')->lockForUpdate()->findOrFail($collection->id);

            if ($parentId === null) {
                $node->makeRoot()->save();

                return;
            }

            $parent = Collection::query()->whereNull('deleted_at')->lockForUpdate()->findOrFail($parentId);

            if ($parent->collection_group_id !== $node->collection_group_id ||
                $parent->id === $node->id ||
                $parent->isDescendantOf($node)) {
                throw ValidationException::withMessages([
                    'parent_id' => 'The target parent would create an invalid collection tree.',
                ]);
            }

            $node->appendToNode($parent)->save();
        });
    }

    private function moveAcrossGroups(Collection $collection, int $targetGroupId, ?int $parentId): void
    {
        DB::transaction(function () use ($collection, $targetGroupId, $parentId): void {
            $sourceGroupId = $collection->collection_group_id;
            $groupIds = [$sourceGroupId, $targetGroupId];
            sort($groupIds);
            CollectionGroup::query()->whereIn('id', $groupIds)->orderBy('id')->lockForUpdate()->get();

            $node = Collection::query()->whereNull('deleted_at')->lockForUpdate()->findOrFail($collection->id);
            $parent = null;

            if ($parentId !== null) {
                $parent = Collection::query()->whereNull('deleted_at')->lockForUpdate()->findOrFail($parentId);

                if ($parent->collection_group_id !== $targetGroupId) {
                    throw ValidationException::withMessages([
                        'parent_id' => 'The target parent must be active and belong to the target collection group.',
                    ]);
                }
            }

            $subtree = Collection::query()->withoutGlobalScopes()
                ->where('collection_group_id', $sourceGroupId)
                ->whereBetween('_lft', [$node->_lft, $node->_rgt])
                ->orderBy('_lft')
                ->lockForUpdate()
                ->get();

            $targetMax = (int) Collection::query()->withoutGlobalScopes()
                ->where('collection_group_id', $targetGroupId)
                ->max('_rgt');
            $offset = $targetMax + 1 - $node->_lft;
            $table = $node->getTable();

            DB::table($table)
                ->whereIn('id', $subtree->modelKeys())
                ->update([
                    'collection_group_id' => $targetGroupId,
                    '_lft' => DB::raw('_lft + '.(int) $offset),
                    '_rgt' => DB::raw('_rgt + '.(int) $offset),
                    'updated_at' => now(),
                ]);

            DB::table($table)->where('id', $node->id)->update([
                'parent_id' => $parent?->id,
                'updated_at' => now(),
            ]);

            Collection::scoped(['collection_group_id' => $sourceGroupId])->fixTree();
            Collection::scoped(['collection_group_id' => $targetGroupId])->fixTree();

            if (Collection::scoped(['collection_group_id' => $sourceGroupId])->isBroken() ||
                Collection::scoped(['collection_group_id' => $targetGroupId])->isBroken()) {
                throw new \RuntimeException('The collection tree became invalid during a cross-group move.');
            }
        });
    }

    private function loadNode(Collection $collection): Collection
    {
        $collection->setRelation(
            'children',
            $collection->children()
                ->whereNull('deleted_at')
                ->defaultOrder()
                ->get()
        );

        return $collection;
    }

    private function usageCounts(Collection $collection): array
    {
        return [
            'childrenCount' => Collection::query()->withoutGlobalScopes()->where('parent_id', $collection->id)->count(),
            'productsCount' => $collection->products()->withTrashed()->count(),
        ];
    }
}
