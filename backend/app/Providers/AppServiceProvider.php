<?php

namespace App\Providers;

use App\Lunar\DiscountTypes\FixedAmountOffPerUnit;
use App\Lunar\ShippingModifiers\DefaultShippingModifier;
use App\Models\Breed;
use App\Models\OrderEvent;
use App\Models\OrderShipment;
use App\Models\Page;
use App\Models\Post;
use App\Models\Setting;
use App\Models\Solution;
use App\Observers\BrandCacheObserver;
use App\Observers\LegacyProductObserver;
use App\Observers\OrderObserver;
use App\Observers\PostCacheObserver;
use App\Observers\ProductCacheObserver;
use App\Observers\ProductVariantObserver;
use App\Observers\SanitizeRichTextObserver;
use App\Observers\SettingCacheObserver;
use App\Payments\Gateways\AirwallexGateway;
use App\Payments\Gateways\CashOnDeliveryGateway;
use App\Payments\Gateways\PayoneerGateway;
use App\Payments\Gateways\PayPalGateway;
use App\Payments\Gateways\PingPongGateway;
use App\Payments\Gateways\StripeCardGateway;
use App\Payments\PaymentGatewayManager;
use App\Support\MailConfigSync;
use App\Support\ProductionMailConfiguration;
use Illuminate\Auth\Events\Login;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\ServiceProvider;
use Lunar\Base\DiscountManagerInterface;
use Lunar\Base\ShippingModifiers;
use Lunar\Facades\Telemetry;
use Lunar\Models\Brand;
use Lunar\Models\Order;
use Lunar\Models\Product;
use Lunar\Models\ProductVariant;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->singleton(PaymentGatewayManager::class, function ($app) {
            return new PaymentGatewayManager([
                new CashOnDeliveryGateway,
                new StripeCardGateway,
                $app->make(PayPalGateway::class),
                $app->make(AirwallexGateway::class),
                $app->make(PayoneerGateway::class),
                $app->make(PingPongGateway::class),
            ]);
        });
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        ProductionMailConfiguration::assertSafe($this->app);

        if ($this->app->environment('production')) {
            URL::forceScheme('https');
        }

        if (class_exists(Telemetry::class)) {
            Telemetry::optOut();
        }

        Gate::before(function ($user, $ability) {
            return $user->hasAnyRole(['super_admin', 'admin', 'staff']) ? true : null;
        });

        Order::observe(OrderObserver::class);
        ProductVariant::observe(ProductVariantObserver::class);
        \App\Models\Legacy\Product::observe(LegacyProductObserver::class);
        Product::observe(ProductCacheObserver::class);
        Brand::observe(BrandCacheObserver::class);
        Post::observe([SanitizeRichTextObserver::class, PostCacheObserver::class]);
        Page::observe(SanitizeRichTextObserver::class);
        Setting::observe(SettingCacheObserver::class);
        $this->app->make(ShippingModifiers::class)->add(DefaultShippingModifier::class);
        Order::resolveRelationUsing('orderEvents', function (Order $order) {
            return $order->hasMany(OrderEvent::class, 'order_id')->orderBy('occurred_at');
        });
        Order::resolveRelationUsing('shipments', function (Order $order) {
            return $order->hasMany(OrderShipment::class, 'order_id');
        });
        Product::resolveRelationUsing('breeds', function (Product $product) {
            return $product->belongsToMany(Breed::class, 'breed_product', 'lunar_product_id', 'breed_id')
                ->withPivot('priority')
                ->orderByPivot('priority');
        });
        Product::resolveRelationUsing('solutions', function (Product $product) {
            return $product->belongsToMany(Solution::class, 'solution_product', 'lunar_product_id', 'solution_id')
                ->withPivot('priority')
                ->orderByPivot('priority');
        });

        $legacyVariantMorph = ProductVariant::class;
        $currentVariantMorph = (new ProductVariant)->getMorphClass();

        if ($legacyVariantMorph !== $currentVariantMorph && Schema::hasTable('lunar_prices')) {
            DB::table('lunar_prices')
                ->where('priceable_type', $legacyVariantMorph)
                ->update(['priceable_type' => $currentVariantMorph]);
        }

        // Register custom discount type
        $this->app->make(DiscountManagerInterface::class)
            ->addType(FixedAmountOffPerUnit::class);

        RateLimiter::for('api', function (Request $request) {
            return Limit::perMinute(60)->by($request->user()?->id ?: $request->ip());
        });

        RateLimiter::for('api-write', function (Request $request) {
            return Limit::perMinute(20)->by($request->ip());
        });

        RateLimiter::for('auth', function (Request $request) {
            return Limit::perMinute(5)->by($request->ip());
        });

        RateLimiter::for('review-submit', function (Request $request) {
            $identity = $request->user()?->id
                ? 'user:'.$request->user()->id
                : 'email:'.hash('sha256', strtolower(trim((string) $request->input('customer_email', ''))));

            return [
                Limit::perMinute(10)->by('review:ip:'.$request->ip()),
                Limit::perMinute(5)->by('review:identity:'.$identity),
            ];
        });

        RateLimiter::for('order-public', function (Request $request) {
            $signal = implode('|', [
                strtolower(trim((string) $request->input('email', ''))),
                trim((string) $request->input('tracking_token', $request->query('session_id', ''))),
                strtolower((string) $request->userAgent()),
            ]);

            return [
                Limit::perMinute(10)->by('order-public:ip:'.$request->ip()),
                Limit::perMinute(5)->by('order-public:signal:'.hash('sha256', $signal)),
            ];
        });

        MailConfigSync::run();

        Event::listen(function (Login $event) {
            $event->user->forceFill(['last_login_at' => now()])->saveQuietly();
        });
    }
}
