<?php

namespace App\Support;

use Illuminate\Support\Facades\Storage;

class ImageOptimizer
{
    /**
     * Resize an already-stored image to fit within max dimensions and
     * convert it to WebP, unless it's an animated GIF (which is resized
     * in place but kept as GIF to preserve animation). Returns the
     * relative path of the resulting file on the same disk.
     */
    public static function optimize(string $disk, string $path, int $maxWidth = 1920, int $maxHeight = 1920): string
    {
        $storage = Storage::disk($disk);
        $fullPath = $storage->path($path);

        [$width, $height, $imageType] = getimagesize($fullPath);
        $withinBounds = $width <= $maxWidth && $height <= $maxHeight;

        $isAnimatedGif = $imageType === IMAGETYPE_GIF && self::isAnimatedGif(file_get_contents($fullPath));

        if ($isAnimatedGif && $withinBounds) {
            return $path;
        }

        $source = match ($imageType) {
            IMAGETYPE_JPEG => imagecreatefromjpeg($fullPath),
            IMAGETYPE_PNG => imagecreatefrompng($fullPath),
            IMAGETYPE_GIF => imagecreatefromgif($fullPath),
            IMAGETYPE_WEBP => imagecreatefromwebp($fullPath),
            default => imagecreatefromstring(file_get_contents($fullPath)),
        };

        if ($withinBounds) {
            $targetWidth = $width;
            $targetHeight = $height;
        } else {
            $ratio = min($maxWidth / $width, $maxHeight / $height);
            $targetWidth = (int) round($width * $ratio);
            $targetHeight = (int) round($height * $ratio);
        }

        $resized = imagecreatetruecolor($targetWidth, $targetHeight);

        if ($imageType === IMAGETYPE_PNG || $imageType === IMAGETYPE_GIF) {
            imagecolortransparent($resized, imagecolorallocatealpha($resized, 0, 0, 0, 127));
            imagealphablending($resized, false);
            imagesavealpha($resized, true);
        }

        imagecopyresampled($resized, $source, 0, 0, 0, 0, $targetWidth, $targetHeight, $width, $height);
        imagedestroy($source);

        $pathInfo = pathinfo($path);
        $baseName = $pathInfo['filename'];
        $directory = $pathInfo['dirname'] === '.' ? '' : $pathInfo['dirname'].'/';

        if ($isAnimatedGif) {
            $newPath = $directory.$baseName.'.gif';
            ob_start();
            imagegif($resized);
            $contents = ob_get_clean();
        } else {
            $newPath = $directory.$baseName.'.webp';
            ob_start();
            imagewebp($resized, null, 85);
            $contents = ob_get_clean();
        }

        imagedestroy($resized);

        $storage->put($newPath, $contents);

        if ($newPath !== $path) {
            $storage->delete($path);
        }

        return $newPath;
    }

    protected static function isAnimatedGif(string $raw): bool
    {
        return substr_count($raw, "\x00\x21\xF9\x04") > 1;
    }
}
