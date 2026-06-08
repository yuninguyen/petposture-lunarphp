<?php

namespace App\Providers;

use App\Models\OrderEvent;
use App\Lunar\ShippingModifiers\DefaultShippingModifier;
use App\Payments\Gateways\CashOnDeliveryGateway;
use App\Payments\Gateways\MockPayPalGateway;
use App\Payments\Gateways\StripeCardGateway;
use App\Payments\PaymentGatewayManager;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Session;
use Illuminate\Support\ServiceProvider;
use Lunar\Models\Order;
use Lunar\Base\ShippingModifiers;
use Lunar\Models\ProductVariant;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->singleton(PaymentGatewayManager::class, function () {
            return new PaymentGatewayManager([
                new CashOnDeliveryGateway(),
                new StripeCardGateway(),
                new MockPayPalGateway(),
            ]);
        });
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        if ($this->app->environment('production')) {
            \Illuminate\Support\Facades\URL::forceScheme('https');
            $this->ensurePersistentStorageSymlink();
        }

        if (class_exists(\Lunar\Facades\Telemetry::class)) {
            \Lunar\Facades\Telemetry::optOut();
        }

        \Illuminate\Support\Facades\Gate::before(function ($user, $ability) {
            return $user->hasRole('super_admin') ? true : null;
        });

        Order::observe(\App\Observers\OrderObserver::class);
        ProductVariant::observe(\App\Observers\ProductVariantObserver::class);
        \App\Models\Legacy\Product::observe(\App\Observers\LegacyProductObserver::class);
        $this->app->make(ShippingModifiers::class)->add(DefaultShippingModifier::class);
        Order::resolveRelationUsing('orderEvents', function (Order $order) {
            return $order->hasMany(OrderEvent::class, 'order_id')->orderBy('occurred_at');
        });

        $legacyVariantMorph = ProductVariant::class;
        $currentVariantMorph = (new ProductVariant)->getMorphClass();

        if ($legacyVariantMorph !== $currentVariantMorph && Schema::hasTable('lunar_prices')) {
            DB::table('lunar_prices')
                ->where('priceable_type', $legacyVariantMorph)
                ->update(['priceable_type' => $currentVariantMorph]);
        }

        // Register custom discount type
        $this->app->make(\Lunar\Base\DiscountManagerInterface::class)
            ->addType(\App\Lunar\DiscountTypes\FixedAmountOffPerUnit::class);

        \Illuminate\Support\Facades\RateLimiter::for('api', function (\Illuminate\Http\Request $request) {
            return \Illuminate\Cache\RateLimiting\Limit::perMinute(60)->by($request->user()?->id ?: $request->ip());
        });

        \Illuminate\Support\Facades\RateLimiter::for('api-write', function (\Illuminate\Http\Request $request) {
            return \Illuminate\Cache\RateLimiting\Limit::perMinute(20)->by($request->ip());
        });

        \Illuminate\Support\Facades\RateLimiter::for('auth', function (\Illuminate\Http\Request $request) {
            return \Illuminate\Cache\RateLimiting\Limit::perMinute(5)->by($request->ip());
        });
    }

    /**
     * Deploys checkout directly into this app's git working tree, which wipes
     * untracked paths like storage/app/public (uploaded logos, favicons, media)
     * each time. Storage now lives outside the working tree at
     * domains/petposture.com/petposture-storage/app/public (two levels above
     * this app's nodejs/backend root); recreate the symlink here so the
     * fix survives without relying on cron (unavailable on this hosting plan).
     * Throttled via cache so it only touches the filesystem once per minute.
     */
    protected function ensurePersistentStorageSymlink(): void
    {
        Cache::remember('persistent-storage-symlink-checked-at', 60, function () {
            $storagePublic = storage_path('app/public');
            $persistentPublic = base_path('../../petposture-storage/app/public');

            if (! is_dir($persistentPublic)) {
                return now()->toDateTimeString();
            }

            $isLinkToTarget = is_link($storagePublic)
                && realpath(readlink($storagePublic) ?: '') === realpath($persistentPublic);

            if (! $isLinkToTarget) {
                if (file_exists($storagePublic) || is_link($storagePublic)) {
                    if (is_dir($storagePublic) && ! is_link($storagePublic)) {
                        \Illuminate\Support\Facades\File::deleteDirectory($storagePublic);
                    } else {
                        @unlink($storagePublic);
                    }
                }

                symlink($persistentPublic, $storagePublic);
            }

            return now()->toDateTimeString();
        });
    }
}
