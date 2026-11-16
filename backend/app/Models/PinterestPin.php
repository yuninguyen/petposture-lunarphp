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
 * @property string|null $pinterest_board_id
 * @property string|null $pinterest_pin_id
 * @property Carbon|null $posted_at
 * @property string|null $posted_via
 * @property int $publish_attempts
 * @property Carbon|null $last_attempt_at
 * @property string|null $last_error
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class PinterestPin extends Model
{
    public const STATUS_READY = 'ready';

    public const STATUS_POSTED = 'posted';

    /** Set by the publishing job only: a call to Pinterest is in flight, it failed for sure, or its outcome is unknown. */
    public const STATUS_PUBLISHING = 'publishing';

    public const STATUS_FAILED = 'failed';

    public const STATUS_NEEDS_REVIEW = 'needs_review';

    public const POSTED_VIA_MANUAL = 'manual';

    public const POSTED_VIA_API = 'api';

    /** What a person can set. The job's own states below are never chosen from the admin. */
    public const STATUSES = [self::STATUS_READY, self::STATUS_POSTED];

    /** Every status a pin can be in, for filtering the list. */
    public const ALL_STATUSES = [
        self::STATUS_READY,
        self::STATUS_POSTED,
        self::STATUS_PUBLISHING,
        self::STATUS_FAILED,
        self::STATUS_NEEDS_REVIEW,
    ];

    protected $fillable = [
        'post_id',
        'image',
        'title',
        'description',
        'destination_url',
        'board',
        'pinterest_board_id',
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
            'last_attempt_at' => 'datetime',
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

        if ($status === self::STATUS_POSTED) {
            // A pin the job posted keeps its mark; one a person confirms was posted by hand.
            $this->posted_via ??= self::POSTED_VIA_MANUAL;
        } else {
            // Back to ready is a retry: start the attempts and the error over, and forget how it was posted.
            $this->posted_via = null;
            $this->publish_attempts = 0;
            $this->last_error = null;
        }

        return $this;
    }
}
