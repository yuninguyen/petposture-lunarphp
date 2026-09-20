<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SessionController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        return response()->json([
            'data' => [
                'abilities' => $request->user()->getAllPermissions()->pluck('name')->values()->all(),
            ],
        ]);
    }
}
