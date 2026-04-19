<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Http\Resources\ProductResource;
use Illuminate\Http\Request;

class ProductController extends Controller
{
    public function index()
    {
        return ProductResource::collection(Product::with('category')->get());
    }

    public function show(Product $product)
    {
        return new ProductResource($product->load('category'));
    }
}
