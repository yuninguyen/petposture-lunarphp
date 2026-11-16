<?php

namespace Tests\Feature;

use App\Models\BlogCategory;
use App\Models\PinterestPin;
use App\Models\Post;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class PinterestPinModelTest extends TestCase
{
    use RefreshDatabase;

    private function makePost(string $slug = 'tilted-bowl-vs-slow-feeder'): Post
    {
        return Post::query()->create([
            'blog_category_id' => BlogCategory::factory()->create()->id,
            'type' => Post::TYPE_ARTICLE,
            'title' => 'Tilted Bowl vs Slow Feeder',
            'slug' => $slug,
            'content' => 'Body.',
            'status' => 'published',
        ]);
    }

    private function pin(array $overrides = []): PinterestPin
    {
        return PinterestPin::query()->create(array_merge([
            'image' => 'media/pin-1.png',
            'title' => 'Does your Frenchie eat too fast?',
            'description' => 'A tilted bowl can help a flat-faced dog eat without bending its neck.',
            'destination_url' => 'https://petposture.com/blog/tilted-bowl-vs-slow-feeder',
        ], $overrides));
    }

    public function test_the_table_has_the_columns_of_a_pin(): void
    {
        $this->assertTrue(Schema::hasTable('pinterest_pins'));
        $this->assertTrue(Schema::hasColumns('pinterest_pins', [
            'id', 'post_id', 'image', 'title', 'description', 'destination_url', 'board', 'status',
            'scheduled_date', 'posted_at', 'created_at', 'updated_at',
        ]));
    }

    public function test_a_new_pin_is_ready_and_has_no_post_board_or_dates(): void
    {
        $pin = $this->pin()->refresh();

        $this->assertSame(PinterestPin::STATUS_READY, $pin->status);
        $this->assertNull($pin->post_id);
        $this->assertNull($pin->board);
        $this->assertNull($pin->scheduled_date);
        $this->assertNull($pin->posted_at);
    }

    public function test_a_pin_belongs_to_the_post_it_was_made_from(): void
    {
        $post = $this->makePost();
        $pin = $this->pin(['post_id' => $post->id]);

        $this->assertTrue($pin->post->is($post));
    }

    public function test_deleting_the_post_keeps_the_pin_and_clears_its_post(): void
    {
        $post = $this->makePost();
        $pin = $this->pin(['post_id' => $post->id]);

        $post->forceDelete();

        $this->assertNull($pin->fresh()->post_id);
        $this->assertDatabaseHas('pinterest_pins', ['id' => $pin->id]);
    }

    public function test_the_schedule_is_a_date_and_the_posting_time_is_a_datetime(): void
    {
        $pin = $this->pin(['scheduled_date' => '2026-11-20', 'posted_at' => '2026-11-21 09:30:00'])->refresh();

        $this->assertInstanceOf(Carbon::class, $pin->scheduled_date);
        $this->assertSame('2026-11-20', $pin->scheduled_date->toDateString());
        $this->assertInstanceOf(Carbon::class, $pin->posted_at);
    }

    public function test_setting_the_status_to_posted_stamps_the_time_once(): void
    {
        Carbon::setTestNow('2026-11-21 09:30:00');
        $pin = $this->pin();

        $pin->setStatus(PinterestPin::STATUS_POSTED)->save();
        $this->assertSame('2026-11-21 09:30:00', $pin->fresh()->posted_at->format('Y-m-d H:i:s'));

        Carbon::setTestNow('2026-11-22 18:00:00');
        $pin->setStatus(PinterestPin::STATUS_POSTED)->save();
        $this->assertSame('2026-11-21 09:30:00', $pin->fresh()->posted_at->format('Y-m-d H:i:s'), 'Already posted: the time is kept.');

        Carbon::setTestNow();
    }

    public function test_setting_the_status_back_to_ready_clears_the_posting_time(): void
    {
        $pin = $this->pin();
        $pin->setStatus(PinterestPin::STATUS_POSTED)->save();

        $pin->setStatus(PinterestPin::STATUS_READY)->save();

        $this->assertSame(PinterestPin::STATUS_READY, $pin->fresh()->status);
        $this->assertNull($pin->fresh()->posted_at);
    }

    public function test_only_ready_and_posted_are_statuses(): void
    {
        $this->assertSame(['ready', 'posted'], PinterestPin::STATUSES);

        $this->expectException(\InvalidArgumentException::class);
        $this->pin()->setStatus('draft');
    }
}
