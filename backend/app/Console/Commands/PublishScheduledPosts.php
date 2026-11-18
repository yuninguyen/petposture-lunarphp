<?php

namespace App\Console\Commands;

use App\Models\Post;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Publishes the posts that were scheduled for a time that has now come. Run every minute by the scheduler.
 * A post whose time has already passed (the job was delayed, or the app was down) is published at the next run.
 * Saving the post goes through the model, so the public-content cache is purged at that moment.
 */
class PublishScheduledPosts extends Command
{
    protected $signature = 'posts:publish-due';

    protected $description = 'Publish the scheduled blog posts whose time has come';

    public function handle(): int
    {
        $published = 0;

        Post::query()
            ->where('status', 'scheduled')
            ->where('published_at', '<=', now())
            ->orderBy('published_at')
            ->pluck('id')
            ->each(function (int $id) use (&$published): void {
                DB::transaction(function () use ($id, &$published): void {
                    // Re-read under a lock: the post may have been cancelled or rescheduled since the list was read.
                    $post = Post::query()->lockForUpdate()->find($id);

                    if (! $post || $post->status !== 'scheduled' || $post->published_at === null || $post->published_at->isFuture()) {
                        return;
                    }

                    $post->status = 'published';
                    $post->save();

                    activity()
                        ->performedOn($post)
                        ->event('published')
                        ->withProperties(['scheduled_for' => $post->published_at->toIso8601String()])
                        ->log('published');

                    $published++;
                });
            });

        $this->info("Published {$published} scheduled post(s).");

        return self::SUCCESS;
    }
}
