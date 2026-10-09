<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\Api\CuratorMediaResource;
use App\Models\CuratorMedia;
use App\Support\ImageOptimizer;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class MediaController extends Controller
{
    public function index(Request $request)
    {
        $validated = $request->validate([
            'folder' => ['nullable', Rule::in([...CuratorMedia::FOLDERS, 'all'])],
        ]);
        $folder = $validated['folder'] ?? null;
        $media = CuratorMedia::query()
            ->when($folder && $folder !== 'all', fn ($query) => $query->where('folder', $folder))
            ->latest()
            ->limit(100)
            ->get();

        return CuratorMediaResource::collection($media);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'file' => ['required', 'image', 'max:10240'],
            'folder' => ['sometimes', Rule::in(CuratorMedia::FOLDERS)],
            'remove_background' => ['sometimes', 'boolean'],
        ]);

        $file = $validated['file'];
        $folder = $validated['folder'] ?? CuratorMedia::FOLDER_GENERAL;
        $removeBackground = ($validated['remove_background'] ?? false) && $folder === CuratorMedia::FOLDER_PRODUCT;
        $disk = config('curator.disk');
        $directory = config('curator.directory');

        $processedImage = null;
        if ($removeBackground) {
            try {
                $response = Http::connectTimeout(5)
                    ->timeout(180)
                    ->attach('file', file_get_contents($file->getRealPath()), $file->getClientOriginalName())
                    ->post(rtrim(config('services.background_removal.url'), '/').'/remove');
            } catch (ConnectionException) {
                return response()->json([
                    'message' => 'Background removal is temporarily unavailable. The original image was not changed; try again or upload without background removal.',
                ], 503);
            }

            if (! $response->successful() || ! str_starts_with((string) $response->header('Content-Type'), 'image/png')) {
                return response()->json([
                    'message' => 'Background removal failed. The original image was not changed; try again or upload without background removal.',
                ], 502);
            }

            $processedImage = $response->body();
        }

        $path = $file->store($directory, $disk);
        $path = ImageOptimizer::optimize($disk, $path);
        [$width, $height] = getimagesize(Storage::disk($disk)->path($path)) ?: [null, null];

        $media = CuratorMedia::create([
            'disk' => $disk,
            'directory' => $directory,
            'visibility' => 'public',
            'name' => $file->getClientOriginalName(),
            'path' => $path,
            'width' => $width,
            'height' => $height,
            'size' => $file->getSize(),
            'type' => 'image',
            'ext' => pathinfo($path, PATHINFO_EXTENSION),
            'folder' => $folder,
        ]);

        $result = ['data' => (new CuratorMediaResource($media))->resolve()];

        if ($processedImage !== null) {
            $processedName = pathinfo($file->getClientOriginalName(), PATHINFO_FILENAME).'-no-background.webp';
            $processedPath = trim($directory, '/').'/'.Str::uuid().'-no-background.png';
            Storage::disk($disk)->put($processedPath, $processedImage);
            $processedPath = ImageOptimizer::optimize($disk, $processedPath);
            [$processedWidth, $processedHeight] = getimagesize(Storage::disk($disk)->path($processedPath)) ?: [null, null];
            $processedMedia = CuratorMedia::create([
                'disk' => $disk,
                'directory' => $directory,
                'visibility' => 'public',
                'name' => $processedName,
                'path' => $processedPath,
                'width' => $processedWidth,
                'height' => $processedHeight,
                'size' => Storage::disk($disk)->size($processedPath),
                'type' => 'image',
                'ext' => pathinfo($processedPath, PATHINFO_EXTENSION),
                'folder' => $folder,
            ]);

            $result['processed'] = (new CuratorMediaResource($processedMedia))->resolve();
        }

        return response()->json($result, 201);
    }

    public function update(Request $request, CuratorMedia $media): CuratorMediaResource
    {
        $validated = $request->validate([
            'folder' => ['required', Rule::in(CuratorMedia::FOLDERS)],
        ]);

        $media->update(['folder' => $validated['folder']]);

        return new CuratorMediaResource($media->refresh());
    }
}
