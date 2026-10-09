<?php

namespace Tests\Feature\Api\Admin;

use App\Models\CuratorMedia;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request as HttpRequest;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
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
            ->assertJsonStructure(['data' => ['id', 'url', 'thumbnail_url', 'name', 'folder', 'width', 'height']])
            ->assertJsonPath('data.folder', CuratorMedia::FOLDER_GENERAL);

        $this->assertSame(400, $response->json('data.width'));
        $this->assertDatabaseHas('curator_media', ['folder' => CuratorMedia::FOLDER_GENERAL]);
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

        $file = UploadedFile::fake()->createWithContent('photo.jpg', $contents);

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

        $file = UploadedFile::fake()->createWithContent('animated.gif', $contents);

        $response = $this->postJson('/api/admin/media', ['file' => $file])->assertCreated();

        $this->assertStringEndsWith('.gif', $response->json('data.url'));
    }

    public function test_product_upload_can_save_and_return_a_transparent_webp_copy(): void
    {
        $user = User::factory()->create();
        $user->assignRole('admin');
        Sanctum::actingAs($user);

        $transparentPng = $this->transparentPng();
        Http::fake([
            '127.0.0.1:8002/remove' => Http::response($transparentPng, 200, ['Content-Type' => 'image/png']),
        ]);

        $response = $this->postJson('/api/admin/media', [
            'file' => UploadedFile::fake()->image('product.jpg', 40, 30),
            'folder' => CuratorMedia::FOLDER_PRODUCT,
            'remove_background' => true,
        ])->assertCreated()
            ->assertJsonPath('data.folder', CuratorMedia::FOLDER_PRODUCT)
            ->assertJsonPath('processed.folder', CuratorMedia::FOLDER_PRODUCT);

        $this->assertStringEndsWith('.webp', $response->json('processed.url'));
        $this->assertDatabaseCount('curator_media', 2);
        Http::assertSent(fn (HttpRequest $request) => $request->url() === 'http://127.0.0.1:8002/remove'
            && $request->hasFile('file'));

        $processed = CuratorMedia::findOrFail($response->json('processed.id'));
        $image = imagecreatefromwebp(Storage::disk('public')->path($processed->path));
        $this->assertNotFalse($image);
        $this->assertSame(127, (imagecolorat($image, 0, 0) >> 24) & 0x7F, 'Transparent pixels should remain transparent after WebP optimization.');
        imagedestroy($image);
    }

    public function test_background_removal_failure_does_not_store_or_select_an_unprocessed_image(): void
    {
        $user = User::factory()->create();
        $user->assignRole('admin');
        Sanctum::actingAs($user);

        Http::fake(['127.0.0.1:8002/remove' => Http::response(['detail' => 'failed'], 500)]);

        $this->postJson('/api/admin/media', [
            'file' => UploadedFile::fake()->image('product.jpg', 40, 30),
            'folder' => CuratorMedia::FOLDER_PRODUCT,
            'remove_background' => true,
        ])->assertStatus(502);

        $this->assertDatabaseCount('curator_media', 0);
        $this->assertSame([], Storage::disk('public')->allFiles('media'));
    }

    public function test_remove_background_option_is_ignored_outside_product_folder(): void
    {
        $user = User::factory()->create();
        $user->assignRole('admin');
        Sanctum::actingAs($user);

        Http::fake();

        $this->postJson('/api/admin/media', [
            'file' => UploadedFile::fake()->image('article.jpg', 40, 30),
            'folder' => CuratorMedia::FOLDER_BLOG,
            'remove_background' => true,
        ])->assertCreated()->assertJsonMissingPath('processed');

        Http::assertNothingSent();
        $this->assertDatabaseCount('curator_media', 1);
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

    public function test_media_can_be_uploaded_filtered_and_listed_by_folder_or_all(): void
    {
        $user = User::factory()->create();
        $user->assignRole('admin');
        Sanctum::actingAs($user);

        $this->postJson('/api/admin/media', [
            'file' => UploadedFile::fake()->image('blog.jpg'),
            'folder' => CuratorMedia::FOLDER_BLOG,
        ])->assertCreated()->assertJsonPath('data.folder', CuratorMedia::FOLDER_BLOG);
        $this->postJson('/api/admin/media', [
            'file' => UploadedFile::fake()->image('product.jpg'),
            'folder' => CuratorMedia::FOLDER_PRODUCT,
        ])->assertCreated()->assertJsonPath('data.folder', CuratorMedia::FOLDER_PRODUCT);

        $this->getJson('/api/admin/media?folder=blog')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.folder', CuratorMedia::FOLDER_BLOG);
        $this->getJson('/api/admin/media?folder=all')
            ->assertOk()
            ->assertJsonCount(2, 'data');
        $this->getJson('/api/admin/media')
            ->assertOk()
            ->assertJsonCount(2, 'data');
        $this->getJson('/api/admin/media?folder=unknown')
            ->assertUnprocessable()
            ->assertJsonValidationErrors('folder');
    }

    public function test_admin_can_patch_media_folder_and_invalid_folders_are_rejected(): void
    {
        $user = User::factory()->create();
        $user->assignRole('admin');
        Sanctum::actingAs($user);

        $id = $this->postJson('/api/admin/media', [
            'file' => UploadedFile::fake()->image('move.jpg'),
        ])->assertCreated()->json('data.id');

        $this->patchJson("/api/admin/media/{$id}", ['folder' => CuratorMedia::FOLDER_BREED])
            ->assertOk()
            ->assertJsonPath('data.folder', CuratorMedia::FOLDER_BREED);
        $this->assertDatabaseHas('curator_media', [
            'id' => $id,
            'folder' => CuratorMedia::FOLDER_BREED,
        ]);

        $this->patchJson("/api/admin/media/{$id}", ['folder' => 'all'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('folder');
    }

    private function transparentPng(): string
    {
        $image = imagecreatetruecolor(40, 30);
        imagealphablending($image, false);
        imagesavealpha($image, true);
        imagefill($image, 0, 0, imagecolorallocatealpha($image, 0, 0, 0, 127));
        imagefilledrectangle($image, 10, 5, 30, 25, imagecolorallocatealpha($image, 220, 80, 60, 0));
        ob_start();
        imagepng($image);
        $contents = ob_get_clean();
        imagedestroy($image);

        return $contents;
    }
}
