<?php

namespace App\Support;

use Closure;
use Filament\Forms\Components\BaseFileUpload;
use Livewire\Features\SupportFileUploads\TemporaryUploadedFile;

/**
 * Guards against admins accidentally uploading oversized images (e.g. a
 * multi-megabyte, multi-thousand-pixel photo straight from a phone/camera)
 * by downscaling anything larger than the given bounds before it's stored.
 * Aspect ratio is preserved and images already within bounds are left
 * untouched (no upscaling, no re-compression).
 */
class ImageUploadResizer
{
    private const RESIZABLE_MIME_TYPES = [
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
    ];

    public static function make(int $maxWidth = 1920, int $maxHeight = 1920): Closure
    {
        return static function (BaseFileUpload $component, TemporaryUploadedFile $file) use ($maxWidth, $maxHeight): ?string {
            $filename = $component->getUploadedFileNameForStorage($file);
            $directory = $component->getDirectory();
            $disk = $component->getDiskName();
            $storeMethod = $component->getVisibility() === 'public' ? 'storePubliclyAs' : 'storeAs';

            $storeOriginal = fn (): ?string => $file->{$storeMethod}($directory, $filename, $disk);

            $mime = $file->getMimeType();

            if (! in_array($mime, self::RESIZABLE_MIME_TYPES, true)) {
                return $storeOriginal();
            }

            $dimensions = @getimagesize($file->getRealPath());

            if (! $dimensions) {
                return $storeOriginal();
            }

            [$width, $height] = $dimensions;

            if ($width <= $maxWidth && $height <= $maxHeight) {
                return $storeOriginal();
            }

            $source = match ($mime) {
                'image/jpeg' => @imagecreatefromjpeg($file->getRealPath()),
                'image/png' => @imagecreatefrompng($file->getRealPath()),
                'image/gif' => @imagecreatefromgif($file->getRealPath()),
                'image/webp' => @imagecreatefromwebp($file->getRealPath()),
            };

            if (! $source) {
                return $storeOriginal();
            }

            $ratio = min($maxWidth / $width, $maxHeight / $height);
            $newWidth = max(1, (int) round($width * $ratio));
            $newHeight = max(1, (int) round($height * $ratio));

            $resized = imagecreatetruecolor($newWidth, $newHeight);

            if (in_array($mime, ['image/png', 'image/gif', 'image/webp'], true)) {
                imagealphablending($resized, false);
                imagesavealpha($resized, true);
            }

            imagecopyresampled($resized, $source, 0, 0, 0, 0, $newWidth, $newHeight, $width, $height);

            $tmpPath = tempnam(sys_get_temp_dir(), 'resize_') . '.' . pathinfo($filename, PATHINFO_EXTENSION);

            $saved = match ($mime) {
                'image/jpeg' => imagejpeg($resized, $tmpPath, 85),
                'image/png' => imagepng($resized, $tmpPath, 6),
                'image/gif' => imagegif($resized, $tmpPath),
                'image/webp' => imagewebp($resized, $tmpPath, 85),
            };

            imagedestroy($source);
            imagedestroy($resized);

            if (! $saved) {
                @unlink($tmpPath);

                return $storeOriginal();
            }

            $path = trim($directory . '/' . $filename, '/');
            $component->getDisk()->put($path, file_get_contents($tmpPath), $component->getVisibility());

            @unlink($tmpPath);

            return $path;
        };
    }
}
