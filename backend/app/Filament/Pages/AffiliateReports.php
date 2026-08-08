<?php

namespace App\Filament\Pages;

use App\Filament\Widgets\AffiliateClicksOverview;
use App\Filament\Widgets\ClicksByNetworkWidget;
use App\Filament\Widgets\TopClickedPostsWidget;
use Filament\Pages\Page;

class AffiliateReports extends Page
{
    protected static ?string $navigationIcon = 'heroicon-o-presentation-chart-line';

    protected static string $view = 'filament.pages.affiliate-reports';

    protected static ?int $navigationSort = 2;

    public static function getNavigationGroup(): ?string
    {
        return __('Finance');
    }

    public static function getNavigationLabel(): string
    {
        return __('Reports');
    }

    public function getTitle(): string
    {
        return __('Affiliate Reports');
    }

    protected function getHeaderWidgets(): array
    {
        return [
            AffiliateClicksOverview::class,
            TopClickedPostsWidget::class,
            ClicksByNetworkWidget::class,
        ];
    }
}
