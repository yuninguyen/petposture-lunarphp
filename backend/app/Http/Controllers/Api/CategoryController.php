<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Http\Resources\CategoryResource;

class CategoryController extends Controller
{
    public function index()
    {
        return CategoryResource::collection(Category::withCount('products')->get());
    }

    public function show(Category $category)
    {
        return new CategoryResource($category->loadCount('products'));
    }
}
