<?php

namespace App\Filament\Pages;

use Filament\Actions\Action;
use Filament\Pages\Page;

class NotificationsPage extends Page
{
    protected static ?string $navigationIcon = 'heroicon-o-bell';

    protected static ?string $navigationLabel = 'Notifications';

    protected static ?string $title = 'Notifications';

    protected static ?string $slug = 'notifications';

    protected static string $view = 'filament.pages.notifications-page';

    protected static ?int $navigationSort = 3;

    public string $activeTab = 'all';

    public static function getNavigationGroup(): ?string
    {
        return __('System');
    }

    public static function getNavigationBadge(): ?string
    {
        $count = auth()->user()?->unreadNotifications()->count() ?? 0;

        return $count > 0 ? (string) $count : null;
    }

    public function getHeading(): string
    {
        return '';
    }

    public function setTab(string $tab): void
    {
        $this->activeTab = $tab;
    }

    public function getUnreadCount(): int
    {
        return auth()->user()->unreadNotifications()->count();
    }

    public function getGroupedNotifications()
    {
        $query = auth()->user()->notifications();

        if ($this->activeTab === 'unread') {
            $query->whereNull('read_at');
        }

        return $query->latest()->limit(100)->get()->groupBy(
            fn ($notification) => $notification->created_at->isToday()
                ? 'Today'
                : ($notification->created_at->isYesterday() ? 'Yesterday' : 'Earlier')
        );
    }

    protected function getHeaderActions(): array
    {
        return [
            Action::make('markAllAsRead')
                ->label(__('Mark all as read'))
                ->icon('heroicon-o-check')
                ->color('gray')
                ->action(function () {
                    auth()->user()->unreadNotifications->markAsRead();
                }),
        ];
    }
}
