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
