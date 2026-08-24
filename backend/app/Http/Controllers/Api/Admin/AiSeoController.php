<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Services\AiSeoGeneratorService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AiSeoController extends Controller
{
    public function generate(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'content' => 'nullable|string',
            'content_type' => 'sometimes|in:blog,product',
        ]);

        try {
            $result = app(AiSeoGeneratorService::class)->generate(
                $validated['title'],
                $validated['content'] ?? null,
                $validated['content_type'] ?? 'blog'
            );
        } catch (\Throwable $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json($result);
    }
}
