<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\BlogTag;

class BlogTagController extends Controller
{
    public function index()
    {
        return response()->json(BlogTag::orderBy('name')->get());
    }
}
