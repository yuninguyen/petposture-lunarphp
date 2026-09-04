<?php

namespace App\Providers\Filament;

use App\Filament\Pages\Dashboard;
use App\Filament\Widgets\AffiliateClicksOverview;
use App\Filament\Widgets\ClicksByNetworkWidget;
use App\Filament\Widgets\LatestOrdersTable;
use App\Filament\Widgets\OrderPipelineWidget;
use App\Filament\Widgets\PendingReturnRequestsWidget;
use App\Filament\Widgets\RecentActivityWidget;
use App\Filament\Widgets\SalesByCategoryChart;
use App\Filament\Widgets\SalesOverviewChart;
use App\Filament\Widgets\SalesSidebarWidget;
use App\Filament\Widgets\SiteOverviewStatsWidget;
use App\Filament\Widgets\TopClickedPostsWidget;
use App\Filament\Widgets\TopProductsWidget;
use App\Http\Middleware\SetLocale;
use App\Models\Setting;
use Awcodes\Curator\CuratorPlugin;
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
            ->darkMode(false)
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
            ->brandLogo(fn () => Setting::get('admin_logo')
                ? asset('storage/'.Setting::get('admin_logo'))
                : asset('logo.png'))
            ->brandLogoHeight('45px')
            ->favicon(fn () => Setting::get('admin_favicon')
                ? asset('storage/'.Setting::get('admin_favicon'))
                : asset('favicon.ico'))
            ->navigationGroups([
                __('lunarpanel::global.sections.catalog'),
                __('lunarpanel::global.sections.sales'),
                __('Content Management'),
                __('Affiliate'),
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
                    header.fi-sidebar-header,
                    .fi-sidebar-header {
                        background: transparent !important;
                        height: auto !important;
                        min-height: 4rem !important;
                        padding: .85rem 1.1rem !important;
                        border-bottom: none !important;
                        display: flex !important;
                        align-items: center !important;
                    }
                    .fi-sidebar-header img.fi-logo{height:32px!important;width:auto!important;max-width:160px!important;object-fit:contain!important;display:block!important}
                    .fi-sidebar-header span{color:#f8fafc!important;font-weight:700!important}
                    [class*="fi-sidebar-group-label"],
                    [class*="fi-sidebar-nav-label"] {
                        color: rgba(148,163,184,.5) !important;
                        font-size: 12.5px !important;
                        font-weight: 500 !important;
                        letter-spacing: normal !important;
                        text-transform: uppercase !important;
                        padding: 1.1rem 1.1rem .4rem .2rem !important;
                    }

                    nav.fi-sidebar .fi-sidebar-item-button,
                    aside.fi-sidebar .fi-sidebar-item-button {
                        color: #8b93a0 !important;
                        border-radius: 10px !important;
                        margin: 1px 0 !important;
                        padding: .5rem .75rem !important;
                        transition: background .12s,color .12s !important;
                    }
                    nav.fi-sidebar .fi-sidebar-item-button:hover,
                    aside.fi-sidebar .fi-sidebar-item-button:hover,
                    nav.fi-sidebar .fi-sidebar-item-button:focus-visible,
                    aside.fi-sidebar .fi-sidebar-item-button:focus-visible {
                        background: rgba(255,255,255,.06) !important;
                        color: #f1f4f8 !important;
                    }
                    nav.fi-sidebar .fi-sidebar-item-icon,aside.fi-sidebar .fi-sidebar-item-icon{color:#6b7280!important;width:16px!important;height:16px!important}
                    nav.fi-sidebar .fi-sidebar-item-label,aside.fi-sidebar .fi-sidebar-item-label{color:inherit!important;font-size:13.5px!important;font-weight:500!important}

                    nav.fi-sidebar .fi-sidebar-item-active .fi-sidebar-item-button,
                    aside.fi-sidebar .fi-sidebar-item-active .fi-sidebar-item-button {
                        background: #26313c !important;
                        color: #fff !important;
                    }
                    nav.fi-sidebar .fi-sidebar-item-active .fi-sidebar-item-icon,aside.fi-sidebar .fi-sidebar-item-active .fi-sidebar-item-icon{color:#fff!important}
                    nav.fi-sidebar .fi-sidebar-item-active .fi-sidebar-item-label,
                    aside.fi-sidebar .fi-sidebar-item-active .fi-sidebar-item-label {
                        color: #fff !important;
                        font-weight: 600 !important;
                    }

                    nav.fi-sidebar .fi-sidebar-item [class*="fi-badge"],
                    aside.fi-sidebar .fi-sidebar-item [class*="fi-badge"] {
                        background: var(--pp-orange) !important;
                        color: #fff !important;
                        font-size: 10px !important;
                        font-weight: 800 !important;
                        min-width: 18px !important;
                        height: 18px !important;
                        padding: 0 5px !important;
                        border-radius: 99px !important;
                        display: inline-flex !important;
                        align-items: center !important;
                        justify-content: center !important;
                    }
                    .fi-sidebar-nav{padding:.4rem .75rem 1rem!important}
                    aside.fi-sidebar ::-webkit-scrollbar-thumb,nav.fi-sidebar ::-webkit-scrollbar-thumb{background:rgba(255,255,255,.16)!important}
                    aside.fi-sidebar ::-webkit-scrollbar-track,nav.fi-sidebar ::-webkit-scrollbar-track{background:transparent!important}

                    /* ── Widget height fill (grid already stretches .fi-wi-widget to row height; make the visible card fill it) ── */
                    .fi-wi-widget{height:100%!important;display:flex!important;flex-direction:column!important}
                    .fi-wi-widget>.fi-section{flex:1!important;min-height:0!important}
                    .fi-wi-widget.fi-wi-table>.fi-ta{flex:1!important;display:flex!important;flex-direction:column!important;min-height:0!important}
                    .fi-wi-widget.fi-wi-table .fi-ta-ctn{flex:1!important;display:flex!important;flex-direction:column!important}

                    /* ── Login / simple page (logo was inheriting the sidebar 32px override; heading was default Filament 2xl/bold) ── */
                    .fi-simple-header img.fi-logo{height:44px!important;width:auto!important;max-width:190px!important;margin-bottom:1.25rem!important}
                    .fi-simple-header-heading {
                        font-size: 1.3rem !important;
                        font-weight: 650 !important;
                        color: #111827 !important;
                        font-family: "Public Sans","Public Sans Fallback",ui-sans-serif,sans-serif !important;
                        letter-spacing: normal !important;
                    }
                    .fi-simple-main .fi-btn{box-shadow:0 1px 3px rgba(223,132,72,.22)!important}

                    /* ── Topbar ── */
                    header.fi-topbar{background:#fff!important;border-bottom:1px solid #eef0f3!important;box-shadow:0 1px 4px rgba(0,0,0,.05)!important}

                    /* ── Breadcrumbs relocated into the topbar (see ppMoveBreadcrumbToTopbar in the
                       script block below) — reset the page-header margin now that this is a flex
                       sibling of the topbar own left-side buttons, not a stacked header row. ── */
                    .fi-topbar .fi-breadcrumbs{margin:0!important}
                    .fi-topbar .fi-breadcrumbs-item-label{font-size:12.5px!important}

                    /* ── Page header heading/subheading weight+size (requested 2026-08-08) ── */
                    .fi-header-heading{font-weight:600!important}
                    .fi-header-subheading{font-size:.9rem!important;line-height:1.2rem!important}

                    /* ── Page bg ── */
                    main.fi-main,div.fi-main,.fi-main-ctn{background:#f4f6f9!important}

                    /* ── Stat cards ── */
                    .fi-wi-stats-overview-stat {
                        background: #fff !important;
                        border: 1px solid #eaecf0 !important;
                        border-radius: 14px !important;
                        box-shadow: 0 1px 4px rgba(0,0,0,.05) !important;
                        transition: transform .18s,box-shadow .18s !important;
                    }
                    .fi-wi-stats-overview-stat:hover{transform:translateY(-2px)!important;box-shadow:0 6px 24px rgba(0,0,0,.09)!important}
                    .fi-wi-stats-overview-stat-value {
                        font-size: 1.8rem !important;
                        font-weight: 650 !important;
                        color: #0f172a !important;
                        letter-spacing: -.04em !important;
                        line-height: 1 !important;
                    }
                    .fi-wi-stats-overview-stat-label {
                        font-size: 13px !important;
                        font-weight: 500 !important;
                        color: #6b7280 !important;
                        text-transform: capitalize !important;
                        letter-spacing: normal !important;
                    }

                    /* ── Sections / cards ── */
                    .fi-section{background:#fff!important;border:1px solid #eaecf0!important;border-radius:14px!important;box-shadow:0 1px 4px rgba(0,0,0,.04)!important}
                    .fi-section-header{border-bottom:1px solid #f1f3f6!important}
                    .fi-section-header-heading,
                    .fi-ta-header-heading,
                    .filament-apex-charts-heading {
                        font-size: 14px !important;
                        font-weight: 700 !important;
                        color: #111827 !important;
                        font-family: "Public Sans","Public Sans Fallback",ui-sans-serif,sans-serif !important;
                    }

                    /* ── ApexCharts widget header — matches Top Products (fi-ta-header, p-4 sm:px-6 = 16px top/bottom)
                       heading position AND border distance, not just the border distance alone. The x-filament::card
                       wrapper this package uses does not forward its class prop down to the underlying
                       x-filament::section (verified via a real Livewire component render), so fi-section-content
                       keeps its default p-6 (24px) top padding — 8px more than Top Products own 16px. A prior fix
                       only compensated the bottom padding, which made the border land at the same distance from
                       card-top but left the heading text itself sitting 8px lower than Top Products (visibly
                       uneven — confirmed from a real production screenshot). Fixed properly this time: margin-top
                       pulls the whole header up by that same 8px so the heading TEXT starts at 16px like Top
                       Products, then bottom padding matches Top Products own 16px exactly (16+24+16=56, and the
                       heading position matches too, not just the total distance). ── */
                    .filament-apex-charts-header>div{padding-top:0!important;padding-bottom:0!important}
                    .filament-apex-charts-header{margin-top:-8px!important;border-bottom:1px solid #f1f3f6!important;padding-bottom:16px!important;margin-bottom:1.5rem!important}

                    /* ── Tables ── */
                    [class*="fi-ta-header-cell"]{font-size:13px!important;font-weight:600!important;text-transform:capitalize!important;color:#6b7280!important}
                    [class*="fi-ta-row"]:hover td{background:#fafbfc!important}

                    /* ── Recent Orders widget (scoped via fi-recent-orders-table wrapper class, see
                       LatestOrdersTable::$view) — smaller data text, Total column bold ── */
                    .fi-recent-orders-table .fi-ta-text-item-label{font-size:.75rem!important}
                    .fi-recent-orders-table td:last-child .fi-ta-text-item-label{font-weight:700!important}

                    /* ── Recent Activity widget text (scoped class, not a bare table-cell class — that
                       previously bled into every table including Recent Orders) ── */
                    .fi-recent-activity-text{font-size:.8rem!important;font-weight:550!important;line-height:1.5rem!important}

                    /* ── Table row actions: icon-only (label hidden, kept in DOM for screen readers) ── */
                    .fi-ta-actions{gap:.25rem!important}
                    .fi-ta-actions .fi-link{padding:.4rem!important;border-radius:8px!important;gap:0!important}
                    .fi-ta-actions .fi-link:hover{background:rgba(0,0,0,.045)!important}
                    .fi-ta-actions .fi-link>span {
                        position: absolute !important;
                        width: 1px !important;
                        height: 1px !important;
                        padding: 0 !important;
                        margin: -1px !important;
                        overflow: hidden !important;
                        clip: rect(0,0,0,0) !important;
                        white-space: nowrap !important;
                        border: 0 !important;
                    }

                    /* ── Primary buttons (solid CTAs only — outlined actions like Edit keep their border-only look) ── */
                    [class*="fi-btn"][class*="primary"]:not(.fi-btn-outlined) {
                        background: var(--pp-orange) !important;
                        border-color: var(--pp-orange) !important;
                        border-radius: 9px !important;
                        font-weight: 700 !important;
                        box-shadow: 0 2px 8px rgba(223,132,72,.28) !important;
                    }
                    [class*="fi-btn"][class*="primary"]:not(.fi-btn-outlined):hover{background:var(--pp-orange-dk)!important}
                    .fi-btn-outlined{border-radius:9px!important;font-weight:500!important}

                    /* ── Inputs ── */
                    [class*="fi-input"]{border-radius:9px!important;border-color:#e2e8f0!important}
                    [class*="fi-input"]:focus{border-color:var(--pp-orange)!important;box-shadow:0 0 0 3px var(--pp-orange-glow)!important;outline:none!important}

                    /* ── Multi-select tag chips (Choices.js) — smaller, more compact ── */
                    .choices__inner {
                        display: flex !important;
                        flex-wrap: wrap !important;
                        align-items: center !important;
                        gap: 4px !important;
                        min-height: auto !important;
                        padding: 5px 6px !important;
                    }
                    .choices__list--multiple{display:flex!important;flex-wrap:wrap!important;gap:4px!important;flex:0 1 auto!important}
                    .choices__list--multiple .choices__item {
                        font-size: 13px !important;
                        font-weight: 400 !important;
                        padding: 2px 6px !important;
                        height: auto !important;
                        line-height: 18px !important;
                        border-radius: 6px !important;
                    }
                    .choices__button{margin-left:6px!important}
                    .choices__input{flex:1 1 auto!important;width:auto!important;min-width:80px!important;margin:0!important;font-size:14px!important}
                    .choices__list--dropdown .choices__item{font-size:14px!important;font-weight:400!important;padding:8px 12px!important}

                    /* ── Tabs ── */
                    [class*="fi-tabs-tab"][aria-selected="true"]{color:var(--pp-orange)!important;background:var(--pp-orange-glow)!important}

                    /* ── Apex chart period pill filter ── */
                    .apex-charts-single-filter {
                        border-radius: 999px !important;
                        border: 1px solid #e2e8f0 !important;
                        font-size: 13px !important;
                        font-weight: 600 !important;
                        padding: .5rem 2rem .5rem 1.1rem !important;
                        background-color: #fff !important;
                        color: #374151 !important;
                        box-shadow: 0 1px 2px rgba(0,0,0,.04) !important;
                        cursor: pointer !important;
                    }
                    .apex-charts-single-filter:hover{border-color:#d7dbe1!important}
                    .apex-charts-single-filter:focus{border-color:var(--pp-orange)!important;box-shadow:0 0 0 3px var(--pp-orange-glow)!important;outline:none!important}

                    /* ── Scrollbar ── */
                    ::-webkit-scrollbar{width:5px;height:5px}
                    ::-webkit-scrollbar-track{background:transparent}
                    ::-webkit-scrollbar-thumb{background:#d1d5db;border-radius:9px}

                    @keyframes pp-pulse{0%,100%{opacity:1}50%{opacity:.4}}

                    /* ── TipTap Editor ── */
                    .tiptap-editor {
                        border-radius: 8px !important;
                        overflow: hidden;
                        box-shadow: 0 0 0 1px rgba(0,0,0,.1) !important;
                    }
                    .tiptap-wrapper {
                        border-radius: 8px !important;
                        background: #fff !important;
                    }
                    .tiptap-wrapper:focus-within {
                        box-shadow: 0 0 0 2px #df8448 !important;
                    }
                    .tiptap-toolbar {
                        padding: 8px 12px !important;
                        background: #fff !important;
                        border-bottom: 1px solid rgba(0,0,0,.09) !important;
                        gap: 0 !important;
                        flex-direction: row !important;
                        align-items: center !important;
                    }
                    .tiptap-toolbar.divide-x>* {
                        border-left: none !important;
                    }
                    .tiptap-toolbar-left {
                        gap: 3px !important;
                        padding: 0 !important;
                        align-items: center !important;
                    }
                    .tiptap-toolbar-right {
                        gap: 3px !important;
                        padding: 0 0 0 8px !important;
                        align-items: center !important;
                        border-left: 1px solid rgba(0,0,0,.08) !important;
                    }
                    .tiptap-tool {
                        width: 34px !important;
                        height: 34px !important;
                        padding: 0 !important;
                        display: inline-flex !important;
                        align-items: center !important;
                        justify-content: center !important;
                        border-radius: 6px !important;
                        cursor: pointer !important;
                        background: transparent !important;
                        transition: background .12s,color .12s !important;
                        ring: none !important;
                        outline: none !important;
                        box-shadow: none !important;
                    }
                    .tiptap-tool:focus {
                        outline: none !important;
                        box-shadow: none !important;
                    }
                    .tiptap-tool svg {
                        width: 17px !important;
                        height: 17px !important;
                    }
                    /* Main toolbar sits on a white background — dark icon color for contrast. */
                    .tiptap-toolbar .tiptap-tool {
                        color: #374151 !important;
                    }
                    .tiptap-toolbar .tiptap-tool:hover {
                        background: #f1f5f9 !important;
                        color: #111827 !important;
                        box-shadow: none !important;
                    }
                    /* Bubble/floating/link/image/table menus render inside a Tippy popup with a dark
                       (#333) background (vendor package ships no custom theme CSS for
                       data-theme="tiptap-editor-bubble", so it falls back to Tippy default dark
                       theme) — the toolbar dark icon color above is invisible there, so give this
                       context its own light icon color instead of reusing the toolbar one. */
                    .tippy-box[data-theme="tiptap-editor-bubble"] .tiptap-tool {
                        color: #f1f5f9 !important;
                    }
                    .tippy-box[data-theme="tiptap-editor-bubble"] .tiptap-tool:hover {
                        background: rgba(255,255,255,.15) !important;
                        color: #fff !important;
                    }
                    .tiptap-toolbar-left>.border-l {
                        height: 18px !important;
                        margin: 0 4px !important;
                        border-color: rgba(0,0,0,.1) !important;
                    }
                    .tiptap-prosemirror-wrapper {
                        max-height: none !important;
                    }
                    .ProseMirror {
                        padding: 16px 20px !important;
                        font-size: 15px !important;
                        line-height: 1.75 !important;
                        color: #1e293b !important;
                        outline: none !important;
                    }
                    .ProseMirror h1 {
                        font-size: 1.875rem;
                        font-weight: 700;
                        margin: 1.5rem 0 .6rem;
                        color: #0f172a;
                        line-height: 1.25;
                    }
                    .ProseMirror h2 {
                        font-size: 1.5rem;
                        font-weight: 700;
                        margin: 1.25rem 0 .5rem;
                        color: #0f172a;
                        line-height: 1.3;
                    }
                    .ProseMirror h3 {
                        font-size: 1.25rem;
                        font-weight: 600;
                        margin: 1rem 0 .4rem;
                        color: #0f172a;
                    }
                    .ProseMirror p {
                        margin-bottom: .85rem;
                    }
                    .ProseMirror ul,
                    .ProseMirror ol {
                        padding-left: 1.5rem;
                        margin-bottom: .85rem;
                    }
                    .ProseMirror blockquote {
                        border-left: 3px solid #df8448 !important;
                        padding: .6rem 1rem;
                        margin: 1.25rem 0;
                        background: #fff7f0;
                        border-radius: 0 6px 6px 0;
                        color: #6b7280;
                        font-style: italic;
                    }
                    .ProseMirror code {
                        background: #f1f5f9;
                        border: 1px solid #e2e8f0;
                        border-radius: 4px;
                        padding: .15em .45em;
                        font-size: .875em;
                        color: #be123c;
                    }
                    .ProseMirror pre {
                        background: #1e293b;
                        color: #e2e8f0;
                        border-radius: 10px;
                        padding: 1rem 1.25rem;
                        overflow-x: auto;
                        margin: 1.25rem 0;
                        font-size: .875rem;
                        line-height: 1.6;
                    }
                    .ProseMirror pre code {
                        background: transparent;
                        border: none;
                        color: inherit;
                        padding: 0;
                    }
                    .ProseMirror hr {
                        border: none;
                        border-top: 1px solid #e2e8f0;
                        margin: 1.5rem 0;
                    }
                    .ProseMirror a {
                        color: #df8448;
                        text-decoration: underline;
                        text-underline-offset: 3px;
                    }
                    .ProseMirror table {
                        width: 100%;
                        border-collapse: collapse;
                        margin: 1rem 0;
                    }
                    .ProseMirror th,
                    .ProseMirror td {
                        border: 1px solid #e2e8f0;
                        padding: .5rem .75rem;
                        text-align: left;
                    }
                    .ProseMirror th {
                        background: #f8fafc;
                        font-weight: 600;
                        color: #0f172a;
                    }
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

                        // Tracks which URL the topbar breadcrumb currently reflects, so a real page
                        // navigation clears the stale one exactly once — not on every one of the
                        // several events/timers below that all fire for the very same page load
                        // (DOMContentLoaded, livewire:navigated, and the retry timers all fire together
                        // on a first load; clearing unconditionally on each one removed the copy we
                        // had just relocated moments earlier, before anything fresh existed to replace
                        // it, permanently losing the breadcrumb).
                        var ppBreadcrumbUrl = null;

                        function ppMoveBreadcrumbToTopbar(){
                            var topbarNav = document.querySelector(\'.fi-topbar nav\');
                            if (!topbarNav) return;

                            if (ppBreadcrumbUrl !== location.pathname) {
                                ppBreadcrumbUrl = location.pathname;
                                topbarNav.querySelectorAll(\':scope > nav.fi-breadcrumbs\').forEach(function(n){ n.remove(); });
                            }

                            // A page-header breadcrumb only exists in its original template position
                            // if Livewire has (re)rendered it there since the last move — most partial
                            // updates (e.g. search-as-you-type) never touch the header at all, so on
                            // those runs there is nothing fresh to find and the one already sitting in
                            // the topbar from before is left completely alone.
                            var pageBreadcrumb = document.querySelector(\'.fi-header nav.fi-breadcrumbs, main nav.fi-breadcrumbs\');
                            if (!pageBreadcrumb || topbarNav.contains(pageBreadcrumb)) return;

                            topbarNav.querySelectorAll(\':scope > nav.fi-breadcrumbs\').forEach(function(n){ n.remove(); });
                            pageBreadcrumb.classList.remove(\'mb-2\');
                            var anchor = topbarNav.querySelector(\':scope > .ms-auto\');
                            if (anchor) { topbarNav.insertBefore(pageBreadcrumb, anchor); }
                            else { topbarNav.appendChild(pageBreadcrumb); }
                        }

                        function applyTheme(){
                            ppSafe(ppHideDashboardHeading);
                            ppSafe(ppMoveBreadcrumbToTopbar);
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

                        document.addEventListener("alpine:init", function(){
                            var register = window.Alpine.data.bind(window.Alpine);

                            window.Alpine.data = function(name, factory){
                                if (name !== "tiptap") return register(name, factory);

                                return register(name, function(){
                                    var component = factory.apply(this, arguments);
                                    var insertSource = component.insertSource;

                                    component.updateEditorContent = function(content){
                                        var editor = this.editor();
                                        if (!editor || !editor.isEditable) return;

                                        var selection = editor.state.selection;
                                        var shouldFocus = this.ppForceFocus === true || editor.isFocused;

                                        editor.commands.setContent(content, true);

                                        var chain = editor.chain();
                                        if (shouldFocus) chain = chain.focus();
                                        chain.setTextSelection({ from: selection.from, to: selection.to }).run();
                                    };

                                    component.insertSource = function(event){
                                        this.ppForceFocus = true;
                                        try { insertSource.call(this, event); }
                                        finally { this.ppForceFocus = false; }
                                    };

                                    component.refreshEditorContent = function(){
                                        var self = this;
                                        this.$nextTick(function(){
                                            self.ppForceFocus = true;
                                            try { self.updateEditorContent(self.state); }
                                            finally { self.ppForceFocus = false; }
                                        });
                                    };

                                    return component;
                                });
                            };
                        });
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
                    .pp-banner {
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        gap: 16px;
                        background: #fff;
                        border: 1px solid #eaecf0;
                        border-radius: 14px;
                        padding: 14px 22px;
                        margin: 18px 24px 14px;
                        box-shadow: 0 1px 4px rgba(0,0,0,.05);
                        flex-wrap: wrap;
                    }
                    .pp-banner-title{font-size:18px;font-weight:650;color:#0f172a;letter-spacing:0.01em;line-height:1.25;}
                    .pp-banner-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;width:100%;}
                    .pp-btn {
                        display: inline-flex;
                        align-items: center;
                        justify-content: center;
                        gap: 7px;
                        padding: 9px 14px;
                        border-radius: 9px;
                        font-size: 13px;
                        font-weight: 600;
                        text-decoration: none;
                        white-space: nowrap;
                        transition: background .15s,transform .15s;
                    }
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
                                <span
                                    style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#34d399;box-shadow:0 0 6px rgba(52,211,153,.65);animation:pp-pulse 2s infinite;flex-shrink:0"
                                ></span>
                                <span style="font-size:12px;font-weight:500;color:#94a3b8;">'.$date.'</span>
                            </div>
                        </div>
                        <div class="pp-banner-actions">
                            <a href="/admin/products?mountedActions[0]=create" class="pp-btn pp-btn-primary"
                               onmouseover="this.style.background=\'#c9713a\'" onmouseout="this.style.background=\'#df8448\'">
                                <svg
                                    width="13" height="13" viewBox="0 0 24 24" fill="none"
                                    stroke="currentColor" stroke-width="2.5"
                                    stroke-linecap="round" stroke-linejoin="round"
                                    style="flex-shrink:0"
                                >
                                    <path d="M12 5v14M5 12h14"/>
                                </svg>
                                '.__('admin.dashboard.actions.new_product').'
                            </a>
                            <a href="/admin/orders" class="pp-btn pp-btn-secondary"
                               onmouseover="this.style.background=\'#f1f5f9\'" onmouseout="this.style.background=\'#f8fafc\'">
                                <svg
                                    width="13" height="13" viewBox="0 0 24 24" fill="none"
                                    stroke="currentColor" stroke-width="2.5"
                                    stroke-linecap="round" stroke-linejoin="round"
                                    style="flex-shrink:0;opacity:.7"
                                >
                                    <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/>
                                    <path d="M3 6h18"/>
                                    <path d="M16 10a4 4 0 0 1-8 0"/>
                                </svg>
                                '.__('admin.dashboard.actions.orders').'
                            </a>
                            <a href="/admin/customers" class="pp-btn pp-btn-secondary"
                               onmouseover="this.style.background=\'#f1f5f9\'" onmouseout="this.style.background=\'#f8fafc\'">
                                <svg
                                    width="13" height="13" viewBox="0 0 24 24" fill="none"
                                    stroke="currentColor" stroke-width="2.5"
                                    stroke-linecap="round" stroke-linejoin="round"
                                    style="flex-shrink:0;opacity:.7"
                                >
                                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                                    <circle cx="9" cy="7" r="4"/>
                                    <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
                                </svg>
                                '.__('admin.dashboard.actions.customers').'
                            </a>
                            <a href="/admin/discounts" class="pp-btn pp-btn-secondary"
                               onmouseover="this.style.background=\'#f1f5f9\'" onmouseout="this.style.background=\'#f8fafc\'">
                                <svg
                                    width="13" height="13" viewBox="0 0 24 24" fill="none"
                                    stroke="currentColor" stroke-width="2.5"
                                    stroke-linecap="round" stroke-linejoin="round"
                                    style="flex-shrink:0;opacity:.7"
                                >
                                    <circle cx="12" cy="12" r="10"/>
                                    <path d="M14.5 9.5 9.5 14.5M9.5 9.5h.01M14.5 14.5h.01"/>
                                </svg>
                                '.__('admin.dashboard.actions.discounts').'
                            </a>
                        </div>
                    </div>';
                },
                scopes: [Dashboard::class],
            )
            ->renderHook(
                PanelsRenderHook::BODY_END,
                fn (): string => \Illuminate\Support\Facades\Blade::render("@vite(['resources/js/source-editor.js'])"),
            )
            // ->discoverWidgets(in: app_path('Filament\\Widgets'), for: 'App\\Filament\\Widgets')
            ->widgets([
                SiteOverviewStatsWidget::class,
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
                AffiliateClicksOverview::class,
                TopClickedPostsWidget::class,
                ClicksByNetworkWidget::class,
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
                CuratorPlugin::make()
                    ->resource(\App\Filament\Resources\CuratorMediaResource::class),
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
