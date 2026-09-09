<?php

namespace App\Models;

use App\Services\StorefrontRefreshJournal;
use Illuminate\Database\Eloquent\Model;

/** Journal inspection model; state writes belong to the fenced repository. */
class StorefrontRefreshJournalEntry extends Model
{
    protected $table = 'storefront_refresh_journal';
    protected $connection = StorefrontRefreshJournal::CONNECTION;
    protected $keyType = 'string';
    public $incrementing = false;
    protected $guarded = ['*'];

    protected function casts(): array
    {
        return [
            'cache_keys' => 'array',
            'recovery_attempts' => 'integer',
            'initial_attempted' => 'boolean',
            'next_attempt_at' => 'immutable_datetime',
            'next_dispatch_at' => 'immutable_datetime',
            'lease_expires_at' => 'immutable_datetime',
            'completed_at' => 'immutable_datetime',
        ];
    }
}
