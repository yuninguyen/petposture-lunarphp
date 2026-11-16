<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * A Pinterest pin prepared in the admin and posted by hand. `image` is a path on the media disk (the same one the
 * admin media library uploads to), not a URL.
 *
 * @property int $id
 * @property int|null $post_id
 * @property string $image
 * @property string $title
 * @property string $description
 * @property string $destination_url
 * @property string|null $board
 * @property string $status
 * @property Carbon|null $scheduled_date
 * @property Carbon|null $posted_at
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class PinterestPin extends Model
{
    public const STATUS_READY = 'ready';

    public const STATUS_POSTED = 'posted';

    public const STATUSES = [self::STATUS_READY, self::STATUS_POSTED];

    protected $fillable = [
        'post_id',
        'image',
        'title',
        'description',
        'destination_url',
        'board',
        'status',
        'scheduled_date',
        'posted_at',
    ];

    protected $attributes = [
        'status' => self::STATUS_READY,
    ];

    protected function casts(): array
    {
        return [
            'scheduled_date' => 'date',
            'posted_at' => 'datetime',
        ];
    }

    public function post(): BelongsTo
    {
        return $this->belongsTo(Post::class);
    }

    /** The media library entry the image came from, found by its path. Null once that entry is gone. */
    public function media(): BelongsTo
    {
        return $this->belongsTo(CuratorMedia::class, 'image', 'path');
    }

    /** Where a pin made from this post points: the public blog URL, built on the storefront address. */
    public static function urlForPost(Post $post): string
    {
        return rtrim((string) config('app.frontend_url'), '/').'/blog/'.$post->slug;
    }

    /**
     * Changes the status and keeps `posted_at` truthful: it is stamped the first time the pin becomes posted,
     * kept while it stays posted, and cleared when it goes back to ready. Does not save.
     */
    public function setStatus(string $status): static
    {
        if (! in_array($status, self::STATUSES, true)) {
            throw new \InvalidArgumentException("Unknown pin status [{$status}].");
        }

        $this->status = $status;
        $this->posted_at = $status === self::STATUS_POSTED ? ($this->posted_at ?? now()) : null;

        return $this;
    }
}
