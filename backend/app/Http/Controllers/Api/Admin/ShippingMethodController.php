<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\ShippingMethod;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Validator;
use Lunar\Models\Order;

class ShippingMethodController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json([
            'data' => ShippingMethod::query()
                ->orderBy('id')
                ->get()
                ->map(fn (ShippingMethod $shippingMethod): array => $this->resource($shippingMethod)),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $shippingMethod = ShippingMethod::query()->create($this->validatedStore($request));

        return response()->json([
            'data' => $this->resource($shippingMethod),
        ], Response::HTTP_CREATED);
    }

    public function show(ShippingMethod $shippingMethod): JsonResponse
    {
        return response()->json(['data' => $this->resource($shippingMethod)]);
    }

    public function update(Request $request, ShippingMethod $shippingMethod): JsonResponse
    {
        $shippingMethod->update($this->validatedUpdate($request));

        return response()->json(['data' => $this->resource($shippingMethod->refresh())]);
    }

    public function destroy(ShippingMethod $shippingMethod): Response|JsonResponse
    {
        $isUsedByNonterminalOrder = Order::query()
            ->where('meta->shipping_method', $shippingMethod->code)
            ->whereNotIn('status', ['delivered', 'cancelled'])
            ->exists();

        if ($isUsedByNonterminalOrder) {
            return response()->json([
                'message' => 'This shipping method cannot be deleted because it is used by a nonterminal order.',
                'data' => ['code' => $shippingMethod->code],
            ], Response::HTTP_CONFLICT);
        }

        $shippingMethod->delete();

        return response()->noContent();
    }

    private function validatedStore(Request $request): array
    {
        return $request->validate([
            'code' => ['required', 'string', 'max:255', 'alpha_dash', 'unique:shipping_methods,code'],
            'name' => ['required', 'string', 'max:255'],
            'eta' => ['nullable', 'string', 'max:255'],
            'price' => ['required', 'numeric', 'min:0'],
            'free_over' => ['nullable', 'numeric', 'min:0'],
        ]);
    }

    private function validatedUpdate(Request $request): array
    {
        $validator = Validator::make($request->all(), [
            'name' => ['required', 'string', 'max:255'],
            'eta' => ['nullable', 'string', 'max:255'],
            'price' => ['required', 'numeric', 'min:0'],
            'free_over' => ['nullable', 'numeric', 'min:0'],
        ]);

        $validator->after(function ($validator) use ($request): void {
            if ($request->has('code')) {
                $validator->errors()->add('code', 'The code field is prohibited.');
            }
        });

        return $validator->validate();
    }

    private function resource(ShippingMethod $shippingMethod): array
    {
        return [
            'id' => $shippingMethod->id,
            'code' => $shippingMethod->code,
            'name' => $shippingMethod->name,
            'eta' => $shippingMethod->eta,
            'price' => $shippingMethod->price,
            'free_over' => $shippingMethod->free_over,
            'created_at' => $shippingMethod->created_at,
            'updated_at' => $shippingMethod->updated_at,
        ];
    }
}
