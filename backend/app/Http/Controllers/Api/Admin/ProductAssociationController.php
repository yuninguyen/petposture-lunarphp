<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Lunar\Jobs\Products\Associations\Associate;
use Lunar\Jobs\Products\Associations\Dissociate;
use Lunar\Models\Product;
use Lunar\Models\ProductAssociation;

class ProductAssociationController extends Controller
{
    public function index(Product $product): JsonResponse
    {
        $associations = $product->associations()
            ->with(['target' => fn ($query) => $query->withTrashed()->with(['thumbnail', 'defaultUrl'])])
            ->orderBy('type')
            ->orderBy('id')
            ->get();

        return response()->json([
            'data' => $associations->map(fn (ProductAssociation $association): array => $this->resource($association))->all(),
        ]);
    }

    public function store(Request $request, Product $product): JsonResponse
    {
        $validated = $request->validate([
            'target_product_id' => [
                'required',
                'integer',
                Rule::exists('lunar_products', 'id')->whereNull('deleted_at'),
            ],
            'type' => ['required', Rule::in(array_keys(ProductAssociation::getTypes()))],
        ]);

        if ((int) $validated['target_product_id'] === (int) $product->id) {
            throw ValidationException::withMessages([
                'target_product_id' => 'A product cannot be associated with itself.',
            ]);
        }

        $association = DB::transaction(function () use ($product, $validated): ProductAssociation {
            $locked = Product::query()->lockForUpdate()->findOrFail($product->id);
            $target = Product::query()->findOrFail($validated['target_product_id']);

            if ($locked->associations()
                ->where('product_target_id', $target->id)
                ->where('type', $validated['type'])
                ->exists()) {
                throw ValidationException::withMessages([
                    'target_product_id' => 'This product association already exists.',
                ]);
            }

            Associate::dispatchSync($locked, $target, $validated['type']);

            return $locked->associations()
                ->where('product_target_id', $target->id)
                ->where('type', $validated['type'])
                ->with(['target' => fn ($query) => $query->withTrashed()->with(['thumbnail', 'defaultUrl'])])
                ->latest('id')
                ->firstOrFail();
        });

        return response()->json(['data' => $this->resource($association)], Response::HTTP_CREATED);
    }

    public function destroy(Product $product, ProductAssociation $association): Response
    {
        $owned = $product->associations()->find($association->id);
        if (! $owned) {
            abort(Response::HTTP_NOT_FOUND);
        }
        $target = Product::withTrashed()->findOrFail($owned->product_target_id);

        Dissociate::dispatchSync($product, $target, $owned->type);

        return response()->noContent();
    }

    private function resource(ProductAssociation $association): array
    {
        return [
            'id' => $association->id,
            'type' => $association->type,
            'target' => [
                'id' => $association->target->id,
                'name' => (string) ($association->target->translateAttribute('name') ?: 'Untitled product'),
                'status' => $association->target->status,
                'slug' => $association->target->defaultUrl?->slug,
                'thumbnail' => $association->target->thumbnail?->getUrl('small') ?: null,
            ],
        ];
    }
}
