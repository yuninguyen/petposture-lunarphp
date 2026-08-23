<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreCustomFieldRequest;
use App\Http\Requests\Admin\UpdateCustomFieldRequest;
use App\Http\Resources\Admin\CustomFieldResource;
use App\Services\CustomFieldService;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Lunar\Models\Attribute;

class CustomFieldController extends Controller
{
    public function __construct(private readonly CustomFieldService $customFields)
    {
    }

    public function index(): AnonymousResourceCollection
    {
        $attributes = $this->customFields->manageableQuery()
            ->orderBy('attribute_type')
            ->orderBy('position')
            ->get()
            ->map(fn (Attribute $attribute) => $this->customFields->withProductTypes($attribute));

        return CustomFieldResource::collection($attributes);
    }

    public function store(StoreCustomFieldRequest $request)
    {
        return (new CustomFieldResource($this->customFields->create($request->validated())))
            ->response()
            ->setStatusCode(Response::HTTP_CREATED);
    }

    public function show(Attribute $attribute): CustomFieldResource
    {
        $this->ensureManageable($attribute);

        return new CustomFieldResource($this->customFields->withProductTypes($attribute));
    }

    public function update(UpdateCustomFieldRequest $request, Attribute $attribute): CustomFieldResource
    {
        $this->ensureManageable($attribute);

        return new CustomFieldResource($this->customFields->update($attribute, $request->validated()));
    }

    public function destroy(Attribute $attribute): Response
    {
        $this->ensureManageable($attribute);
        $this->customFields->delete($attribute);

        return response()->noContent();
    }

    private function ensureManageable(Attribute $attribute): void
    {
        abort_unless(
            $this->customFields->manageableQuery()->whereKey($attribute->id)->exists(),
            Response::HTTP_NOT_FOUND
        );
    }
}
