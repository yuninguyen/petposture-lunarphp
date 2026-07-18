<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Spatie\Permission\PermissionRegistrar;
use Symfony\Component\HttpFoundation\Response;

class ResetPermissionCache
{
    /**
     * Force a fresh permissions/roles lookup for this request.
     *
     * PermissionRegistrar keeps a local in-memory reference to the loaded permissions/roles
     * for the lifetime of the process. In classic PHP-FPM/php artisan serve this is harmless (a
     * new process per request), but in a persistent worker process (FrankenPHP worker mode) it
     * would let a stale permission set survive across requests after a role/permission change
     * until the worker restarts.
     *
     * Uses clearPermissionsCollection() (not forgetCachedPermissions()) — it only clears the
     * local in-memory reference and re-reads from the shared cache store on next access.
     * forgetCachedPermissions() also deletes the shared cache store entry (used by every
     * request/user), which would force a full DB rebuild on every single request and defeat the
     * point of caching permissions at all.
     */
    public function handle(Request $request, Closure $next): Response
    {
        app(PermissionRegistrar::class)->clearPermissionsCollection();

        return $next($request);
    }
}
