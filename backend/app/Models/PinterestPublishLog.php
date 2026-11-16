<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * One call to the Pinterest API and how it went. Holds the endpoint, the outcome and Pinterest's own error text,
 * never a token or an Authorization header.
 *
 * @property int $id
 * @property int|null $pinterest_pin_id
 * @property string $action
 * @property string $endpoint
 * @property int|null $http_status
 * @property string|null $error_code
 * @property string|null $message
 * @property int|null $duration_ms
 * @property Carbon|null $created_at
 */
class PinterestPublishLog extends Model
{
    public const UPDATED_AT = null;

    protected $fillable = [
        'pinterest_pin_id',
        'action',
        'endpoint',
        'http_status',
        'error_code',
        'message',
        'duration_ms',
    ];

    protected function casts(): array
    {
        return ['created_at' => 'datetime'];
    }
}
