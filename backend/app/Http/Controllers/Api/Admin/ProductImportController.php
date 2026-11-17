<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Services\Admin\PickImportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Validation\ValidationException;
use RuntimeException;

class ProductImportController extends Controller
{
    public function __construct(private readonly PickImportService $service) {}

    /** What an import of this file would do. Nothing is written. */
    public function preview(Request $request): JsonResponse
    {
        $file = $this->file($request);

        try {
            return response()->json(['data' => $this->service->preview($file)]);
        } catch (RuntimeException $e) {
            throw ValidationException::withMessages(['file' => $e->getMessage()]);
        }
    }

    /** Creates the clean rows of the file; existing products are never changed. */
    public function store(Request $request): JsonResponse
    {
        $file = $this->file($request);

        try {
            return response()->json(['data' => $this->service->import($file, $request->user())], 201);
        } catch (RuntimeException $e) {
            throw ValidationException::withMessages(['file' => $e->getMessage()]);
        }
    }

    private function file(Request $request): UploadedFile
    {
        // Importing writes many products at once, so it is kept to the core roles, not every role that can add one.
        abort_unless($request->user()?->hasAnyRole(['super_admin', 'admin', 'staff']), 403);

        $request->validate([
            'file' => ['required', 'file', 'max:2048', 'extensions:xlsx,csv'],
        ]);

        return $request->file('file');
    }
}
