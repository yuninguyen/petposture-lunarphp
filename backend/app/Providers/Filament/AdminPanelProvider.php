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
            ->brandName('PetPosture')
            ->brandLogo(asset('logo.png'))
            ->brandLogoHeight('36px')
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
                    <style>
                    :root{--brand-slate:#1e293b;--brand-orange:#df8448;--brand-orange-dark:#c9713a;--brand-orange-glow:rgba(223,132,72,0.15);}
                    *{font-family:"Google Sans Flex","Inter",sans-serif!important}
                    code,pre,.font-mono{font-family:"Fira Code",monospace!important}

                    /* Sidebar */
                    .fi-sidebar{background:linear-gradient(180deg,#1a2535 0%,#1e293b 100%)!important;border-right:none!important;box-shadow:4px 0 24px rgba(0,0,0,.15)!important}
                    .fi-sidebar-group-label,.fi-sidebar-nav-label{color:rgba(148,163,184,.6)!important;font-size:10px!important;font-weight:800!important;letter-spacing:.15em!important;text-transform:uppercase!important}
                    .fi-sidebar-item-button,.fi-sidebar-nav-link{color:#94a3b8!important;border-radius:8px!important;margin:1px 8px!important;padding:.5rem .75rem!important;transition:all .15s ease!important;font-size:13.5px!important;font-weight:500!important}
                    .fi-sidebar-item-button:hover,.fi-sidebar-nav-link:hover{background:rgba(255,255,255,.06)!important;color:#e2e8f0!important}
                    .fi-sidebar-item-button[aria-current=page],.fi-sidebar-nav-link-active{background:var(--brand-orange-glow)!important;color:var(--brand-orange)!important;font-weight:700!important;border-left:3px solid var(--brand-orange)!important}
                    .fi-sidebar-item-badge{background:var(--brand-orange)!important;color:#fff!important;font-size:10px!important;font-weight:800!important;border-radius:99px!important}
                    .fi-sidebar-header img{max-height:32px!important;width:auto!important;filter:brightness(0) invert(1)}

                    /* Topbar */
                    .fi-topbar{background:#fff!important;border-bottom:1px solid #f1f5f9!important;box-shadow:0 1px 3px rgba(0,0,0,.04)!important}

                    /* Page header — hide redundant "Dashboard" title */
                    .fi-page-header{display:none!important}
                    .fi-header{display:none!important}

                    /* Main bg */
                    .fi-main,.fi-main-ctn{background:#f8fafc!important}

                    /* Stat cards */
                    .fi-wi-stats-overview-stat{border-radius:14px!important;border:1px solid #e8edf2!important;background:#fff!important;box-shadow:0 1px 3px rgba(0,0,0,.04),0 4px 16px rgba(0,0,0,.03)!important;transition:box-shadow .2s ease,transform .2s ease!important}
                    .fi-wi-stats-overview-stat:hover{box-shadow:0 4px 20px rgba(0,0,0,.08)!important;transform:translateY(-1px)!important}
                    .fi-wi-stats-overview-stat-value{font-size:2rem!important;font-weight:800!important;color:#0f172a!important;letter-spacing:-.03em!important;line-height:1.1!important}
                    .fi-wi-stats-overview-stat-label{font-size:11.5px!important;font-weight:700!important;color:#64748b!important;text-transform:uppercase!important;letter-spacing:.08em!important}

                    /* Cards / sections */
                    .fi-section,.fi-wi-chart,.fi-ta-ctn{border-radius:14px!important;border:1px solid #e8edf2!important;background:#fff!important;box-shadow:0 1px 3px rgba(0,0,0,.04)!important}
                    .fi-section-header-heading{font-weight:700!important;font-size:15px!important;color:#0f172a!important}

                    /* Tables */
                    .fi-ta-header-cell{font-size:11px!important;font-weight:800!important;text-transform:uppercase!important;letter-spacing:.08em!important;color:#64748b!important}

                    /* Buttons */
                    .fi-btn-primary{background:var(--brand-orange)!important;border-color:var(--brand-orange)!important;border-radius:10px!important;font-weight:700!important}
                    .fi-btn-primary:hover{background:var(--brand-orange-dark)!important}

                    /* Inputs */
                    .fi-input{border-radius:10px!important;border:1.5px solid #e2e8f0!important}
                    .fi-input:focus{border-color:var(--brand-orange)!important;box-shadow:0 0 0 3px var(--brand-orange-glow)!important}

                    /* Tabs */
                    .fi-tabs-tab[aria-selected=true]{color:var(--brand-orange)!important;background:var(--brand-orange-glow)!important}

                    /* Badges */
                    .fi-badge{font-size:11px!important;font-weight:700!important;border-radius:6px!important}

                    /* ApexCharts */
                    .apexcharts-toolbar{display:none!important}

                    /* Dashboard header */
                    .pp-dashboard-header{display:flex;align-items:center;justify-content:space-between;gap:1.5rem;padding:1.1rem 1.5rem;margin:1rem 1.5rem .75rem;background:#fff;border:1px solid #e8edf2;border-radius:14px;box-shadow:0 1px 4px rgba(0,0,0,.04)}
                    .pp-dashboard-header__greeting{font-size:19px;font-weight:800;color:#0f172a;letter-spacing:-.03em;line-height:1.2}
                    .pp-dashboard-header__greeting strong{color:var(--brand-orange);font-weight:900}
                    .pp-dashboard-header__meta{display:flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:#94a3b8;margin-top:3px}
                    .pp-live-dot{display:inline-block;width:7px;height:7px;border-radius:50%;background:#34d399;box-shadow:0 0 6px rgba(52,211,153,.7);animation:pp-pulse 2s infinite}
                    @keyframes pp-pulse{0%,100%{opacity:1}50%{opacity:.45}}
                    .pp-dashboard-header__actions{display:flex;align-items:center;gap:8px}
                    .pp-action{display:inline-flex;align-items:center;gap:6px;padding:8px 15px;border-radius:9px;font-size:12.5px;font-weight:700;text-decoration:none!important;transition:all .15s ease;white-space:nowrap;cursor:pointer}
                    .pp-action--primary{background:var(--brand-orange);color:#fff!important;box-shadow:0 2px 8px rgba(223,132,72,.3)}
                    .pp-action--primary:hover{background:var(--brand-orange-dark);transform:translateY(-1px);box-shadow:0 4px 14px rgba(223,132,72,.4);color:#fff!important}
                    .pp-action--ghost{background:#f8fafc;color:#475569!important;border:1.5px solid #e2e8f0}
                    .pp-action--ghost:hover{background:#f1f5f9;border-color:#cbd5e1;color:#1e293b!important;transform:translateY(-1px)}
                    .pp-action svg{flex-shrink:0;opacity:.8}

                    /* Scrollbar */
                    ::-webkit-scrollbar{width:5px;height:5px}
                    ::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:99px}
                    ::-webkit-scrollbar-thumb:hover{background:#94a3b8}

                    @media(max-width:1024px){
                        .pp-dashboard-header{flex-direction:column;align-items:flex-start}
                        .pp-dashboard-header__actions{flex-wrap:wrap}
                    }
                    </style>',
            )
            ->renderHook(
                'panels::content.before',
                fn (): string => '
                    <div class="pp-dashboard-header">
                        <div class="pp-dashboard-header__left">
                            <div class="pp-dashboard-header__greeting">
                                ' . str_replace(':name', '<strong>' . auth()->user()->name . '</strong>', __('admin.dashboard.welcome', ['name' => ':name'])) . '
                            </div>
                            <div class="pp-dashboard-header__meta">
                                <span class="pp-live-dot"></span>
                                ' . ucfirst(now()->translatedFormat('l, j F Y')) . '
                            </div>
                        </div>
                        <div class="pp-dashboard-header__actions">
                            <a href="/admin/products/create" class="pp-action pp-action--primary">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>
                                New Product
                            </a>
                            <a href="/admin/orders" class="pp-action pp-action--ghost">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
                                Orders
                            </a>
                            <a href="/admin/customers" class="pp-action pp-action--ghost">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                                Customers
                            </a>
                            <a href="/admin/discounts" class="pp-action pp-action--ghost">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M14.5 9.5 9.5 14.5M9.5 9.5h.01M14.5 14.5h.01"/></svg>
                                Discounts
                            </a>
                        </div>
                    </div>',
            )
            // ->discoverWidgets(in: app_path('Filament\\Widgets'), for: 'App\\Filament\\Widgets')
            ->widgets([
                EcommerceStatsOverview::class,
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
