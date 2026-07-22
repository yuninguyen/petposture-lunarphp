<?php

namespace App\Http\Middleware;

use App\Support\MailConfigSync;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class RefreshMailConfig
{
    /**
     * Re-apply admin-configured SMTP settings to config('mail.*') for this request.
     *
     * AppServiceProvider::boot() only does this once per container. In classic
     * PHP-FPM/php artisan serve that's harmless (a new container per request), but
     * in a persistent worker process (FrankenPHP worker mode) it would leave the
     * mail config frozen at whatever it was when the worker started, even after an
     * admin changes SMTP settings in the panel. See MailConfigSync for the purge
     * of the cached "smtp" mailer transport that makes the refreshed config take effect.
     */
    public function handle(Request $request, Closure $next): Response
    {
        MailConfigSync::run();

        return $next($request);
    }
}
