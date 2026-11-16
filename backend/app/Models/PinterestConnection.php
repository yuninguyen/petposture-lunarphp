<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * The Pinterest account the admin is connected to (there is only ever one). The tokens are encrypted at rest and
 * hidden from every array/JSON form of the model, so they cannot leak into a response or a log by accident.
 *
 * @property int $id
 * @property string|null $pinterest_user_id
 * @property string|null $username
 * @property string $access_token
 * @property string|null $refresh_token
 * @property Carbon|null $access_expires_at
 * @property Carbon|null $refresh_expires_at
 * @property string|null $scopes
 * @property string $status
 * @property string|null $last_error
 * @property Carbon|null $last_refreshed_at
 * @property Carbon|null $expiry_warned_at
 */
class PinterestConnection extends Model
{
    public const STATUS_CONNECTED = 'connected';

    public const STATUS_DISCONNECTED = 'disconnected';

    protected $fillable = [
        'pinterest_user_id',
        'username',
        'access_token',
        'refresh_token',
        'access_expires_at',
        'refresh_expires_at',
        'scopes',
        'status',
        'last_error',
        'last_refreshed_at',
        'expiry_warned_at',
    ];

    protected $hidden = ['access_token', 'refresh_token'];

    protected function casts(): array
    {
        return [
            'access_token' => 'encrypted',
            'refresh_token' => 'encrypted',
            'access_expires_at' => 'datetime',
            'refresh_expires_at' => 'datetime',
            'last_refreshed_at' => 'datetime',
            'expiry_warned_at' => 'datetime',
        ];
    }

    public static function current(): ?self
    {
        return static::query()->latest('id')->first();
    }

    /** True while the account is connected and the access token can still be refreshed or used. */
    public function isUsable(): bool
    {
        return $this->status === self::STATUS_CONNECTED;
    }
}
