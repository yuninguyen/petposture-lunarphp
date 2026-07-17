<?php

namespace App\Providers;

use App\Models\OrderEvent;
use App\Models\Setting;
use App\Lunar\ShippingModifiers\DefaultShippingModifier;
use App\Payments\Gateways\CashOnDeliveryGateway;
use App\Payments\Gateways\MockPayPalGateway;
use App\Payments\Gateways\StripeCardGateway;
use App\Payments\PaymentGatewayManager;
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

        $this->configureMailFromSettings();
    }

    /**
     * Admin → Settings → SMTP Settings only affected the "Send Test Email"
     * button; real outgoing mail always used .env regardless of what was
     * saved there. Override the mail config here so it actually governs
     * real mail once an admin has configured it, falling back to .env
     * untouched otherwise.
     */
    private function configureMailFromSettings(): void
    {
        try {
            if (! Schema::hasTable('settings')) {
                return;
            }

            $host = Setting::get('smtp_host');

            if (! $host) {
                return;
            }

            $encryption = Setting::get('smtp_encryption') ?: 'tls';

            config([
                'mail.mailers.smtp.host' => $host,
                'mail.mailers.smtp.port' => (int) (Setting::get('smtp_port') ?: 587),
                'mail.mailers.smtp.username' => Setting::get('smtp_user'),
                'mail.mailers.smtp.password' => Setting::get('smtp_pass'),
                'mail.mailers.smtp.encryption' => $encryption === 'none' ? null : $encryption,
            ]);

            if ($fromAddress = Setting::get('mail_from_address')) {
                config(['mail.from.address' => $fromAddress]);
            }
        } catch (\Throwable) {
            // DB not ready yet (fresh install, migrations running) -- fall back to .env.
        }
    }
}
