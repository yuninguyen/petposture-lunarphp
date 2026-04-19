<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Review;
use App\Models\Product;
use Illuminate\Http\Request;

class ReviewController extends Controller
{
    public function index(Product $product)
    {
        return response()->json([
            'data' => $product->reviews()->orderBy('created_at', 'desc')->get()
        ]);
    }

    public function store(Request $request, Product $product)
    {
        $validated = $request->validate([
            'customer_name' => 'required|string|max:255',
            'rating' => 'required|integer|min:1|max:5',
            'comment' => 'required|string',
        ]);

        $review = $product->reviews()->create($validated);

        return response()->json([
            'message' => 'Review submitted successfully',
            'data' => $review
        ], 201);
    }
}
