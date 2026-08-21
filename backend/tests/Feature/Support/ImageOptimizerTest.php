<?php

namespace Tests\Feature\Support;

use App\Support\ImageOptimizer;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class ImageOptimizerTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('public');
    }

    protected function putJpegFixture(string $path, int $width, int $height): void
    {
        $image = imagecreatetruecolor($width, $height);
        imagefill($image, 0, 0, imagecolorallocate($image, 100, 150, 200));
        ob_start();
        imagejpeg($image, null, 90);
        $contents = ob_get_clean();
        imagedestroy($image);

        Storage::disk('public')->put($path, $contents);
    }

    protected function putGifFixture(string $path, int $width, int $height, bool $animated): void
    {
        $image = imagecreatetruecolor($width, $height);
        imagefill($image, 0, 0, imagecolorallocate($image, 200, 100, 50));
        ob_start();
        imagegif($image);
        $contents = ob_get_clean();
        imagedestroy($image);

        if ($animated) {
            // ImageOptimizer's animated-GIF branch only needs >=2 occurrences of
            // this 4-byte Graphic Control Extension marker anywhere in the file
            // (getimagesize() only reads the leading Logical Screen Descriptor,
            // and GD's decoder stops at the GIF trailer 0x3B, so appended bytes
            // are safely ignored by both).
            $marker = "\x00\x21\xF9\x04";
            $contents .= $marker.str_repeat("\x00", 4).$marker.str_repeat("\x00", 4);
        }

        Storage::disk('public')->put($path, $contents);
    }

    public function test_undersized_jpeg_is_converted_to_webp_without_resizing(): void
    {
        $this->putJpegFixture('uploads/small.jpg', 400, 300);

        $resultPath = ImageOptimizer::optimize('public', 'uploads/small.jpg');

        $this->assertStringEndsWith('.webp', $resultPath);
        $this->assertTrue(Storage::disk('public')->exists($resultPath));
        [$width, $height] = getimagesize(Storage::disk('public')->path($resultPath));
        $this->assertSame(400, $width);
        $this->assertSame(300, $height);
    }

    public function test_oversized_jpeg_is_resized_and_converted_to_webp(): void
    {
        $this->putJpegFixture('uploads/big.jpg', 3000, 2000);

        $resultPath = ImageOptimizer::optimize('public', 'uploads/big.jpg', 1920, 1920);

        $this->assertStringEndsWith('.webp', $resultPath);
        [$width, $height] = getimagesize(Storage::disk('public')->path($resultPath));
        $this->assertLessThanOrEqual(1920, $width);
        $this->assertLessThanOrEqual(1920, $height);
    }

    public function test_uploading_an_animated_gif_is_preserved_as_gif(): void
    {
        $this->putGifFixture('uploads/anim.gif', 400, 300, animated: true);

        $resultPath = ImageOptimizer::optimize('public', 'uploads/anim.gif');

        $this->assertStringEndsWith('.gif', $resultPath);
        $this->assertSame('uploads/anim.gif', $resultPath);
    }

    public function test_oversized_animated_gif_is_resized_but_stays_gif(): void
    {
        $this->putGifFixture('uploads/anim-big.gif', 3000, 2000, animated: true);

        $resultPath = ImageOptimizer::optimize('public', 'uploads/anim-big.gif', 1920, 1920);

        $this->assertStringEndsWith('.gif', $resultPath);
        [$width, $height] = getimagesize(Storage::disk('public')->path($resultPath));
        $this->assertLessThanOrEqual(1920, $width);
        $this->assertLessThanOrEqual(1920, $height);
    }

    public function test_static_gif_is_converted_to_webp(): void
    {
        $this->putGifFixture('uploads/static.gif', 400, 300, animated: false);

        $resultPath = ImageOptimizer::optimize('public', 'uploads/static.gif');

        $this->assertStringEndsWith('.webp', $resultPath);
    }
}
