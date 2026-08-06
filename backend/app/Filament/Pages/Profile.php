<?php

namespace App\Filament\Pages;

use Filament\Pages\Page;
use Illuminate\Support\Str;
use Spatie\Activitylog\Models\Activity;

class Profile extends Page
{
    protected static ?string $navigationIcon = 'heroicon-o-user-circle';

    protected static string $view = 'filament.pages.profile';

    protected static ?string $slug = 'profile-overview';

    protected static ?int $navigationSort = -1;

    public static function getNavigationGroup(): ?string
    {
        return __('lunarpanel::global.sections.settings');
    }

    public function getTitle(): string
    {
        return __('Profile');
    }

    public function getHeading(): string
    {
        return '';
    }

    public function getInitials(): string
    {
        $name = trim((string) auth()->user()->name);

        if ($name === '') {
            return '?';
        }

        $words = preg_split('/\s+/', $name);
        $initials = collect($words)->take(2)->map(fn ($word) => mb_strtoupper(mb_substr($word, 0, 1)))->implode('');

        return $initials ?: '?';
    }

    /**
     * Activity log entries in this app rarely carry a causer (most are
     * written by background jobs/seeders without an authenticated user),
     * so this shows the general recent-activity feed rather than filtering
     * to just the profile owner's own actions.
     */
    public function getRecentActivity()
    {
        if (! class_exists(Activity::class)) {
            return collect();
        }

        return Activity::query()
            ->latest('id')
            ->limit(8)
            ->get();
    }

    public function getRoleLabel(): string
    {
        $role = auth()->user()->getRoleNames()->first();

        return $role ? Str::headline($role) : '—';
    }
}
