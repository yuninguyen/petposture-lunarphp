<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AffiliateNetwork extends Model
{
    protected $fillable = [
        'name',
        'slug',
        'logo',
        'active',
        'provider',
        'api_key',
        'api_secret',
        'merchant_id',
        'commission_rate_default',
        'cookie_days',
        'last_synced_at',
    ];

    protected $casts = [
        'active' => 'boolean',
        'api_key' => 'encrypted',
        'api_secret' => 'encrypted',
        'last_synced_at' => 'datetime',
    ];

    public function isApiConfigured(): bool
    {
        return filled($this->provider) && filled($this->api_key);
    }

    public function reports()
    {
        return $this->hasMany(AffiliateReport::class);
    }
}
