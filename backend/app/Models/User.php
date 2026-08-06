<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Filament\Models\Contracts\FilamentUser;
use Filament\Panel;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Lunar\Base\LunarUser as LunarUserInterface;
use Lunar\Base\Traits\LunarUser;
use Spatie\Permission\Traits\HasRoles;

class User extends Authenticatable implements FilamentUser, LunarUserInterface
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, HasRoles, LunarUser, Notifiable;

    public const ADMIN_PANEL_ROLES = ['super_admin', 'admin', 'staff', 'Product Manager', 'Order Manager', 'Support'];

    public function canAccessPanel(Panel $panel): bool
    {
        if ($panel->getId() === 'admin') {
            return $this->is_active && $this->hasAnyRole(self::ADMIN_PANEL_ROLES);
        }

        return true;
    }

    /**
     * Users eligible to receive admin-panel database notifications
     * (order placed, new review, new customer) — the same role set
     * that's allowed into the admin panel in the first place.
     */
    public static function staffRecipients(): Collection
    {
        return self::role(self::ADMIN_PANEL_ROLES)->get();
    }

    protected $fillable = [
        'name',
        'email',
        'password',
        'is_active',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'is_active' => 'boolean',
            'last_login_at' => 'datetime',
        ];
    }

    public function addresses(): HasMany
    {
        return $this->hasMany(UserAddress::class);
    }

    public function wishlistItems(): HasMany
    {
        return $this->hasMany(UserWishlistItem::class);
    }
}
