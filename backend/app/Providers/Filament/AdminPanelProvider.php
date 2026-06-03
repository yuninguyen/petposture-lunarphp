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
use App\Filament\Widgets\AverageOrderValueChart;
use App\Filament\Widgets\NewVsReturningCustomersChart;
use App\Filament\Widgets\OrdersSalesChart;
use App\Filament\Widgets\EcommerceStatsOverview;
use App\Filament\Widgets\OrderStatusBreakdownChart;
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
            ->brandLogo(fn () => asset('logo.png'))
            ->brandLogoHeight('130px')
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
                    :root{--pp-orange:#df8448;--pp-orange-dk:#c9713a;--pp-orange-glow:rgba(223,132,72,.14);}

                    /* ── Fonts ── */
                    body,button,input,select,textarea{font-family:"Google Sans Flex","Inter",ui-sans-serif,sans-serif!important}

                    /* ── Sidebar ── */
                    nav.fi-sidebar,aside.fi-sidebar{background:#1a2535!important;border-right:none!important;box-shadow:2px 0 20px rgba(0,0,0,.18)!important}
                    nav.fi-sidebar *,aside.fi-sidebar *{border-color:rgba(255,255,255,.06)!important}
                    .fi-sidebar-header{padding:1.25rem 1rem .875rem!important;border-bottom:1px solid rgba(255,255,255,.07)!important}
                    .fi-sidebar-header img{height:130px!important;width:auto!important;max-width:200px!important;object-fit:contain!important;filter:brightness(0) invert(1)!important;padding-top:10px!important}
                    .fi-sidebar-header span{color:#f1f5f9!important}
                    [class*="fi-sidebar-group-label"],[class*="fi-sidebar-nav-label"]{color:rgba(148,163,184,.55)!important;font-size:10px!important;font-weight:800!important;letter-spacing:.18em!important;text-transform:uppercase!important;padding-left:1rem!important}
                    [class*="fi-sidebar-item"] a,[class*="fi-sidebar-item"] button{color:#94a3b8!important;border-radius:8px!important;margin:1px 6px!important;padding:.45rem .875rem!important;font-size:13px!important;font-weight:500!important;transition:background .12s,color .12s!important;display:flex!important;align-items:center!important;gap:.5rem!important}
                    [class*="fi-sidebar-item"] a:hover,[class*="fi-sidebar-item"] button:hover{background:rgba(255,255,255,.07)!important;color:#e2e8f0!important}
                    [class*="fi-sidebar-item"] a[aria-current="page"],[class*="fi-sidebar-item"] button[aria-current="page"]{background:var(--pp-orange-glow)!important;color:var(--pp-orange)!important;font-weight:700!important;border-left:3px solid var(--pp-orange)!important;padding-left:calc(.875rem - 3px)!important}
                    [class*="fi-sidebar-item"] a[aria-current="page"] svg,[class*="fi-sidebar-item"] button[aria-current="page"] svg{color:var(--pp-orange)!important}
                    [class*="fi-sidebar-item"] svg{color:#64748b!important;width:16px!important;height:16px!important}
                    [class*="fi-badge"]{background:var(--pp-orange)!important;color:#fff!important;font-size:10px!important;font-weight:800!important;min-width:18px!important;height:18px!important;padding:0 5px!important;border-radius:99px!important;display:inline-flex!important;align-items:center!important;justify-content:center!important}
                    .fi-sidebar-nav{padding:.5rem 0!important}

                    /* ── Topbar ── */
                    header.fi-topbar{background:#fff!important;border-bottom:1px solid #eef0f3!important;box-shadow:0 1px 4px rgba(0,0,0,.05)!important}

                    /* ── Hide redundant page header ── */
                    .fi-header,.fi-page-header,.fi-simple-page-header{display:none!important}

                    /* ── Page bg ── */
                    main.fi-main,div.fi-main,.fi-main-ctn{background:#f4f6f9!important}

                    /* ── Stat cards ── */
                    [class*="fi-wi-stats-overview-stat"]{background:#fff!important;border:1px solid #eaecf0!important;border-radius:14px!important;box-shadow:0 1px 4px rgba(0,0,0,.05)!important;transition:transform .18s,box-shadow .18s!important}
                    [class*="fi-wi-stats-overview-stat"]:hover{transform:translateY(-2px)!important;box-shadow:0 6px 24px rgba(0,0,0,.09)!important}
                    [class*="fi-wi-stats-overview-stat-value"]{font-size:2.1rem!important;font-weight:800!important;color:#0f172a!important;letter-spacing:-.04em!important;line-height:1!important}
                    [class*="fi-wi-stats-overview-stat-label"]{font-size:11px!important;font-weight:700!important;color:#6b7280!important;text-transform:uppercase!important;letter-spacing:.1em!important}

                    /* ── Sections / cards ── */
                    .fi-section{background:#fff!important;border:1px solid #eaecf0!important;border-radius:14px!important;box-shadow:0 1px 4px rgba(0,0,0,.04)!important}
                    .fi-section-header{border-bottom:1px solid #f1f3f6!important}
                    .fi-section-header-heading{font-size:14px!important;font-weight:700!important;color:#111827!important}

                    /* ── Tables ── */
                    [class*="fi-ta-header-cell"]{font-size:11px!important;font-weight:800!important;text-transform:uppercase!important;letter-spacing:.09em!important;color:#6b7280!important}
                    [class*="fi-ta-row"]:hover td{background:#fafbfc!important}

                    /* ── Primary buttons ── */
                    [class*="fi-btn"][class*="primary"]{background:var(--pp-orange)!important;border-color:var(--pp-orange)!important;border-radius:9px!important;font-weight:700!important;box-shadow:0 2px 8px rgba(223,132,72,.28)!important}
                    [class*="fi-btn"][class*="primary"]:hover{background:var(--pp-orange-dk)!important}

                    /* ── Inputs ── */
                    [class*="fi-input"]{border-radius:9px!important;border-color:#e2e8f0!important}
                    [class*="fi-input"]:focus{border-color:var(--pp-orange)!important;box-shadow:0 0 0 3px var(--pp-orange-glow)!important;outline:none!important}

                    /* ── Tabs ── */
                    [class*="fi-tabs-tab"][aria-selected="true"]{color:var(--pp-orange)!important;background:var(--pp-orange-glow)!important}

                    /* ── Scrollbar ── */
                    ::-webkit-scrollbar{width:5px;height:5px}
                    ::-webkit-scrollbar-track{background:transparent}
                    ::-webkit-scrollbar-thumb{background:#d1d5db;border-radius:9px}

                    @keyframes pp-pulse{0%,100%{opacity:1}50%{opacity:.4}}
                    </style>
                    <script>
                    (function(){
                        function applyTheme(){
                            /* ── Sidebar dark ── */
                            var sidebar = document.querySelector(\'[class*="fi-sidebar"]\') ||
                                          document.querySelector(\'nav\') ||
                                          document.getElementById(\'sidebar\');
                            if(sidebar && !sidebar.dataset.ppStyled){
                                sidebar.dataset.ppStyled="1";
                                sidebar.style.cssText += ";background:linear-gradient(180deg,#1a2535,#1e293b)!important;border-right:none!important;box-shadow:3px 0 20px rgba(0,0,0,.18)!important";
                            }

                            /* ── Sidebar items ── */
                            document.querySelectorAll(\'[class*="fi-sidebar-item"] a,[class*="fi-sidebar-item"] button\').forEach(function(el){
                                if(el.dataset.ppStyled) return;
                                el.dataset.ppStyled="1";
                                el.style.cssText+= ";color:#94a3b8;border-radius:8px;margin:1px 6px;padding:6px 14px;font-size:13px;font-weight:500;display:flex;align-items:center;gap:8px;";
                                if(el.getAttribute("aria-current")==="page"){
                                    el.style.cssText+=";background:rgba(223,132,72,.14);color:#df8448;font-weight:700;border-left:3px solid #df8448;padding-left:11px;";
                                }
                                el.addEventListener("mouseenter",function(){if(this.getAttribute("aria-current")!=="page")this.style.background="rgba(255,255,255,.07)";});
                                el.addEventListener("mouseleave",function(){if(this.getAttribute("aria-current")!=="page")this.style.background="";});
                            });

                            /* ── Sidebar group labels ── */
                            document.querySelectorAll(\'[class*="fi-sidebar-group-label"],[class*="fi-sidebar-nav-label"]\').forEach(function(el){
                                el.style.cssText+=";color:rgba(148,163,184,.55)!important;font-size:10px!important;font-weight:800!important;letter-spacing:.18em!important;text-transform:uppercase!important;";
                            });

                            /* ── Sidebar item SVG icons ── */
                            document.querySelectorAll(\'[class*="fi-sidebar-item"] svg\').forEach(function(el){
                                el.style.cssText+=";color:#64748b;width:15px;height:15px;";
                            });
                            document.querySelectorAll(\'[class*="fi-sidebar-item"] [aria-current="page"] svg\').forEach(function(el){
                                el.style.cssText+=";color:#df8448!important;";
                            });

                            /* ── Sidebar logo ── */
                            var logo = document.querySelector(\'[class*="fi-sidebar-header"] img\');
                            if(logo){logo.style.cssText+=";height:100px;width:auto;max-width:200px;object-fit:contain;filter:brightness(0) invert(1);padding-top:10px;";}

                            /* ── Hide "Dashboard" page heading ── */
                            document.querySelectorAll(\'h1,h2\').forEach(function(el){
                                var txt = el.textContent.trim();
                                if(txt==="Dashboard"||txt==="dashboard"){el.closest(\'[class*="fi-header"],[class*="fi-page-header"],[class*="page-header"]\')
                                    ? el.closest(\'[class*="fi-header"],[class*="fi-page-header"],[class*="page-header"]\').style.display="none"
                                    : el.style.display="none";
                                }
                            });
                        }

                        /* Run immediately + on Livewire navigation */
                        document.addEventListener("DOMContentLoaded", applyTheme);
                        document.addEventListener("livewire:navigated", applyTheme);
                        document.addEventListener("livewire:load", applyTheme);
                        setTimeout(applyTheme, 300);
                        setTimeout(applyTheme, 800);
                    })();
                    </script>',
            )
            ->renderHook(
                'panels::content.before',
                function (): string {
                    $name = auth()->user()->name;
                    $date = ucfirst(now()->translatedFormat('l, j F Y'));

                    return '
                    <div style="display:flex;align-items:center;justify-content:space-between;gap:20px;
                                background:#fff;border:1px solid #eaecf0;border-radius:14px;
                                padding:14px 22px;margin:18px 24px 14px;
                                box-shadow:0 1px 4px rgba(0,0,0,.05);flex-wrap:wrap;">
                        <div>
                            <div style="font-size:18px;font-weight:800;color:#0f172a;letter-spacing:-.03em;line-height:1.25;">
                                ' . __('admin.dashboard.welcome', ['name' => '<span style="color:#df8448;">' . e($name) . '</span>']) . '
                            </div>
                            <div style="display:flex;align-items:center;gap:6px;margin-top:4px;">
                                <span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#34d399;box-shadow:0 0 6px rgba(52,211,153,.65);animation:pp-pulse 2s infinite;"></span>
                                <span style="font-size:12px;font-weight:600;color:#94a3b8;">' . $date . '</span>
                            </div>
                        </div>
                        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                            <a href="/admin/products/create"
                               style="display:inline-flex;align-items:center;gap:7px;padding:8px 16px;
                                      background:#df8448;color:#fff;border-radius:9px;font-size:13px;
                                      font-weight:700;text-decoration:none;box-shadow:0 2px 8px rgba(223,132,72,.3);
                                      transition:background .15s,transform .15s;white-space:nowrap;"
                               onmouseover="this.style.background=\'#c9713a\';this.style.transform=\'translateY(-1px)\'"
                               onmouseout="this.style.background=\'#df8448\';this.style.transform=\'\'">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><path d="M12 5v14M5 12h14"/></svg>
                                ' . __('admin.dashboard.actions.new_product') . '
                            </a>
                            <a href="/admin/orders"
                               style="display:inline-flex;align-items:center;gap:7px;padding:8px 16px;
                                      background:#f8fafc;color:#374151;border:1.5px solid #e2e8f0;border-radius:9px;
                                      font-size:13px;font-weight:700;text-decoration:none;white-space:nowrap;
                                      transition:background .15s,transform .15s;"
                               onmouseover="this.style.background=\'#f1f5f9\';this.style.transform=\'translateY(-1px)\'"
                               onmouseout="this.style.background=\'#f8fafc\';this.style.transform=\'\'">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;opacity:.7"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
                                ' . __('admin.dashboard.actions.orders') . '
                            </a>
                            <a href="/admin/customers"
                               style="display:inline-flex;align-items:center;gap:7px;padding:8px 16px;
                                      background:#f8fafc;color:#374151;border:1.5px solid #e2e8f0;border-radius:9px;
                                      font-size:13px;font-weight:700;text-decoration:none;white-space:nowrap;
                                      transition:background .15s,transform .15s;"
                               onmouseover="this.style.background=\'#f1f5f9\';this.style.transform=\'translateY(-1px)\'"
                               onmouseout="this.style.background=\'#f8fafc\';this.style.transform=\'\'">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;opacity:.7"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                                ' . __('admin.dashboard.actions.customers') . '
                            </a>
                            <a href="/admin/discounts"
                               style="display:inline-flex;align-items:center;gap:7px;padding:8px 16px;
                                      background:#f8fafc;color:#374151;border:1.5px solid #e2e8f0;border-radius:9px;
                                      font-size:13px;font-weight:700;text-decoration:none;white-space:nowrap;
                                      transition:background .15s,transform .15s;"
                               onmouseover="this.style.background=\'#f1f5f9\';this.style.transform=\'translateY(-1px)\'"
                               onmouseout="this.style.background=\'#f8fafc\';this.style.transform=\'\'">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;opacity:.7"><circle cx="12" cy="12" r="10"/><path d="M14.5 9.5 9.5 14.5M9.5 9.5h.01M14.5 14.5h.01"/></svg>
                                ' . __('admin.dashboard.actions.discounts') . '
                            </a>
                        </div>
                    </div>';
                },
            )
            // ->discoverWidgets(in: app_path('Filament\\Widgets'), for: 'App\\Filament\\Widgets')
            ->widgets([
                EcommerceStatsOverview::class,
                OrderStatusBreakdownChart::class,
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
                AuthenticateSession::class,
                ShareErrorsFromSession::class,
                VerifyCsrfToken::class,
                SubstituteBindings::class,
                DisableBladeIconComponents::class,
                DispatchServingFilamentEvent::class,
                \App\Http\Middleware\SetLocale::class,
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
