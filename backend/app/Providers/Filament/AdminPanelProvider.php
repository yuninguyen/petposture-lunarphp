<?php

namespace App\Providers\Filament;

use BezhanSalleh\FilamentShield\FilamentShieldPlugin;
use Filament\Http\Middleware\Authenticate;
use Filament\Http\Middleware\DisableBladeIconComponents;
use Filament\Http\Middleware\DispatchServingFilamentEvent;
use Filament\Pages;
use Filament\Panel;
use Filament\PanelProvider;
use Filament\Support\Colors\Color;
use Filament\Support\Facades\FilamentIcon;
use Filament\Support\Facades\FilamentView;
use Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse;
use Illuminate\Cookie\Middleware\EncryptCookies;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;
use Illuminate\Routing\Middleware\SubstituteBindings;
use Illuminate\Session\Middleware\AuthenticateSession;
use Illuminate\Session\Middleware\StartSession;
use Illuminate\View\Middleware\ShareErrorsFromSession;
use Leandrocfe\FilamentApexCharts\FilamentApexChartsPlugin;
use Lunar\Admin\Filament\Resources;
use Lunar\Admin\Filament\Widgets\Dashboard\Orders\AverageOrderValueChart;
use Lunar\Admin\Filament\Widgets\Dashboard\Orders\LatestOrdersTable;
use Lunar\Admin\Filament\Widgets\Dashboard\Orders\NewVsReturningCustomersChart;
use Lunar\Admin\Filament\Widgets\Dashboard\Orders\OrdersSalesChart;
use Lunar\Admin\Filament\Widgets\Dashboard\Orders\OrderStatsOverview;
use Lunar\Admin\Filament\Widgets\Dashboard\Orders\OrderTotalsChart;
use Lunar\Admin\Filament\Widgets\Dashboard\Orders\PopularProductsTable;

class AdminPanelProvider extends PanelProvider
{
    public function panel(Panel $panel): Panel
    {
        FilamentView::registerRenderHook(
            'panels::global-search.after',
            fn(): string => \Livewire\Livewire::mount('language-switcher'),
        );

        FilamentIcon::register([
            'lunar::activity'              => 'lucide-activity',
            'lunar::attributes'            => 'lucide-pencil-ruler',
            'lunar::availability'          => 'lucide-calendar',
            'lunar::basic-information'     => 'lucide-edit',
            'lunar::brands'                => 'lucide-badge-check',
            'lunar::channels'              => 'lucide-store',
            'lunar::collections'           => 'lucide-blocks',
            'lunar::sub-collection'        => 'lucide-square-stack',
            'lunar::move-collection'       => 'lucide-move',
            'lunar::currencies'            => 'lucide-circle-dollar-sign',
            'lunar::customers'             => 'lucide-users',
            'lunar::customer-groups'       => 'lucide-users',
            'lunar::dashboard'             => 'lucide-bar-chart-big',
            'lunar::discounts'             => 'lucide-percent-circle',
            'lunar::discount-limitations'  => 'lucide-list-x',
            'lunar::info'                  => 'lucide-info',
            'lunar::languages'             => 'lucide-languages',
            'lunar::media'                 => 'lucide-image',
            'lunar::orders'                => 'lucide-inbox',
            'lunar::product-pricing'       => 'lucide-coins',
            'lunar::product-associations'  => 'lucide-cable',
            'lunar::product-inventory'     => 'lucide-combine',
            'lunar::product-options'       => 'lucide-list',
            'lunar::product-shipping'      => 'lucide-truck',
            'lunar::product-variants'      => 'lucide-shapes',
            'lunar::products'              => 'lucide-tag',
            'lunar::staff'                 => 'lucide-shield',
            'lunar::tags'                  => 'lucide-tags',
            'lunar::tax'                   => 'lucide-landmark',
            'lunar::urls'                  => 'lucide-globe',
            'lunar::product-identifiers'   => 'lucide-package-search',
            'lunar::reorder'               => 'lucide-grip-vertical',
            'lunar::chevron-right'         => 'lucide-chevron-right',
            'lunar::image-placeholder'     => 'lucide-image',
            'lunar::trending-up'           => 'lucide-trending-up',
            'lunar::trending-down'         => 'lucide-trending-down',
            'lunar::exclamation-circle'    => 'lucide-alert-circle',
            'actions::view-action'         => 'lucide-eye',
            'actions::edit-action'         => 'lucide-edit',
            'actions::delete-action'       => 'lucide-trash-2',
        ]);

        return $panel
            ->default()
            ->id('admin')
            ->path('admin')
            ->sidebarCollapsibleOnDesktop()
            ->login()
            ->colors([
                'primary' => [
                    50  => '#fdf2eb',
                    100 => '#fbe2cc',
                    200 => '#f6c39a',
                    300 => '#f0a367',
                    400 => '#e98435',
                    500 => '#df8448',
                    600 => '#c9713a',
                    700 => '#a75d31',
                    800 => '#864b2a',
                    900 => '#6b3e25',
                    950 => '#3a2012',
                ],
                'gray' => Color::Zinc,
            ])
            ->font('Hanken Grotesk')
            ->brandName('PetPosture Admin')
            ->discoverResources(in: app_path('Filament/Resources'), for: 'App\\Filament\\Resources')
            ->resources([
                // Lunar ecommerce resources
                Resources\ActivityResource::class,
                Resources\AttributeGroupResource::class,
                Resources\BrandResource::class,
                Resources\ChannelResource::class,
                Resources\CollectionGroupResource::class,
                Resources\CollectionResource::class,
                Resources\CurrencyResource::class,
                Resources\CustomerGroupResource::class,
                Resources\CustomerResource::class,
                Resources\DiscountResource::class,
                Resources\LanguageResource::class,
                Resources\OrderResource::class,
                Resources\ProductOptionResource::class,
                Resources\ProductResource::class,
                Resources\ProductTypeResource::class,
                Resources\ProductVariantResource::class,
                Resources\TagResource::class,
                Resources\TaxClassResource::class,
                Resources\TaxZoneResource::class,
                Resources\TaxRateResource::class,
            ])
            ->discoverPages(in: app_path('Filament/Pages'), for: 'App\\Filament\\Pages')
            ->pages([
                Pages\Dashboard::class,
            ])
            ->discoverWidgets(in: app_path('Filament/Widgets'), for: 'App\\Filament\\Widgets')
            ->widgets([
                OrderStatsOverview::class,
                OrderTotalsChart::class,
                OrdersSalesChart::class,
                AverageOrderValueChart::class,
                NewVsReturningCustomersChart::class,
                PopularProductsTable::class,
                LatestOrdersTable::class,
            ])
            ->livewireComponents([
                Resources\OrderResource\Pages\Components\OrderItemsTable::class,
                \Lunar\Admin\Filament\Resources\CollectionGroupResource\Widgets\CollectionTreeView::class,
            ])
            ->middleware([
                EncryptCookies::class,
                AddQueuedCookiesToResponse::class,
                StartSession::class,
                \App\Http\Middleware\SetLocale::class,
                AuthenticateSession::class,
                ShareErrorsFromSession::class,
                VerifyCsrfToken::class,
                SubstituteBindings::class,
                DisableBladeIconComponents::class,
                DispatchServingFilamentEvent::class,
            ])
            ->plugins([
                FilamentShieldPlugin::make(),
                FilamentApexChartsPlugin::make(),
            ])
            ->authMiddleware([
                Authenticate::class,
            ]);
    }
}
