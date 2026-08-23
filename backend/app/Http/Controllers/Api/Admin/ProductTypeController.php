<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreProductTypeRequest;
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
}
