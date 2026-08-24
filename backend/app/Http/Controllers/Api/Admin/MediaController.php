<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\Api\CuratorMediaResource;
use App\Models\CuratorMedia;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
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
        ]);

        $file = $validated['file'];
        $disk = config('curator.disk');
        $directory = config('curator.directory');

        $path = $file->store($directory, $disk);
        $path = \App\Support\ImageOptimizer::optimize($disk, $path);
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
            'folder' => $validated['folder'] ?? CuratorMedia::FOLDER_GENERAL,
        ]);

        return (new CuratorMediaResource($media))
            ->response()
            ->setStatusCode(201);
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
