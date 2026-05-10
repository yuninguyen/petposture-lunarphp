<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\CartService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class CartController extends Controller
{
    public function __construct(private readonly CartService $cartService) {}

    /** GET /api/cart — get or create cart */
    public function show(Request $request): JsonResponse
    {
        $cart = $this->cartService->resolveCart(
            $request->header('X-Cart-Token'),
            auth('sanctum')->id(),
        );

        return response()->json($this->cartService->toArray($cart));
    }

    /** POST /api/cart/lines — add variant */
    public function addLine(Request $request): JsonResponse
    {
        $validated = Validator::make($request->all(), [
            'variantId' => 'required|exists:lunar_product_variants,id',
            'quantity'  => 'required|integer|min:1',
        ])->validate();

        $cart = $this->cartService->resolveCart(
            $request->header('X-Cart-Token'),
            auth('sanctum')->id(),
        );

        $cart = $this->cartService->addLine($cart, $validated['variantId'], $validated['quantity']);

        return response()->json($this->cartService->toArray($cart), 201);
    }

    /** PUT /api/cart/lines/{lineId} — update quantity */
    public function updateLine(Request $request, int $lineId): JsonResponse
    {
        $validated = Validator::make($request->all(), [
            'quantity' => 'required|integer|min:0',
        ])->validate();

        $cart = $this->cartService->resolveCart(
            $request->header('X-Cart-Token'),
            auth('sanctum')->id(),
        );

        $cart = $this->cartService->updateLine($cart, $lineId, $validated['quantity']);

        return response()->json($this->cartService->toArray($cart));
    }

    /** DELETE /api/cart/lines/{lineId} — remove one line */
    public function removeLine(Request $request, int $lineId): JsonResponse
    {
        $cart = $this->cartService->resolveCart(
            $request->header('X-Cart-Token'),
            auth('sanctum')->id(),
        );

        $cart = $this->cartService->removeLine($cart, $lineId);

        return response()->json($this->cartService->toArray($cart));
    }

    /** DELETE /api/cart — clear all lines */
    public function clear(Request $request): JsonResponse
    {
        $cart = $this->cartService->resolveCart(
            $request->header('X-Cart-Token'),
            auth('sanctum')->id(),
        );

        $this->cartService->clear($cart);

        return response()->json(['success' => true]);
    }
}
