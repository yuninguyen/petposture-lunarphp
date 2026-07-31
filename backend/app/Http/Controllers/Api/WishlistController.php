<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\Api\ProductResource;
use App\Services\WishlistService;
use Illuminate\Http\Request;

class WishlistController extends Controller
{
    public function __construct(private readonly WishlistService $wishlist) {}

    public function index(Request $request)
    {
        return response()->json([
            'data' => ProductResource::collection($this->wishlist->list($request->user())),
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'product_id' => 'required|integer',
        ]);

        $this->wishlist->add($request->user(), (int) $validated['product_id']);

        return response()->json([
            'data' => ProductResource::collection($this->wishlist->list($request->user())),
        ], 201);
    }

    public function destroy(Request $request, int $productId)
    {
        $this->wishlist->remove($request->user(), $productId);

        return response()->json(null, 204);
    }
}
