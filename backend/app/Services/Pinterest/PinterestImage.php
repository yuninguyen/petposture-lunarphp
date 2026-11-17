<?php

namespace App\Services\Pinterest;

use RuntimeException;

/**
 * Pinterest takes JPEG and PNG only (its own upload page says "JPG, PNG up to 20MB"), while the media library stores
 * uploads as WebP. This turns an image into something Pinterest accepts, for the API and for the Download button.
 */
final class PinterestImage
{
    /**
     * @return array{0: string, 1: string, 2: string} the bytes, the mime type and the file extension to use
     *
     * @throws RuntimeException when the image cannot be read or converted
     */
    public static function forPinterest(string $bytes, string $extension): array
    {
        $extension = strtolower($extension);

        if ($extension === 'png') {
            return [$bytes, 'image/png', 'png'];
        }

        if (in_array($extension, ['jpg', 'jpeg'], true)) {
            return [$bytes, 'image/jpeg', 'jpg'];
        }

        $image = function_exists('imagecreatefromstring') ? @imagecreatefromstring($bytes) : false;

        if ($image === false) {
            throw new RuntimeException('The image could not be converted to JPEG for Pinterest.');
        }

        ob_start();
        imagejpeg($image, null, 92);

        return [(string) ob_get_clean(), 'image/jpeg', 'jpg'];
    }
}
