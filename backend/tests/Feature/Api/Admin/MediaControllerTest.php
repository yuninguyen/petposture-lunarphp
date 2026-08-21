<?php

namespace Tests\Feature\Api\Admin;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class MediaControllerTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Role::firstOrCreate(['name' => 'admin', 'guard_name' => 'web']);
        Role::firstOrCreate(['name' => 'customer', 'guard_name' => 'web']);
        Storage::fake('public');
    }

    public function test_unauthenticated_request_is_rejected(): void
    {
        $this->getJson('/api/admin/media')->assertUnauthorized();
    }

    public function test_customer_role_cannot_upload_media(): void
    {
        $user = User::factory()->create();
        $user->assignRole('customer');
        Sanctum::actingAs($user);

        $file = UploadedFile::fake()->image('photo.jpg', 400, 300);

        $this->postJson('/api/admin/media', ['file' => $file])->assertForbidden();
    }

    public function test_admin_can_upload_an_image_and_get_back_a_url(): void
    {
        $user = User::factory()->create();
        $user->assignRole('admin');
        Sanctum::actingAs($user);

        $file = UploadedFile::fake()->image('photo.jpg', 400, 300);

        $response = $this->postJson('/api/admin/media', ['file' => $file])
            ->assertCreated()
            ->assertJsonStructure(['data' => ['id', 'url', 'thumbnail_url', 'name', 'width', 'height']]);

        $this->assertSame(400, $response->json('data.width'));
        $this->assertDatabaseCount('curator_media', 1);
    }

    public function test_uploading_a_jpeg_is_converted_to_webp(): void
    {
        $user = User::factory()->create();
        $user->assignRole('admin');
        Sanctum::actingAs($user);

        $image = imagecreatetruecolor(400, 300);
        imagefill($image, 0, 0, imagecolorallocate($image, 100, 150, 200));
        ob_start();
        imagejpeg($image, null, 90);
        $contents = ob_get_clean();
        imagedestroy($image);

        $file = \Illuminate\Http\UploadedFile::fake()->createWithContent('photo.jpg', $contents);

        $response = $this->postJson('/api/admin/media', ['file' => $file])->assertCreated();

        $this->assertStringEndsWith('.webp', $response->json('data.url'));
    }

    public function test_uploading_an_animated_gif_is_preserved_as_gif(): void
    {
        $user = User::factory()->create();
        $user->assignRole('admin');
        Sanctum::actingAs($user);

        $image = imagecreatetruecolor(400, 300);
        imagefill($image, 0, 0, imagecolorallocate($image, 200, 100, 50));
        ob_start();
        imagegif($image);
        $contents = ob_get_clean();
        imagedestroy($image);

        $marker = "\x00\x21\xF9\x04";
        $contents .= $marker.str_repeat("\x00", 4).$marker.str_repeat("\x00", 4);

        $file = \Illuminate\Http\UploadedFile::fake()->createWithContent('animated.gif', $contents);

        $response = $this->postJson('/api/admin/media', ['file' => $file])->assertCreated();

        $this->assertStringEndsWith('.gif', $response->json('data.url'));
    }

    public function test_admin_can_list_media(): void
    {
        $user = User::factory()->create();
        $user->assignRole('admin');
        Sanctum::actingAs($user);

        $file = UploadedFile::fake()->image('photo.jpg');
        $this->postJson('/api/admin/media', ['file' => $file])->assertCreated();

        $this->getJson('/api/admin/media')
            ->assertOk()
            ->assertJsonCount(1, 'data');
    }
}
