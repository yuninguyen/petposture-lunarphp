<?php

namespace App\Http\Controllers\Api\Admin;

use App\Enums\ErrorCode;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreBrandRequest;
use App\Http\Requests\Admin\UpdateBrandRequest;
use App\Http\Resources\Admin\BrandResource;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Lunar\Models\Brand;

class BrandController extends Controller
{
    public function index(): AnonymousResourceCollection
    {
        return BrandResource::collection(
            Brand::query()->withCount('products')->orderBy('name')->get()
        );
    }

    public function store(StoreBrandRequest $request)
    {
        $brand = Brand::query()->create([
            'name' => $request->validated('name'),
        ]);

        Cache::forget('brands:index');

        return (new BrandResource($brand->loadCount('products')))
            ->response()
            ->setStatusCode(Response::HTTP_CREATED);
    }

    public function show(Brand $brand): BrandResource
    {
        return new BrandResource($brand->loadCount('products'));
    }

    public function update(UpdateBrandRequest $request, Brand $brand): BrandResource
    {
        $brand->update([
            'name' => $request->validated('name'),
        ]);

        Cache::forget('brands:index');

        return new BrandResource($brand->refresh()->loadCount('products'));
    }

    public function destroy(Brand $brand): Response|JsonResponse
    {
        try {
            $productsCount = DB::transaction(function () use ($brand): int {
                $lockedBrand = Brand::query()->lockForUpdate()->findOrFail($brand->id);
                $count = $lockedBrand->products()->withTrashed()->count();

                if ($count === 0) {
                    $lockedBrand->delete();
                }

                return $count;
            });
        } catch (QueryException $exception) {
            $productsCount = $brand->products()->withTrashed()->count();

            if ($productsCount === 0) {
                throw $exception;
            }

            return $this->brandInUse($brand, $productsCount);
        }

        if ($productsCount > 0) {
            return $this->brandInUse($brand, $productsCount);
        }

        Cache::forget('brands:index');

        return response()->noContent();
    }

    private function brandInUse(Brand $brand, int $productsCount): JsonResponse
    {
        return response()->json([
            'code' => ErrorCode::BRAND_IN_USE->value,
            'message' => 'This brand cannot be deleted because it is used by products.',
            'details' => [
                'brand_id' => $brand->id,
                'products_count' => $productsCount,
            ],
        ], Response::HTTP_CONFLICT);
    }
}
