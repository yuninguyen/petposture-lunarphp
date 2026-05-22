<?php

namespace App\Providers\Filament;

use BezhanSalleh\FilamentShield\FilamentShieldPlugin;
use Filament\Http\Middleware\Authenticate;
use Filament\Http\Middleware\DisableBladeIconComponents;
use Filament\Http\Middleware\DispatchServingFilamentEvent;
use Filament\Pages;
use Filament\Panel;
use Filament\PanelProvider;
use Filament\Navigation\NavigationGroup;
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
use App\Filament\Widgets\AverageOrderValueChart;
use App\Filament\Widgets\NewVsReturningCustomersChart;
use App\Filament\Widgets\OrdersSalesChart;
use App\Filament\Widgets\EcommerceStatsOverview;
use App\Filament\Widgets\OrderTotalsChart;
use Lunar\Admin\Filament\Widgets\Dashboard\Orders\LatestOrdersTable;
use Lunar\Admin\Filament\Widgets\Dashboard\Orders\OrderStatsOverview;
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
                'gray' => Color::Slate,
            ])
            ->font('Google Sans Flex')
            ->brandName('PetPosture Admin')
            ->navigationGroups([
                __('lunarpanel::global.sections.catalog'),
                __('lunarpanel::global.sections.sales'),
                __('Content Management'),
                __('System'),
                __('filament-shield::filament-shield.nav.group'),
                __('lunarpanel::global.sections.settings'),
            ])
            ->discoverResources(in: app_path('Filament/Resources'), for: 'App\\Filament\\Resources')
            ->resources([
                // Lunar ecommerce resources
                Resources\ActivityResource::class,
                Resources\BrandResource::class,
                Resources\ChannelResource::class,
                Resources\CollectionGroupResource::class,
                Resources\CollectionResource::class,
                Resources\CurrencyResource::class,
                Resources\DiscountResource::class,
                Resources\LanguageResource::class,
                Resources\OrderResource::class,
                Resources\ProductResource::class,
                Resources\ProductTypeResource::class,
                Resources\ProductVariantResource::class,
                Resources\TaxClassResource::class,
                Resources\TaxZoneResource::class,
                Resources\TaxRateResource::class,
            ])
            ->discoverPages(in: app_path('Filament/Pages'), for: 'App\\Filament\\Pages')
            ->pages([
                Pages\Dashboard::class,
            ])
            ->renderHook(
                'panels::head.done',
                fn (): string => '
                    <link rel="preconnect" href="https://fonts.googleapis.com">
                    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
                    <link href="https://fonts.googleapis.com/css2?family=Google+Sans+Flex:opsz,wght@6..144,100..1000&family=Fira+Code:wght@400;500;600;700&display=swap" rel="stylesheet">
                    <link rel="stylesheet" href="' . asset('css/custom-theme.css') . '">',
            )
            ->renderHook(
                'panels::content.before',
                fn (): string => '
                    <div class="dashboard-welcome-container mx-4 md:mx-6 lg:mx-8 mt-4 mb-6 px-6 py-5">
                        <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                            <div class="flex-1 min-w-0">
                                <p class="text-[11px] font-black uppercase tracking-[0.2em] text-orange-400 mb-2">
                                    ' . ucfirst(now()->translatedFormat('l, j F Y')) . '
                                </p>
                                <h1 class="text-2xl md:text-3xl font-black text-slate-900 leading-tight" style="letter-spacing:-0.03em">
                                    ' . str_replace(':name', '<span style="color:var(--brand-orange)">' . auth()->user()->name . '</span>', __('admin.dashboard.welcome', ['name' => ':name'])) . '
                                </h1>
                                <p class="text-sm text-slate-400 mt-1 font-medium">
                                    ' . __('admin.dashboard.subtitle') . '
                                </p>
                            </div>
                            <div class="flex items-center gap-3 shrink-0">
                                <a href="/admin/products/create" class="quick-action-btn quick-action-btn-primary">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
                                    Add Product
                                </a>
                                <a href="/admin/orders" class="quick-action-btn quick-action-btn-secondary">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
                                    Orders
                                </a>
                                <a href="/admin/customers" class="quick-action-btn quick-action-btn-secondary">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                                    Customers
                                </a>
                                <div class="flex items-center gap-1.5 ml-2 pl-3 border-l border-slate-200">
                                    <div class="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]"></div>
                                    <span class="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em]">Live</span>
                                </div>
                            </div>
                        </div>
                    </div>',
            )
            // ->discoverWidgets(in: app_path('Filament\\Widgets'), for: 'App\\Filament\\Widgets')
            ->widgets([
                EcommerceStatsOverview::class,
                OrderStatsOverview::class,
                OrdersSalesChart::class,
                OrderTotalsChart::class,
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
