<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreProductTypeRequest;
use App\Http\Requests\Admin\UpdateProductTypeRequest;
use App\Http\Resources\Admin\ProductTypeResource;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Lunar\Models\ProductType;
use Symfony\Component\HttpFoundation\Response;

class ProductTypeController extends Controller
{
    public function index(): AnonymousResourceCollection
    {
        $productTypes = ProductType::query()
            ->withCount('products')
            ->orderBy('name')
            ->get();

        return ProductTypeResource::collection($productTypes);
    }

    public function store(StoreProductTypeRequest $request)
    {
        $productType = ProductType::create($request->validated());
        $productType->loadCount('products');

        return (new ProductTypeResource($productType))
            ->response()
            ->setStatusCode(Response::HTTP_CREATED);
    }

    public function show(ProductType $productType): ProductTypeResource
    {
        return new ProductTypeResource($productType->loadCount('products'));
    }

    public function update(UpdateProductTypeRequest $request, ProductType $productType): ProductTypeResource
    {
        $productType->update($request->validated());

        return new ProductTypeResource($productType->refresh()->loadCount('products'));
    }

    public function destroy(ProductType $productType)
    {
        $productsCount = $productType->products()->count();

        if ($productsCount > 0) {
            return response()->json([
                'code' => 'PRODUCT_TYPE_IN_USE',
                'message' => 'This product type cannot be deleted because it is used by products.',
                'details' => [
                    'product_type_id' => $productType->id,
                    'products_count' => $productsCount,
                ],
            ], Response::HTTP_CONFLICT);
        }

        $productType->delete();

        return response()->noContent();
    }
}
