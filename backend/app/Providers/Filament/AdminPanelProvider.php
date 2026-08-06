<?php

namespace App\Providers\Filament;

use App\Filament\Pages\Dashboard;
use App\Filament\Widgets\EcommerceStatsOverview;
use App\Filament\Widgets\LatestOrdersTable;
use App\Filament\Widgets\OrderPipelineWidget;
use App\Filament\Widgets\PendingReturnRequestsWidget;
use App\Filament\Widgets\RecentActivityWidget;
use App\Filament\Widgets\SalesByCategoryChart;
use App\Filament\Widgets\SalesOverviewChart;
use App\Filament\Widgets\SalesSidebarWidget;
use App\Filament\Widgets\SiteOverviewStatsWidget;
use App\Filament\Widgets\TopProductsWidget;
use App\Http\Middleware\SetLocale;
use App\Models\Setting;
use BezhanSalleh\FilamentShield\FilamentShieldPlugin;
use Filament\Actions\DeleteAction;
use Filament\Actions\EditAction;
use Filament\Http\Middleware\Authenticate;
use Filament\Http\Middleware\DisableBladeIconComponents;
use Filament\Http\Middleware\DispatchServingFilamentEvent;
use Filament\Panel;
use Filament\PanelProvider;
use Filament\Support\Colors\Color;
use Filament\Support\Facades\FilamentIcon;
use Filament\Support\Facades\FilamentView;
use Filament\View\PanelsRenderHook;
use Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse;
use Illuminate\Cookie\Middleware\EncryptCookies;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;
use Illuminate\Routing\Middleware\SubstituteBindings;
use Illuminate\Session\Middleware\AuthenticateSession;
use Illuminate\Session\Middleware\StartSession;
use Illuminate\View\Middleware\ShareErrorsFromSession;
use Leandrocfe\FilamentApexCharts\FilamentApexChartsPlugin;
use Livewire\Livewire;
use Lunar\Admin\Filament\Resources;
use Lunar\Admin\Filament\Resources\CollectionGroupResource\Widgets\CollectionTreeView;

class AdminPanelProvider extends PanelProvider
{
    public function panel(Panel $panel): Panel
    {
        // Sync every header Edit/Delete action panel-wide: outlined + brand orange
        // for Edit, outlined + red for Delete. Applies to Filament\Actions\EditAction
        // and DeleteAction wherever used (local resources and Lunar's own vendor
        // pages alike) — table row actions use a different class and are untouched.
        EditAction::configureUsing(
            fn (EditAction $action) => $action
                ->icon('heroicon-o-pencil-square')
                ->color('primary')
                ->outlined()
        );
        DeleteAction::configureUsing(
            fn (DeleteAction $action) => $action
                ->icon('heroicon-o-trash')
                ->color('danger')
                ->outlined()
        );

        FilamentView::registerRenderHook(
            'panels::global-search.after',
            fn (): string => Livewire::mount('language-switcher'),
        );

        FilamentIcon::register([
            'lunar::activity' => 'lucide-activity',
            'lunar::attributes' => 'lucide-pencil-ruler',
            'lunar::availability' => 'lucide-calendar',
            'lunar::basic-information' => 'lucide-edit',
            'lunar::brands' => 'lucide-badge-check',
            'lunar::channels' => 'lucide-store',
            'lunar::collections' => 'lucide-blocks',
            'lunar::sub-collection' => 'lucide-square-stack',
            'lunar::move-collection' => 'lucide-move',
            'lunar::currencies' => 'lucide-circle-dollar-sign',
            'lunar::customers' => 'lucide-users',
            'lunar::customer-groups' => 'lucide-users',
            'lunar::dashboard' => 'lucide-bar-chart-big',
            'lunar::discounts' => 'lucide-percent-circle',
            'lunar::discount-limitations' => 'lucide-list-x',
            'lunar::info' => 'lucide-info',
            'lunar::languages' => 'lucide-languages',
            'lunar::media' => 'lucide-image',
            'lunar::orders' => 'lucide-inbox',
            'lunar::product-pricing' => 'lucide-coins',
            'lunar::product-associations' => 'lucide-cable',
            'lunar::product-inventory' => 'lucide-combine',
            'lunar::product-options' => 'lucide-list',
            'lunar::product-shipping' => 'lucide-truck',
            'lunar::product-variants' => 'lucide-shapes',
            'lunar::products' => 'lucide-tag',
            'lunar::staff' => 'lucide-shield',
            'lunar::tags' => 'lucide-tags',
            'lunar::tax' => 'lucide-landmark',
            'lunar::urls' => 'lucide-globe',
            'lunar::product-identifiers' => 'lucide-package-search',
            'lunar::reorder' => 'lucide-grip-vertical',
            'lunar::chevron-right' => 'lucide-chevron-right',
            'lunar::image-placeholder' => 'lucide-image',
            'lunar::trending-up' => 'lucide-trending-up',
            'lunar::trending-down' => 'lucide-trending-down',
            'lunar::exclamation-circle' => 'lucide-alert-circle',
            'actions::view-action' => 'lucide-eye',
            'actions::edit-action' => 'lucide-edit',
            'actions::delete-action' => 'lucide-trash-2',
        ]);

        return $panel
            ->default()
            ->id('admin')
            ->path('admin')
            ->sidebarCollapsibleOnDesktop()
            ->login()
            ->colors([
                'primary' => [
                    50 => '#fdf2eb',
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
            ->font('Public Sans')
            ->brandName('PetPosture')
            ->brandLogo(fn () => Setting::get('shop_logo')
                ? asset('storage/'.Setting::get('shop_logo'))
                : asset('logo.png'))
            ->brandLogoHeight('45px')
            ->favicon(fn () => Setting::get('shop_favicon')
                ? asset('storage/'.Setting::get('shop_favicon'))
                : asset('favicon.ico'))
            ->navigationGroups([
                __('lunarpanel::global.sections.catalog'),
                __('lunarpanel::global.sections.sales'),
                __('Content Management'),
                __('Finance'),
                __('System'),
                __('lunarpanel::global.sections.settings'),
            ])
            ->discoverResources(in: app_path('Filament/Resources'), for: 'App\\Filament\\Resources')
            ->resources([
                // Lunar ecommerce resources
                Resources\ActivityResource::class,
                Resources\BrandResource::class,
                Resources\ChannelResource::class,
                Resources\CollectionResource::class,
                Resources\CurrencyResource::class,
                Resources\DiscountResource::class,
                Resources\LanguageResource::class,
                Resources\ProductTypeResource::class,
                Resources\ProductVariantResource::class,
                Resources\TaxClassResource::class,
                Resources\TaxZoneResource::class,
                Resources\TaxRateResource::class,
            ])
            ->discoverPages(in: app_path('Filament/Pages'), for: 'App\\Filament\\Pages')
            ->renderHook(
                PanelsRenderHook::HEAD_END,
                fn (): string => '
                    <style>
                    :root{--pp-orange:#df8448;--pp-orange-dk:#c9713a;--pp-orange-glow:rgba(223,132,72,.14);}

                    /* ── Fonts ── */
                    body,button,input,select,textarea{font-family:"Public Sans","Public Sans Fallback",ui-sans-serif,sans-serif!important}

                    /* ── Sidebar (Haze-matched: flat charcoal-navy #1c252e, real fi-sidebar-item-* classes) ── */
                    nav.fi-sidebar,aside.fi-sidebar{background:#1c252e!important;border-right:none!important;box-shadow:none!important}
                    nav.fi-sidebar *,aside.fi-sidebar *{border-color:rgba(255,255,255,.05)!important}
                    header.fi-sidebar-header,.fi-sidebar-header{background:transparent!important;height:auto!important;min-height:4rem!important;padding:.85rem 1.1rem!important;border-bottom:none!important;display:flex!important;align-items:center!important}
                    img.fi-logo{height:32px!important;width:auto!important;max-width:160px!important;object-fit:contain!important;display:block!important}
                    .fi-sidebar-header span{color:#f8fafc!important;font-weight:700!important}
                    [class*="fi-sidebar-group-label"],[class*="fi-sidebar-nav-label"]{color:rgba(148,163,184,.5)!important;font-size:12.5px!important;font-weight:500!important;letter-spacing:normal!important;text-transform:uppercase!important;padding:1.1rem 1.1rem .4rem .2rem!important}

                    nav.fi-sidebar .fi-sidebar-item-button,aside.fi-sidebar .fi-sidebar-item-button{color:#8b93a0!important;border-radius:10px!important;margin:1px 0!important;padding:.5rem .75rem!important;transition:background .12s,color .12s!important}
                    nav.fi-sidebar .fi-sidebar-item-button:hover,aside.fi-sidebar .fi-sidebar-item-button:hover,nav.fi-sidebar .fi-sidebar-item-button:focus-visible,aside.fi-sidebar .fi-sidebar-item-button:focus-visible{background:rgba(255,255,255,.06)!important;color:#f1f4f8!important}
                    nav.fi-sidebar .fi-sidebar-item-icon,aside.fi-sidebar .fi-sidebar-item-icon{color:#6b7280!important;width:16px!important;height:16px!important}
                    nav.fi-sidebar .fi-sidebar-item-label,aside.fi-sidebar .fi-sidebar-item-label{color:inherit!important;font-size:13.5px!important;font-weight:500!important}

                    nav.fi-sidebar .fi-sidebar-item-active .fi-sidebar-item-button,aside.fi-sidebar .fi-sidebar-item-active .fi-sidebar-item-button{background:#26313c!important;color:#fff!important}
                    nav.fi-sidebar .fi-sidebar-item-active .fi-sidebar-item-icon,aside.fi-sidebar .fi-sidebar-item-active .fi-sidebar-item-icon{color:#fff!important}
                    nav.fi-sidebar .fi-sidebar-item-active .fi-sidebar-item-label,aside.fi-sidebar .fi-sidebar-item-active .fi-sidebar-item-label{color:#fff!important;font-weight:600!important}

                    nav.fi-sidebar .fi-sidebar-item [class*="fi-badge"],aside.fi-sidebar .fi-sidebar-item [class*="fi-badge"]{background:var(--pp-orange)!important;color:#fff!important;font-size:10px!important;font-weight:800!important;min-width:18px!important;height:18px!important;padding:0 5px!important;border-radius:99px!important;display:inline-flex!important;align-items:center!important;justify-content:center!important}
                    .fi-sidebar-nav{padding:.4rem .75rem 1rem!important}
                    aside.fi-sidebar ::-webkit-scrollbar-thumb,nav.fi-sidebar ::-webkit-scrollbar-thumb{background:rgba(255,255,255,.16)!important}
                    aside.fi-sidebar ::-webkit-scrollbar-track,nav.fi-sidebar ::-webkit-scrollbar-track{background:transparent!important}

                    /* ── Widget height fill (grid already stretches .fi-wi-widget to row height; make the visible card fill it) ── */
                    .fi-wi-widget{height:100%!important;display:flex!important;flex-direction:column!important}
                    .fi-wi-widget>.fi-section{flex:1!important;min-height:0!important}
                    .fi-wi-widget.fi-wi-table>.fi-ta{flex:1!important;display:flex!important;flex-direction:column!important;min-height:0!important}
                    .fi-wi-widget.fi-wi-table .fi-ta-ctn{flex:1!important;display:flex!important;flex-direction:column!important}

                    /* ── Topbar ── */
                    header.fi-topbar{background:#fff!important;border-bottom:1px solid #eef0f3!important;box-shadow:0 1px 4px rgba(0,0,0,.05)!important}

                    /* ── Page bg ── */
                    main.fi-main,div.fi-main,.fi-main-ctn{background:#f4f6f9!important}

                    /* ── Stat cards ── */
                    .fi-wi-stats-overview-stat{background:#fff!important;border:1px solid #eaecf0!important;border-radius:14px!important;box-shadow:0 1px 4px rgba(0,0,0,.05)!important;transition:transform .18s,box-shadow .18s!important}
                    .fi-wi-stats-overview-stat:hover{transform:translateY(-2px)!important;box-shadow:0 6px 24px rgba(0,0,0,.09)!important}
                    .fi-wi-stats-overview-stat-value{font-size:1.8rem!important;font-weight:650!important;color:#0f172a!important;letter-spacing:-.04em!important;line-height:1!important}
                    .fi-wi-stats-overview-stat-label{font-size:13px!important;font-weight:500!important;color:#6b7280!important;text-transform:capitalize!important;letter-spacing:normal!important}

                    /* ── Sections / cards ── */
                    .fi-section{background:#fff!important;border:1px solid #eaecf0!important;border-radius:14px!important;box-shadow:0 1px 4px rgba(0,0,0,.04)!important}
                    .fi-section-header{border-bottom:1px solid #f1f3f6!important}
                    .fi-section-header-heading,.fi-ta-header-heading,.filament-apex-charts-heading{font-size:14px!important;font-weight:700!important;color:#111827!important;font-family:"Public Sans","Public Sans Fallback",ui-sans-serif,sans-serif!important}

                    /* ── Tables ── */
                    [class*="fi-ta-header-cell"]{font-size:13px!important;font-weight:600!important;text-transform:capitalize!important;color:#6b7280!important}
                    [class*="fi-ta-row"]:hover td{background:#fafbfc!important}

                    /* ── Table row actions: icon-only (label hidden, kept in DOM for screen readers) ── */
                    .fi-ta-actions{gap:.25rem!important}
                    .fi-ta-actions .fi-link{padding:.4rem!important;border-radius:8px!important;gap:0!important}
                    .fi-ta-actions .fi-link:hover{background:rgba(0,0,0,.045)!important}
                    .fi-ta-actions .fi-link>span{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important;border:0!important}

                    /* ── Primary buttons (solid CTAs only — outlined actions like Edit keep their border-only look) ── */
                    [class*="fi-btn"][class*="primary"]:not(.fi-btn-outlined){background:var(--pp-orange)!important;border-color:var(--pp-orange)!important;border-radius:9px!important;font-weight:700!important;box-shadow:0 2px 8px rgba(223,132,72,.28)!important}
                    [class*="fi-btn"][class*="primary"]:not(.fi-btn-outlined):hover{background:var(--pp-orange-dk)!important}
                    .fi-btn-outlined{border-radius:9px!important;font-weight:500!important}

                    /* ── Inputs ── */
                    [class*="fi-input"]{border-radius:9px!important;border-color:#e2e8f0!important}
                    [class*="fi-input"]:focus{border-color:var(--pp-orange)!important;box-shadow:0 0 0 3px var(--pp-orange-glow)!important;outline:none!important}

                    /* ── Multi-select tag chips (Choices.js) — smaller, more compact ── */
                    .choices__inner{display:flex!important;flex-wrap:wrap!important;align-items:center!important;gap:4px!important;min-height:auto!important;padding:5px 6px!important}
                    .choices__list--multiple{display:flex!important;flex-wrap:wrap!important;gap:4px!important;flex:0 1 auto!important}
                    .choices__list--multiple .choices__item{font-size:13px!important;font-weight:400!important;padding:2px 6px!important;height:auto!important;line-height:18px!important;border-radius:6px!important}
                    .choices__button{margin-left:6px!important}
                    .choices__input{flex:1 1 auto!important;width:auto!important;min-width:80px!important;margin:0!important;font-size:14px!important}
                    .choices__list--dropdown .choices__item{font-size:14px!important;font-weight:400!important;padding:8px 12px!important}

                    /* ── Tabs ── */
                    [class*="fi-tabs-tab"][aria-selected="true"]{color:var(--pp-orange)!important;background:var(--pp-orange-glow)!important}

                    /* ── Apex chart period pill filter ── */
                    .apex-charts-single-filter{border-radius:999px!important;border:1px solid #e2e8f0!important;font-size:13px!important;font-weight:600!important;padding:.5rem 2rem .5rem 1.1rem!important;background-color:#fff!important;color:#374151!important;box-shadow:0 1px 2px rgba(0,0,0,.04)!important;cursor:pointer!important}
                    .apex-charts-single-filter:hover{border-color:#d7dbe1!important}
                    .apex-charts-single-filter:focus{border-color:var(--pp-orange)!important;box-shadow:0 0 0 3px var(--pp-orange-glow)!important;outline:none!important}

                    /* ── Scrollbar ── */
                    ::-webkit-scrollbar{width:5px;height:5px}
                    ::-webkit-scrollbar-track{background:transparent}
                    ::-webkit-scrollbar-thumb{background:#d1d5db;border-radius:9px}

                    @keyframes pp-pulse{0%,100%{opacity:1}50%{opacity:.4}}
                    </style>
                    <script>
                    (function(){
                        function ppSafe(fn){
                            try { fn(); } catch (e) { console.warn(\'[PetPosture theme]\', e); }
                        }

                        function ppHideDashboardHeading(){
                            document.querySelectorAll(\'h1,h2\').forEach(function(el){
                                var txt = el.textContent.trim();
                                if(txt==="Dashboard"||txt==="dashboard"){
                                    var wrap = el.closest(\'[class*="fi-header"],[class*="fi-page-header"],[class*="page-header"]\');
                                    (wrap || el).style.setProperty(\'display\', \'none\', \'important\');
                                }
                            });
                        }

                        function applyTheme(){
                            ppSafe(ppHideDashboardHeading);
                        }

                        /* Run immediately + on Livewire navigation */
                        document.addEventListener("DOMContentLoaded", applyTheme);
                        document.addEventListener("livewire:navigated", applyTheme);
                        document.addEventListener("livewire:load", applyTheme);
                        setTimeout(applyTheme, 300);
                        setTimeout(applyTheme, 800);
                        setTimeout(applyTheme, 1500);

                        /* Safety net: keep re-applying if Livewire re-renders parts of the shell later */
                        if(window.MutationObserver){
                            var ppMutationTimer = null;
                            var mo = new MutationObserver(function(){
                                clearTimeout(ppMutationTimer);
                                ppMutationTimer = setTimeout(applyTheme, 150);
                            });
                            document.addEventListener("DOMContentLoaded", function(){
                                mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
                            });
                        }
                    })();
                    </script>',
            )
            ->renderHook(
                'panels::content.before',
                function (): string {
                    $name = auth()->user()->name;
                    $date = ucfirst(now()->translatedFormat('l, j F Y'));

                    return '
                    <style>
                    .pp-banner{display:flex;align-items:center;justify-content:space-between;gap:16px;background:#fff;border:1px solid #eaecf0;border-radius:14px;padding:14px 22px;margin:18px 24px 14px;box-shadow:0 1px 4px rgba(0,0,0,.05);flex-wrap:wrap;}
                    .pp-banner-title{font-size:18px;font-weight:650;color:#0f172a;letter-spacing:0.01em;line-height:1.25;}
                    .pp-banner-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;width:100%;}
                    .pp-btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:9px 14px;border-radius:9px;font-size:13px;font-weight:600;text-decoration:none;white-space:nowrap;transition:background .15s,transform .15s;}
                    .pp-btn-primary{background:#df8448;color:#fff;box-shadow:0 2px 8px rgba(223,132,72,.3);}
                    .pp-btn-secondary{background:#f8fafc;color:#374151;border:1.5px solid #e2e8f0;}
                    @media(min-width:640px){
                        .pp-banner{flex-wrap:nowrap;}
                        .pp-banner-actions{display:flex;flex-wrap:wrap;width:auto;}
                    }
                    </style>
                    <div class="pp-banner">
                        <div style="min-width:0">
                            <div class="pp-banner-title">
                                '.__('admin.dashboard.welcome', ['name' => '<span style="color:#df8448;">'.e($name).'</span>']).'
                            </div>
                            <div style="display:flex;align-items:center;gap:6px;margin-top:4px;">
                                <span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#34d399;box-shadow:0 0 6px rgba(52,211,153,.65);animation:pp-pulse 2s infinite;flex-shrink:0"></span>
                                <span style="font-size:12px;font-weight:500;color:#94a3b8;">'.$date.'</span>
                            </div>
                        </div>
                        <div class="pp-banner-actions">
                            <a href="/admin/products?mountedActions[0]=create" class="pp-btn pp-btn-primary"
                               onmouseover="this.style.background=\'#c9713a\'" onmouseout="this.style.background=\'#df8448\'">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><path d="M12 5v14M5 12h14"/></svg>
                                '.__('admin.dashboard.actions.new_product').'
                            </a>
                            <a href="/admin/orders" class="pp-btn pp-btn-secondary"
                               onmouseover="this.style.background=\'#f1f5f9\'" onmouseout="this.style.background=\'#f8fafc\'">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;opacity:.7"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
                                '.__('admin.dashboard.actions.orders').'
                            </a>
                            <a href="/admin/customers" class="pp-btn pp-btn-secondary"
                               onmouseover="this.style.background=\'#f1f5f9\'" onmouseout="this.style.background=\'#f8fafc\'">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;opacity:.7"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                                '.__('admin.dashboard.actions.customers').'
                            </a>
                            <a href="/admin/discounts" class="pp-btn pp-btn-secondary"
                               onmouseover="this.style.background=\'#f1f5f9\'" onmouseout="this.style.background=\'#f8fafc\'">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;opacity:.7"><circle cx="12" cy="12" r="10"/><path d="M14.5 9.5 9.5 14.5M9.5 9.5h.01M14.5 14.5h.01"/></svg>
                                '.__('admin.dashboard.actions.discounts').'
                            </a>
                        </div>
                    </div>';
                },
                scopes: [Dashboard::class],
            )
            // ->discoverWidgets(in: app_path('Filament\\Widgets'), for: 'App\\Filament\\Widgets')
            ->widgets([
                SiteOverviewStatsWidget::class,
                EcommerceStatsOverview::class,
                PendingReturnRequestsWidget::class,
                SalesOverviewChart::class,
                SalesSidebarWidget::class,
                OrderPipelineWidget::class,
                TopProductsWidget::class,
                SalesByCategoryChart::class,
                LatestOrdersTable::class,
                RecentActivityWidget::class,
            ])
            ->livewireComponents([
                Resources\OrderResource\Pages\Components\OrderItemsTable::class,
                CollectionTreeView::class,
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
                SetLocale::class,
            ])
            ->plugins([
                FilamentShieldPlugin::make(),
                FilamentApexChartsPlugin::make(),
            ])
            ->profile(isSimple: false)
            ->sidebarWidth('16rem')
            ->databaseNotifications()
            ->databaseNotificationsPolling('30s')
            ->authMiddleware([
                Authenticate::class,
            ]);
    }
}
