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
        $locale = Session::get('locale', config('app.locale'));
        
        App::setLocale($locale);
        config(['app.locale' => $locale]);

        // Dynamically translate and order Filament navigation groups based on the active locale
        if (class_exists(\Filament\Facades\Filament::class)) {
            $panel = \Filament\Facades\Filament::getCurrentPanel();
            if ($panel) {
                try {
                    $reflector = new \ReflectionClass($panel);
                    $prop = $reflector->getProperty('navigationGroups');
                    $prop->setAccessible(true);
                    $prop->setValue($panel, [
                        __('lunarpanel::global.sections.catalog'),
                        __('lunarpanel::global.sections.sales'),
                        __('Content Management'),
                        __('System'),
                        __('filament-shield::filament-shield.nav.group'),
                        __('lunarpanel::global.sections.settings'),
                    ]);
                } catch (\Exception $e) {
                    // Fallback to standard method if reflection fails
                    $panel->navigationGroups([
                        __('lunarpanel::global.sections.catalog'),
                        __('lunarpanel::global.sections.sales'),
                        __('Content Management'),
                        __('System'),
                        __('filament-shield::filament-shield.nav.group'),
                        __('lunarpanel::global.sections.settings'),
                    ]);
                }
            }
        }

        // Dynamically translate lunar order statuses labels in config
        $statuses = config('lunar.orders.statuses', []);
        $debug = ["URL: " . request()->fullUrl()];
        foreach ($statuses as $key => $status) {
            $translationKey = "admin.orders.statuses.{$key}";
            $hasTranslation = \Illuminate\Support\Facades\Lang::has($translationKey);
            $translated = __($translationKey);
            $debug[] = "$key => key: $translationKey, has: " . ($hasTranslation ? 'true' : 'false') . ", val: $translated";
            if ($hasTranslation) {
                $statuses[$key]['label'] = $translated;
            }
        }
        file_put_contents(storage_path('logs/set_locale_debug.log'), implode("\n", $debug), FILE_APPEND);
        config(['lunar.orders.statuses' => $statuses]);
        file_put_contents(storage_path('logs/set_locale_debug.log'), "\nAFTER CONFIG SET: awaiting-payment.label = " . config('lunar.orders.statuses.awaiting-payment.label') . "\n", FILE_APPEND);

        // Reset OrderStatus static caches so they reload from the newly set config
        try {
            $reflector = new \ReflectionClass(\Lunar\Admin\Support\OrderStatus::class);
            
            $propLabel = $reflector->getProperty('cachedStatusLabel');
            $propLabel->setAccessible(true);
            $propLabel->setValue(null, []);

            $propColor = $reflector->getProperty('cachedStatusColor');
            $propColor->setAccessible(true);
            $propColor->setValue(null, []);
        } catch (\Exception $e) {
            file_put_contents(storage_path('logs/set_locale_debug.log'), "\nReflection Error: " . $e->getMessage() . "\n", FILE_APPEND);
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
