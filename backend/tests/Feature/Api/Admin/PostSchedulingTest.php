<?php

namespace Tests\Feature\Api\Admin;

use App\Models\BlogCategory;
use App\Models\Post;
use App\Models\User;
use App\Services\PublicContentPurgeCoordinator;
use Carbon\Carbon;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Scheduled publishing: a post set to "scheduled" behaves like a draft in public until its time, is published by
 * posts:publish-due at or after that time, and can be rescheduled or cancelled back to a draft.
 */
class PostSchedulingTest extends TestCase
{
    use RefreshDatabase;

    private BlogCategory $category;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
        $this->category = BlogCategory::factory()->create();
        $this->actingAsRole('admin');
        Carbon::setTestNow('2026-11-20 12:00:00');
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function actingAsRole(string $role): void
    {
        Sanctum::actingAs(User::factory()->create()->assignRole($role));
    }

    private function payload(array $overrides = []): array
    {
        return array_merge([
            'blog_category_id' => $this->category->id,
            'title' => 'Scheduling Test Post',
            'slug' => 'scheduling-test-post',
            'content' => '<p>Body</p>',
            'status' => 'draft',
        ], $overrides);
    }

    private function schedule(string $when = '2026-11-21T15:47:00Z', array $overrides = []): Post
    {
        $id = $this->postJson('/api/admin/posts', $this->payload(['status' => 'scheduled', 'published_at' => $when] + $overrides))
            ->assertCreated()->json('data.id');

        return Post::query()->findOrFail($id);
    }

    private function publicSlugs(): array
    {
        return collect($this->getJson('/api/posts')->assertOk()->json('data'))->pluck('slug')->all();
    }

    public function test_a_scheduled_post_is_stored_in_utc_and_hidden_in_public_like_a_draft(): void
    {
        $post = $this->schedule('2026-11-21T10:47:00-05:00');

        $this->assertSame('scheduled', $post->status);
        $this->assertSame('2026-11-21 15:47:00', $post->published_at->utc()->format('Y-m-d H:i:s'));
        $this->getJson('/api/posts/scheduling-test-post')->assertNotFound();
        $this->assertNotContains('scheduling-test-post', $this->publicSlugs());
    }

    public function test_the_scheduler_leaves_it_alone_before_its_time_and_publishes_it_at_its_time(): void
    {
        $post = $this->schedule('2026-11-21T15:47:00Z');

        Carbon::setTestNow('2026-11-21 15:46:59');
        $this->artisan('posts:publish-due')->assertSuccessful();
        $this->assertSame('scheduled', $post->fresh()->status);
        $this->getJson('/api/posts/scheduling-test-post')->assertNotFound();

        Carbon::setTestNow('2026-11-21 15:47:00');
        $this->artisan('posts:publish-due')->assertSuccessful();

        $fresh = $post->fresh();
        $this->assertSame('published', $fresh->status);
        $this->assertSame('2026-11-21 15:47:00', $fresh->published_at->utc()->format('Y-m-d H:i:s'));
        $this->getJson('/api/posts/scheduling-test-post')->assertOk()->assertJsonPath('data.status', 'published');
        $this->assertContains('scheduling-test-post', $this->publicSlugs());
    }

    public function test_a_post_whose_time_passed_while_the_job_was_late_is_published_at_the_next_run(): void
    {
        $post = Post::query()->create($this->payload(['status' => 'scheduled', 'published_at' => '2026-11-20 09:00:00']));

        $this->artisan('posts:publish-due')->assertSuccessful();

        $this->assertSame('published', $post->fresh()->status);
        $this->assertSame('2026-11-20 09:00:00', $post->fresh()->published_at->utc()->format('Y-m-d H:i:s'));
    }

    public function test_publishing_it_purges_the_public_content_cache_at_that_moment(): void
    {
        $this->schedule('2026-11-21T15:47:00Z');
        Carbon::setTestNow('2026-11-21 15:48:00');

        $this->mock(PublicContentPurgeCoordinator::class, fn ($mock) => $mock->shouldReceive('requestPurge')->atLeast()->once());

        $this->artisan('posts:publish-due')->assertSuccessful();
    }

    public function test_cancelling_a_schedule_makes_it_a_draft_with_no_time_and_it_never_goes_live(): void
    {
        $post = $this->schedule('2026-11-21T15:47:00Z');

        $this->putJson("/api/admin/posts/{$post->id}", ['status' => 'draft'])->assertOk()->assertJsonPath('data.status', 'draft');

        $this->assertNull($post->fresh()->published_at);
        Carbon::setTestNow('2026-11-22 00:00:00');
        $this->artisan('posts:publish-due')->assertSuccessful();
        $this->assertSame('draft', $post->fresh()->status);
        $this->getJson('/api/posts/scheduling-test-post')->assertNotFound();
    }

    public function test_the_time_of_a_scheduled_post_can_be_changed(): void
    {
        $post = $this->schedule('2026-11-21T15:47:00Z');

        $this->putJson("/api/admin/posts/{$post->id}", ['status' => 'scheduled', 'published_at' => '2026-11-28T15:47:00Z'])->assertOk();

        $this->assertSame('2026-11-28 15:47:00', $post->fresh()->published_at->utc()->format('Y-m-d H:i:s'));
        Carbon::setTestNow('2026-11-21 16:00:00');
        $this->artisan('posts:publish-due')->assertSuccessful();
        $this->assertSame('scheduled', $post->fresh()->status);
    }

    public function test_a_time_in_the_past_or_no_time_is_refused(): void
    {
        $this->postJson('/api/admin/posts', $this->payload(['status' => 'scheduled', 'published_at' => '2026-11-19T10:00:00Z']))
            ->assertUnprocessable()->assertJsonValidationErrors('published_at');
        $this->postJson('/api/admin/posts', $this->payload(['status' => 'scheduled']))
            ->assertUnprocessable()->assertJsonValidationErrors('published_at');
        $this->assertDatabaseCount('posts', 0);
    }

    public function test_a_post_set_to_published_for_a_future_time_is_stored_as_scheduled(): void
    {
        $id = $this->postJson('/api/admin/posts', $this->payload(['status' => 'published', 'published_at' => '2026-11-21T15:47:00Z']))
            ->assertCreated()->assertJsonPath('data.status', 'scheduled')->json('data.id');

        $this->assertSame('scheduled', Post::query()->findOrFail($id)->status);
        $this->getJson('/api/posts/scheduling-test-post')->assertNotFound();
    }

    public function test_publishing_with_no_time_or_a_past_time_still_goes_live_immediately_as_before(): void
    {
        $this->postJson('/api/admin/posts', $this->payload(['status' => 'published']))->assertCreated()->assertJsonPath('data.status', 'published');

        $this->getJson('/api/posts/scheduling-test-post')->assertOk();
    }

    public function test_a_live_post_cannot_be_pushed_into_the_future_and_silently_taken_offline(): void
    {
        $post = Post::query()->create($this->payload(['status' => 'published', 'published_at' => '2026-11-10 10:00:00']));

        $this->putJson("/api/admin/posts/{$post->id}", ['published_at' => '2026-11-25T10:00:00Z'])
            ->assertUnprocessable()->assertJsonValidationErrors('published_at');

        $this->assertSame('published', $post->fresh()->status);
        $this->getJson('/api/posts/scheduling-test-post')->assertOk();
    }

    public function test_a_content_writer_cannot_schedule_or_touch_a_scheduled_post(): void
    {
        $post = $this->schedule('2026-11-21T15:47:00Z');
        $this->actingAsRole('Content Writer');

        $this->postJson('/api/admin/posts', $this->payload(['slug' => 'writer-try', 'status' => 'scheduled', 'published_at' => '2026-11-21T15:47:00Z']))->assertForbidden();
        $this->putJson("/api/admin/posts/{$post->id}", ['status' => 'draft'])->assertForbidden();
        $this->assertSame('scheduled', $post->fresh()->status);
    }

    public function test_saving_other_fields_of_a_scheduled_post_whose_time_just_passed_is_not_blocked(): void
    {
        $post = $this->schedule('2026-11-21T15:47:00Z');
        Carbon::setTestNow('2026-11-21 15:48:00');

        $this->putJson("/api/admin/posts/{$post->id}", ['title' => 'Edited title'])->assertOk();

        $this->artisan('posts:publish-due')->assertSuccessful();
        $this->assertSame('published', $post->fresh()->status);
    }
}
