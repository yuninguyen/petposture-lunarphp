<?php

declare(strict_types=1);

namespace Tests\Feature\Api\Admin;

use App\Models\BlogCategory;
use App\Models\CuratorMedia;
use App\Models\PinterestPin;
use App\Models\Post;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PinterestPinControllerTest extends TestCase
{
    use RefreshDatabase;

    private const CORE_ROLES = ['super_admin', 'admin', 'staff'];

    private const BLOCKED_ROLES = ['Product Manager', 'Order Manager', 'Support', 'Content Writer'];

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
        Storage::fake('public');
        config(['app.frontend_url' => 'https://petposture.com']);
    }

    private function actingAsRole(string $role = 'admin'): User
    {
        $user = User::factory()->create();
        $user->assignRole($role);
        Sanctum::actingAs($user);

        return $user;
    }

    private function media(string $ext = 'png', int $width = 1000, int $height = 1500, string $name = 'pin'): CuratorMedia
    {
        $path = "media/{$name}.{$ext}";
        Storage::disk('public')->put($path, 'fake-image-bytes');

        return CuratorMedia::query()->create([
            'disk' => 'public',
            'directory' => 'media',
            'visibility' => 'public',
            'name' => "{$name}.{$ext}",
            'path' => $path,
            'width' => $width,
            'height' => $height,
            'size' => 16,
            'type' => 'image',
            'ext' => $ext,
            'folder' => CuratorMedia::FOLDER_GENERAL,
        ]);
    }

    private function makePost(string $slug = 'tilted-bowl-vs-slow-feeder', string $status = 'published'): Post
    {
        return Post::query()->create([
            'blog_category_id' => BlogCategory::factory()->create()->id,
            'type' => Post::TYPE_ARTICLE,
            'title' => 'Tilted Bowl vs Slow Feeder',
            'slug' => $slug,
            'content' => 'Body.',
            'status' => $status,
            'published_at' => $status === 'published' ? now() : null,
        ]);
    }

    private function payload(array $overrides = []): array
    {
        // A default image only when the test did not bring its own: two library entries never share a path.
        return array_merge([
            'media_id' => $overrides['media_id'] ?? $this->media()->id,
            'title' => 'Does your Frenchie eat too fast?',
            'description' => 'A tilted bowl can help a flat-faced dog eat without bending its neck.',
            'destination_url' => 'https://petposture.com/blog/tilted-bowl-vs-slow-feeder',
        ], $overrides);
    }

    private function makePin(array $overrides = []): PinterestPin
    {
        return PinterestPin::query()->create(array_merge([
            'image' => 'media/pin.png',
            'title' => 'A pin',
            'description' => 'About a pin.',
            'destination_url' => 'https://petposture.com/blog/a-post',
        ], $overrides));
    }

    // ---------------------------------------------------------------- who may use it

    public function test_a_visitor_is_not_logged_in(): void
    {
        $this->getJson('/api/admin/pinterest-pins')->assertUnauthorized();
    }

    public function test_the_core_admin_roles_can_use_every_endpoint(): void
    {
        $this->media();
        $pin = $this->makePin();

        foreach (self::CORE_ROLES as $role) {
            $this->actingAsRole($role);

            $this->getJson('/api/admin/pinterest-pins')->assertOk();
            $this->getJson('/api/admin/pinterest-pins/options')->assertOk();
            $this->getJson("/api/admin/pinterest-pins/{$pin->id}")->assertOk();
            $this->getJson("/api/admin/pinterest-pins/{$pin->id}/download")->assertOk();
            $this->putJson("/api/admin/pinterest-pins/{$pin->id}", ['title' => "By {$role}"])->assertOk();
        }
    }

    public function test_no_business_role_can_see_or_change_pins(): void
    {
        $pin = $this->makePin();

        foreach (self::BLOCKED_ROLES as $role) {
            $this->actingAsRole($role);

            $this->getJson('/api/admin/pinterest-pins')->assertForbidden();
            $this->getJson('/api/admin/pinterest-pins/options')->assertForbidden();
            $this->getJson("/api/admin/pinterest-pins/{$pin->id}")->assertForbidden();
            $this->getJson("/api/admin/pinterest-pins/{$pin->id}/download")->assertForbidden();
            $this->postJson('/api/admin/pinterest-pins', $this->payload())->assertForbidden();
            $this->putJson("/api/admin/pinterest-pins/{$pin->id}", ['title' => 'Changed'])->assertForbidden();
            $this->deleteJson("/api/admin/pinterest-pins/{$pin->id}")->assertForbidden();
        }

        $this->assertSame('A pin', $pin->fresh()->title, 'A forbidden role must not change the pin.');
        $this->assertDatabaseCount('pinterest_pins', 1);
    }

    public function test_an_ability_given_to_a_business_role_by_hand_opens_exactly_that_access(): void
    {
        $this->media();
        $pin = $this->makePin();
        $user = $this->actingAsRole('Product Manager');
        $role = $user->roles()->firstOrFail();

        $role->givePermissionTo('view_any_pinterest_pin');
        $user->forgetCachedPermissions();
        $this->getJson('/api/admin/pinterest-pins')->assertOk();
        $this->getJson('/api/admin/pinterest-pins/options')->assertOk();
        $this->getJson("/api/admin/pinterest-pins/{$pin->id}")->assertForbidden();
        $this->postJson('/api/admin/pinterest-pins', $this->payload())->assertForbidden();

        $role->givePermissionTo('view_pinterest_pin');
        $user->forgetCachedPermissions();
        $this->getJson("/api/admin/pinterest-pins/{$pin->id}")->assertOk();
        $this->getJson("/api/admin/pinterest-pins/{$pin->id}/download")->assertOk();
        $this->putJson("/api/admin/pinterest-pins/{$pin->id}", ['title' => 'Changed'])->assertForbidden();

        $role->givePermissionTo('update_pinterest_pin');
        $user->forgetCachedPermissions();
        $this->putJson("/api/admin/pinterest-pins/{$pin->id}", ['title' => 'Changed'])->assertOk();
        $this->deleteJson("/api/admin/pinterest-pins/{$pin->id}")->assertForbidden();

        $role->givePermissionTo(['create_pinterest_pin', 'delete_pinterest_pin']);
        $user->forgetCachedPermissions();
        $this->postJson('/api/admin/pinterest-pins', $this->payload())->assertCreated();
        $this->deleteJson("/api/admin/pinterest-pins/{$pin->id}")->assertNoContent();
    }

    public function test_there_is_no_public_page_or_public_api_for_pins(): void
    {
        $this->makePin();

        $this->getJson('/api/pinterest-pins')->assertNotFound();
        $this->get('/pinterest-pins')->assertNotFound();
        $this->get('/pins')->assertNotFound();
    }

    // ---------------------------------------------------------------- list

    public function test_it_lists_pins_newest_first_with_the_fields_the_list_needs(): void
    {
        $this->actingAsRole();
        $post = $this->makePost();
        $this->media(name: 'older');
        $this->makePin(['title' => 'Older', 'image' => 'media/older.png', 'created_at' => now()->subDay()]);
        $this->makePin([
            'title' => 'Newer',
            'image' => 'media/older.png',
            'post_id' => $post->id,
            'board' => 'French Bulldog Tips',
            'scheduled_date' => '2026-11-20',
        ]);

        $response = $this->getJson('/api/admin/pinterest-pins')->assertOk();

        $response->assertJsonPath('data.0.title', 'Newer');
        $response->assertJsonPath('data.1.title', 'Older');
        $response->assertJsonPath('data.0.post.title', 'Tilted Bowl vs Slow Feeder');
        $response->assertJsonPath('data.0.post.slug', 'tilted-bowl-vs-slow-feeder');
        $response->assertJsonPath('data.0.board', 'French Bulldog Tips');
        $response->assertJsonPath('data.0.status', 'ready');
        $response->assertJsonPath('data.0.scheduled_date', '2026-11-20');
        $response->assertJsonPath('data.0.posted_at', null);
        $this->assertStringContainsString('media/older.png', $response->json('data.0.image_url'));
        $response->assertJsonStructure(['data', 'meta' => ['current_page', 'last_page', 'per_page', 'total']]);
    }

    public function test_it_filters_by_status_and_by_post(): void
    {
        $this->actingAsRole();
        $first = $this->makePost('first-post');
        $second = $this->makePost('second-post');
        $this->makePin(['title' => 'Ready one', 'post_id' => $first->id]);
        $this->makePin(['title' => 'Posted one', 'post_id' => $first->id])->setStatus('posted')->save();
        $this->makePin(['title' => 'Other post', 'post_id' => $second->id]);

        $byStatus = $this->getJson('/api/admin/pinterest-pins?status=posted')->assertOk();
        $this->assertSame(['Posted one'], collect($byStatus->json('data'))->pluck('title')->all());

        $byPost = $this->getJson("/api/admin/pinterest-pins?post_id={$second->id}")->assertOk();
        $this->assertSame(['Other post'], collect($byPost->json('data'))->pluck('title')->all());

        $both = $this->getJson("/api/admin/pinterest-pins?status=ready&post_id={$first->id}")->assertOk();
        $this->assertSame(['Ready one'], collect($both->json('data'))->pluck('title')->all());
    }

    public function test_it_rejects_an_unknown_status_filter(): void
    {
        $this->actingAsRole();

        $this->getJson('/api/admin/pinterest-pins?status=draft')->assertUnprocessable()->assertJsonValidationErrors('status');
    }

    // ---------------------------------------------------------------- create

    public function test_it_creates_a_pin_from_an_uploaded_image(): void
    {
        $this->actingAsRole();
        $media = $this->media();

        $response = $this->postJson('/api/admin/pinterest-pins', $this->payload([
            'media_id' => $media->id,
            'board' => 'French Bulldog Tips',
            'scheduled_date' => '2026-11-25',
        ]))->assertCreated();

        $pin = PinterestPin::query()->firstOrFail();
        $this->assertSame($media->path, $pin->image, 'The pin stores the media path, not a URL.');
        $this->assertSame('ready', $pin->status);
        $this->assertNull($pin->posted_at);
        $response->assertJsonPath('data.id', $pin->id);
        $response->assertJsonPath('data.media_id', (string) $media->id);
        $response->assertJsonPath('data.board', 'French Bulldog Tips');
        $response->assertJsonPath('data.scheduled_date', '2026-11-25');
        $this->assertStringContainsString($media->path, $response->json('data.image_url'));
    }

    public function test_the_title_may_be_100_characters_and_the_description_500(): void
    {
        $this->actingAsRole();

        $this->postJson('/api/admin/pinterest-pins', $this->payload([
            'title' => str_repeat('t', 100),
            'description' => str_repeat('d', 500),
        ]))->assertCreated();
    }

    public function test_it_rejects_a_title_over_100_and_a_description_over_500(): void
    {
        $this->actingAsRole();

        $this->postJson('/api/admin/pinterest-pins', $this->payload(['title' => str_repeat('t', 101)]))
            ->assertUnprocessable()->assertJsonValidationErrors('title');
        $this->postJson('/api/admin/pinterest-pins', $this->payload(['description' => str_repeat('d', 501)]))
            ->assertUnprocessable()->assertJsonValidationErrors('description');
        $this->assertDatabaseCount('pinterest_pins', 0);
    }

    public function test_it_requires_an_image_title_and_description(): void
    {
        $this->actingAsRole();

        $this->postJson('/api/admin/pinterest-pins', [
            'destination_url' => 'https://petposture.com/blog/x',
        ])->assertUnprocessable()->assertJsonValidationErrors(['media_id', 'title', 'description']);
    }

    public function test_it_accepts_only_jpg_png_and_webp_images(): void
    {
        $this->actingAsRole();

        foreach (['jpg', 'jpeg', 'png', 'webp'] as $ext) {
            $this->postJson('/api/admin/pinterest-pins', $this->payload(['media_id' => $this->media($ext, name: "ok-{$ext}")->id]))
                ->assertCreated();
        }

        foreach (['gif', 'svg', 'avif'] as $ext) {
            $this->postJson('/api/admin/pinterest-pins', $this->payload(['media_id' => $this->media($ext, name: "no-{$ext}")->id]))
                ->assertUnprocessable()
                ->assertJsonValidationErrors('media_id');
        }
    }

    public function test_it_rejects_an_image_that_is_not_in_the_media_library(): void
    {
        $this->actingAsRole();

        $this->postJson('/api/admin/pinterest-pins', $this->payload(['media_id' => 999999]))
            ->assertUnprocessable()->assertJsonValidationErrors('media_id');
    }

    public function test_it_rejects_a_bad_status_date_or_post(): void
    {
        $this->actingAsRole();

        $this->postJson('/api/admin/pinterest-pins', $this->payload(['status' => 'draft']))
            ->assertUnprocessable()->assertJsonValidationErrors('status');
        $this->postJson('/api/admin/pinterest-pins', $this->payload(['scheduled_date' => 'tomorrow']))
            ->assertUnprocessable()->assertJsonValidationErrors('scheduled_date');
        $this->postJson('/api/admin/pinterest-pins', $this->payload(['post_id' => 999999]))
            ->assertUnprocessable()->assertJsonValidationErrors('post_id');
    }

    public function test_choosing_a_post_fills_the_destination_url_when_it_is_left_blank(): void
    {
        $this->actingAsRole();
        $post = $this->makePost();

        $this->postJson('/api/admin/pinterest-pins', $this->payload(['post_id' => $post->id, 'destination_url' => null]))
            ->assertCreated()
            ->assertJsonPath('data.destination_url', 'https://petposture.com/blog/tilted-bowl-vs-slow-feeder');
    }

    public function test_a_destination_url_typed_by_hand_is_kept_even_with_a_post(): void
    {
        $this->actingAsRole();
        $post = $this->makePost();

        $this->postJson('/api/admin/pinterest-pins', $this->payload([
            'post_id' => $post->id,
            'destination_url' => 'https://petposture.com/picks/necoichi-tilted-elevated-bowl',
        ]))->assertCreated()->assertJsonPath('data.destination_url', 'https://petposture.com/picks/necoichi-tilted-elevated-bowl');
    }

    public function test_without_a_post_the_destination_url_is_required_and_must_be_a_url(): void
    {
        $this->actingAsRole();

        $this->postJson('/api/admin/pinterest-pins', $this->payload(['destination_url' => null]))
            ->assertUnprocessable()->assertJsonValidationErrors('destination_url');
        $this->postJson('/api/admin/pinterest-pins', $this->payload(['destination_url' => 'not a url']))
            ->assertUnprocessable()->assertJsonValidationErrors('destination_url');
    }

    public function test_a_pin_created_as_posted_gets_its_posting_time(): void
    {
        $this->actingAsRole();
        Carbon::setTestNow('2026-11-21 09:30:00');

        $this->postJson('/api/admin/pinterest-pins', $this->payload(['status' => 'posted']))
            ->assertCreated()
            ->assertJsonPath('data.status', 'posted');

        $this->assertSame('2026-11-21 09:30:00', PinterestPin::query()->firstOrFail()->posted_at->format('Y-m-d H:i:s'));
        Carbon::setTestNow();
    }

    // ---------------------------------------------------------------- update

    public function test_it_updates_the_text_and_replaces_the_image(): void
    {
        $this->actingAsRole();
        $pin = $this->makePin();
        $newMedia = $this->media('webp', name: 'new-image');

        $this->putJson("/api/admin/pinterest-pins/{$pin->id}", [
            'title' => 'New title',
            'description' => 'New description.',
            'board' => 'Dog Feeding',
            'media_id' => $newMedia->id,
            'scheduled_date' => '2026-12-01',
        ])->assertOk()->assertJsonPath('data.title', 'New title');

        $fresh = $pin->fresh();
        $this->assertSame('New description.', $fresh->description);
        $this->assertSame('Dog Feeding', $fresh->board);
        $this->assertSame($newMedia->path, $fresh->image);
        $this->assertSame('2026-12-01', $fresh->scheduled_date->toDateString());
    }

    public function test_an_update_that_names_no_image_keeps_the_image(): void
    {
        $this->actingAsRole();
        $pin = $this->makePin(['image' => 'media/keep.png']);

        $this->putJson("/api/admin/pinterest-pins/{$pin->id}", ['title' => 'Only the title'])->assertOk();

        $this->assertSame('media/keep.png', $pin->fresh()->image);
    }

    public function test_the_limits_apply_on_update_too(): void
    {
        $this->actingAsRole();
        $pin = $this->makePin();

        $this->putJson("/api/admin/pinterest-pins/{$pin->id}", ['title' => str_repeat('t', 101)])
            ->assertUnprocessable()->assertJsonValidationErrors('title');
        $this->putJson("/api/admin/pinterest-pins/{$pin->id}", ['description' => str_repeat('d', 501)])
            ->assertUnprocessable()->assertJsonValidationErrors('description');
    }

    public function test_marking_a_pin_posted_writes_the_time_of_the_click_and_keeps_it(): void
    {
        $this->actingAsRole();
        $pin = $this->makePin();

        Carbon::setTestNow('2026-11-21 09:30:00');
        $this->putJson("/api/admin/pinterest-pins/{$pin->id}", ['status' => 'posted'])
            ->assertOk()
            ->assertJsonPath('data.status', 'posted');
        $this->assertSame('2026-11-21 09:30:00', $pin->fresh()->posted_at->format('Y-m-d H:i:s'));

        Carbon::setTestNow('2026-11-22 18:00:00');
        $this->putJson("/api/admin/pinterest-pins/{$pin->id}", ['status' => 'posted', 'title' => 'Edited after posting'])->assertOk();
        $this->assertSame('2026-11-21 09:30:00', $pin->fresh()->posted_at->format('Y-m-d H:i:s'), 'Editing a posted pin must not move the time.');

        Carbon::setTestNow();
    }

    public function test_moving_a_pin_back_to_ready_clears_the_posting_time(): void
    {
        $this->actingAsRole();
        $pin = $this->makePin();
        $pin->setStatus('posted')->save();

        $this->putJson("/api/admin/pinterest-pins/{$pin->id}", ['status' => 'ready'])
            ->assertOk()
            ->assertJsonPath('data.posted_at', null);

        $this->assertNull($pin->fresh()->posted_at);
    }

    public function test_a_missing_pin_is_not_found(): void
    {
        $this->actingAsRole();

        $this->getJson('/api/admin/pinterest-pins/999999')->assertNotFound();
        $this->putJson('/api/admin/pinterest-pins/999999', ['title' => 'x'])->assertNotFound();
        $this->deleteJson('/api/admin/pinterest-pins/999999')->assertNotFound();
    }

    // ---------------------------------------------------------------- delete

    public function test_deleting_a_pin_leaves_the_image_in_the_media_library(): void
    {
        $this->actingAsRole();
        $media = $this->media();
        $pin = $this->makePin(['image' => $media->path]);

        $this->deleteJson("/api/admin/pinterest-pins/{$pin->id}")->assertNoContent();

        $this->assertDatabaseMissing('pinterest_pins', ['id' => $pin->id]);
        $this->assertDatabaseHas('curator_media', ['id' => $media->id]);
        Storage::disk('public')->assertExists($media->path);
    }

    // ---------------------------------------------------------------- options

    public function test_the_options_list_the_boards_used_so_far_and_the_published_posts(): void
    {
        $this->actingAsRole();
        $published = $this->makePost('published-post');
        $this->makePost('draft-post', 'draft');
        $this->makePin(['board' => 'Dog Feeding']);
        $this->makePin(['board' => 'French Bulldog Tips']);
        $this->makePin(['board' => 'Dog Feeding']);
        $this->makePin(['board' => null]);

        $response = $this->getJson('/api/admin/pinterest-pins/options')->assertOk();

        $this->assertSame(['Dog Feeding', 'French Bulldog Tips'], $response->json('data.boards'));
        $slugs = collect($response->json('data.posts'))->pluck('slug')->all();
        $this->assertSame(['published-post'], $slugs, 'Drafts are not offered.');
        $response->assertJsonPath('data.posts.0.id', $published->id);
        $response->assertJsonPath('data.posts.0.title', 'Tilted Bowl vs Slow Feeder');
        $response->assertJsonPath('data.posts.0.url', 'https://petposture.com/blog/published-post');
    }

    // ---------------------------------------------------------------- download

    public function test_it_downloads_the_image_as_a_file_named_after_the_title(): void
    {
        $this->actingAsRole();
        $media = $this->media();
        $pin = $this->makePin(['image' => $media->path, 'title' => 'Does your Frenchie eat too fast?']);

        $response = $this->get("/api/admin/pinterest-pins/{$pin->id}/download")->assertOk();

        $disposition = (string) $response->headers->get('content-disposition');
        $this->assertStringContainsString('attachment', $disposition);
        $this->assertStringContainsString('does-your-frenchie-eat-too-fast.png', $disposition);
    }

    public function test_a_webp_image_is_downloaded_as_a_jpg_because_pinterest_takes_jpg_and_png_only(): void
    {
        if (! function_exists('imagewebp') || ! function_exists('imagecreatefromwebp')) {
            $this->markTestSkipped('GD has no WebP support here.');
        }

        $this->actingAsRole();
        ob_start();
        imagewebp(imagecreatetruecolor(20, 30));
        Storage::disk('public')->put('media/pin.webp', (string) ob_get_clean());
        $pin = $this->makePin(['image' => 'media/pin.webp', 'title' => 'Does your Frenchie eat too fast?']);

        $response = $this->get("/api/admin/pinterest-pins/{$pin->id}/download")->assertOk();

        $this->assertStringContainsString('does-your-frenchie-eat-too-fast.jpg', (string) $response->headers->get('content-disposition'));
        $this->assertSame('image/jpeg', $response->headers->get('content-type'));
        $this->assertStringStartsWith("\xFF\xD8", $response->streamedContent());
    }

    public function test_an_image_that_cannot_be_converted_is_downloaded_as_it_is(): void
    {
        $this->actingAsRole();
        Storage::disk('public')->put('media/odd.webp', 'not-really-an-image');
        $pin = $this->makePin(['image' => 'media/odd.webp', 'title' => 'An odd one']);

        $response = $this->get("/api/admin/pinterest-pins/{$pin->id}/download")->assertOk();

        $this->assertStringContainsString('an-odd-one.webp', (string) $response->headers->get('content-disposition'));
        $this->assertSame('not-really-an-image', $response->streamedContent());
    }

    public function test_the_download_says_so_when_the_image_file_is_gone(): void
    {
        $this->actingAsRole();
        $pin = $this->makePin(['image' => 'media/missing.png']);

        $this->getJson("/api/admin/pinterest-pins/{$pin->id}/download")->assertNotFound();
    }
}
