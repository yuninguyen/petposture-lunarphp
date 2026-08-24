<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\UpdateProductVariantRequest;
use App\Http\Resources\Admin\ProductVariantResource;
use App\Services\Admin\ProductAttributeService;
use App\Services\Admin\ProductVariantMatrixService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Lunar\Models\Currency;
use Lunar\Models\Product;
use Lunar\Models\ProductVariant;

class ProductVariantController extends Controller
{
    public function __construct(
        private readonly ProductAttributeService $attributeService,
        private readonly ProductVariantMatrixService $matrixService
    ) {
    }

    public function update(
        UpdateProductVariantRequest $request,
        Product $product,
        ProductVariant $variant
    ): ProductVariantResource {
        $validated = $request->validated();

        $updated = DB::transaction(function () use ($validated, $product, $variant): ProductVariant {
            $locked = $product->variants()->lockForUpdate()->findOrFail($variant->id);
            $product->load('productType');

            $locked->fill(collect($validated)->only([
                'sku', 'gtin', 'mpn', 'ean', 'stock', 'backorder', 'purchasable',
                'unit_quantity', 'quantity_increment', 'min_quantity', 'tax_class_id',
                'tax_ref', 'shippable', 'length_value', 'length_unit', 'width_value',
                'width_unit', 'height_value', 'height_unit', 'weight_value', 'weight_unit',
            ])->all());
            $locked->attribute_data = $this->attributeService->apply(
                $product->productType,
                'variant',
                $locked->attribute_data ?? collect(),
                $validated['attributes']
            );
            $locked->save();

            $currency = Currency::getDefault();
            if (! $currency) {
                throw ValidationException::withMessages([
                    'base_price' => 'A default currency must be configured before updating variant pricing.',
                ]);
            }

            $locked->prices()->updateOrCreate([
                'currency_id' => $currency->id,
                'customer_group_id' => null,
                'min_quantity' => 1,
            ], [
                'price' => (int) bcmul((string) $validated['base_price'], (string) $currency->factor, 0),
            ]);

            return $locked;
        });

        return new ProductVariantResource($updated->load([
            'product.productType',
            'prices.currency',
            'values' => fn ($query) => $query->orderBy('product_option_id')->orderBy('position')->orderBy('id'),
            'values.option',
        ]));
    }

    public function generate(Product $product): JsonResponse
    {
        $variants = $this->matrixService->generate($product);
        $variants->load([
            'product.productType',
            'prices.currency',
            'values' => fn ($query) => $query->orderBy('product_option_id')->orderBy('position')->orderBy('id'),
            'values.option',
        ]);

        return response()->json([
            'data' => ProductVariantResource::collection($variants)->resolve(),
        ]);
    }

    public function destroy(Product $product, ProductVariant $variant): Response
    {
        DB::transaction(function () use ($product, $variant): void {
            $variants = $product->variants()->lockForUpdate()->orderBy('id')->get();
            $target = $variants->firstWhere('id', $variant->id);

            if (! $target) {
                abort(Response::HTTP_NOT_FOUND);
            }

            if ($variants->count() <= 1) {
                throw ValidationException::withMessages([
                    'variant' => 'A product must keep at least one variant.',
                ]);
            }

            $target->delete();
        });

        return response()->noContent();
    }
}
