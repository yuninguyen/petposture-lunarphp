<?php

namespace App\Support;

use Closure;
use Filament\Forms\Components\BaseFileUpload;
use Livewire\Features\SupportFileUploads\TemporaryUploadedFile;

/**
 * Downscales oversized uploads (e.g. a multi-megabyte, multi-thousand-pixel
 * photo straight from a phone/camera) and re-encodes them as WebP, which is
 * meaningfully smaller than PNG/JPEG at equivalent visual quality. Aspect
 * ratio is preserved and images already within bounds are not upscaled.
 *
 * Animated GIFs are the one exception: GD's imagewebp() only captures a
 * single frame, so converting one would silently drop the animation. Those
 * are downscaled (if oversized) but kept as GIF.
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

            $isAnimatedGif = $mime === 'image/gif' && self::isAnimatedGif($file->getRealPath());
            $withinBounds = $width <= $maxWidth && $height <= $maxHeight;

            // Animated GIF within bounds: nothing to do (no resize needed,
            // and we deliberately don't touch its format).
            if ($isAnimatedGif && $withinBounds) {
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

            // Clamp to 1.0 so images already within bounds aren't upscaled;
            // they still pass through the canvas below to be re-encoded.
            $ratio = min($maxWidth / $width, $maxHeight / $height, 1.0);
            $newWidth = max(1, (int) round($width * $ratio));
            $newHeight = max(1, (int) round($height * $ratio));

            $canvas = imagecreatetruecolor($newWidth, $newHeight);
            imagealphablending($canvas, false);
            imagesavealpha($canvas, true);
            imagecopyresampled($canvas, $source, 0, 0, 0, 0, $newWidth, $newHeight, $width, $height);
            imagedestroy($source);

            if ($isAnimatedGif) {
                $tmpPath = tempnam(sys_get_temp_dir(), 'resize_').'.gif';
                $saved = imagegif($canvas, $tmpPath);
                imagedestroy($canvas);

                if (! $saved) {
                    @unlink($tmpPath);

                    return $storeOriginal();
                }

                $path = trim($directory.'/'.$filename, '/');
                $component->getDisk()->put($path, file_get_contents($tmpPath), $component->getVisibility());

                @unlink($tmpPath);

                return $path;
            }

            $tmpPath = tempnam(sys_get_temp_dir(), 'webp_').'.webp';
            $saved = imagewebp($canvas, $tmpPath, 85);
            imagedestroy($canvas);

            if (! $saved) {
                @unlink($tmpPath);

                return $storeOriginal();
            }

            $webpFilename = preg_replace('/\.[^.]+$/', '', $filename).'.webp';
            $path = trim($directory.'/'.$webpFilename, '/');
            $component->getDisk()->put($path, file_get_contents($tmpPath), $component->getVisibility());

            @unlink($tmpPath);

            return $path;
        };
    }

    private static function isAnimatedGif(string $path): bool
    {
        $raw = file_get_contents($path);

        if ($raw === false) {
            return false;
        }

        return substr_count($raw, "\x00\x21\xF9\x04") > 1;
    }
}
