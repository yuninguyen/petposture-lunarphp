<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\Api\CuratorMediaResource;
use App\Models\CuratorMedia;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class MediaController extends Controller
{
    public function index()
    {
        $media = CuratorMedia::latest()->limit(100)->get();

        return CuratorMediaResource::collection($media);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'file' => 'required|image|max:10240',
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
            'ext' => $file->getClientOriginalExtension(),
        ]);

        return (new CuratorMediaResource($media))
            ->response()
            ->setStatusCode(201);
    }
}
