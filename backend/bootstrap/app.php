<?php

use App\Enums\ErrorCode;
use App\Http\Middleware\RefreshMailConfig;
use App\Http\Middleware\ResetPermissionCache;
use App\Http\Middleware\SetLocale;
use App\Http\Middleware\SetRequestId;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Support\Facades\Route;
use Illuminate\Validation\ValidationException;
use Spatie\Permission\Middleware\PermissionMiddleware;
use Spatie\Permission\Middleware\RoleMiddleware;
use Spatie\Permission\Middleware\RoleOrPermissionMiddleware;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
        then: function () {
            Route::middleware('api')
                ->prefix('api/v1')
                ->group(base_path('routes/api.php'));
        },
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->trustProxies(at: '*');
        $middleware->redirectTo('/admin/login');
        $middleware->statefulApi();
        $middleware->validateCsrfTokens(except: [
            'api/*',
        ]);
        $middleware->alias([
            'role' => RoleMiddleware::class,
            'permission' => PermissionMiddleware::class,
            'role_or_permission' => RoleOrPermissionMiddleware::class,
        ]);
        $middleware->appendToGroup('api', SetRequestId::class);
        // SetLocale's global side effects (Carbon::setLocale, PHP setlocale(), the
        // MySQL session's lc_time_names) are process-wide, not request-scoped — API
        // requests need it too, or a request right after a 'vi' web request would
        // silently inherit Vietnamese-formatted dates on the same worker. Its
        // Filament-navigation-group block already no-ops outside a Filament request.
        $middleware->appendToGroup('api', SetLocale::class);
        $middleware->appendToGroup('api', ResetPermissionCache::class);
        $middleware->appendToGroup('api', RefreshMailConfig::class);
        $middleware->web(append: [
            SetLocale::class,
            ResetPermissionCache::class,
            RefreshMailConfig::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->render(function (ValidationException $e, $request) {
            if ($request->expectsJson() || $request->is('api/*')) {
                return response()->json([
                    'code' => ErrorCode::VALIDATION_ERROR->value,
                    'message' => $e->getMessage(),
                    'errors' => $e->errors(),
                ], 422);
            }
        });

        $exceptions->render(function (AuthenticationException $e, $request) {
            if ($request->expectsJson() || $request->is('api/*')) {
                return response()->json([
                    'code' => ErrorCode::UNAUTHENTICATED->value,
                    'message' => 'Unauthenticated.',
                ], 401);
            }
        });

        $exceptions->render(function (AuthorizationException $e, $request) {
            if ($request->expectsJson() || $request->is('api/*')) {
                return response()->json([
                    'code' => ErrorCode::FORBIDDEN->value,
                    'message' => 'This action is unauthorized.',
                ], 403);
            }
        });

        $exceptions->render(function (NotFoundHttpException $e, $request) {
            if ($request->expectsJson() || $request->is('api/*')) {
                return response()->json([
                    'code' => ErrorCode::NOT_FOUND->value,
                    'message' => $e->getMessage() ?: 'Not found.',
                ], 404);
            }
        });
    })->create();
