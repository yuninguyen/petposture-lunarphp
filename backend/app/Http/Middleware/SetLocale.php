<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\App;
use Illuminate\Support\Facades\Session;
use Symfony\Component\HttpFoundation\Response;

class SetLocale
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        // Use fallback_locale (never mutated) instead of app.locale (mutated below) as the
        // default — otherwise app.locale drifts to whatever locale the last request set it to,
        // which would leak across requests in a persistent worker process (FrankenPHP worker mode).
        $locale = Session::get('locale', config('app.fallback_locale', 'en'));
        
        App::setLocale($locale);
        config(['app.locale' => $locale]);

        // Dynamically translate and order Filament navigation groups based on the active locale
        if (class_exists(\Filament\Facades\Filament::class)) {
            $panel = \Filament\Facades\Filament::getCurrentPanel();
            if ($panel) {
                try {
                    $panel->navigationGroups([
                        __('lunarpanel::global.sections.catalog'),
                        __('lunarpanel::global.sections.sales'),
                        __('Content Management'),
                        __('System'),
                        __('filament-shield::filament-shield.nav.group'),
                        __('lunarpanel::global.sections.settings'),
                    ]);
                } catch (\Throwable $e) {
                    // silently ignore navigation group errors
                }
            }
        }

        // Dynamically translate lunar order statuses labels in config. Re-read the
        // pristine labels straight from the published config file (not
        // config('lunar.orders.statuses')) each time — reading from the live config
        // store would chain off whatever locale mutated it last, permanently keeping
        // a stale-locale label for any key without a translation for the current
        // locale, which would leak across requests in a persistent worker process.
        $statuses = (require config_path('lunar/orders.php'))['statuses'] ?? [];
        foreach ($statuses as $key => $status) {
            $translationKey = "admin.orders.statuses.{$key}";
            if (\Illuminate\Support\Facades\Lang::has($translationKey)) {
                $statuses[$key]['label'] = __($translationKey);
            }
        }
        config(['lunar.orders.statuses' => $statuses]);

        // Reset Lunar admin static label/color caches so they reload under the
        // current locale — same leak class as OrderStatus: both memoize __()
        // output in a static array that's never invalidated by Lunar itself.
        try {
            $reflector = new \ReflectionClass(\Lunar\Admin\Support\OrderStatus::class);
            $reflector->getProperty('cachedStatusLabel')->setValue(null, []);
            $reflector->getProperty('cachedStatusColor')->setValue(null, []);
        } catch (\Throwable $e) {
            // ignore cache reset failures
        }

        try {
            $reflector = new \ReflectionClass(\Lunar\Admin\Support\CustomerStatus::class);
            $reflector->getProperty('cachedStatusLabel')->setValue(null, []);
            $reflector->getProperty('cachedStatusColor')->setValue(null, []);
            $reflector->getProperty('cachedStatusIcon')->setValue(null, []);
        } catch (\Throwable $e) {
            // ignore cache reset failures
        }
        
        // Set Carbon locale for translated formats
        \Carbon\Carbon::setLocale($locale);
        
        // Set PHP system locale for standard date formats (Windows compatible)
        if ($locale === 'vi') {
            setlocale(LC_ALL, 'vi_VN.UTF-8', 'vi_VN', 'vietnamese', 'vie', 'vn', 'vietnam');
            try {
                \Illuminate\Support\Facades\DB::statement("SET lc_time_names = 'vi_VN'");
            } catch (\Exception $e) {}
        } else {
            setlocale(LC_ALL, 'en_US.UTF-8', 'en_US', 'english', 'eng', 'en');
            try {
                \Illuminate\Support\Facades\DB::statement("SET lc_time_names = 'en_US'");
            } catch (\Exception $e) {}
        }

        return $next($request);
    }
}
