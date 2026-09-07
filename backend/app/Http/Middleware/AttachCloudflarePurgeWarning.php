<?php

namespace App\Http\Middleware;

use App\Support\CloudflarePurgeNotice;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class AttachCloudflarePurgeWarning
{
    public function __construct(
        private readonly CloudflarePurgeNotice $notice,
    ) {}

    public function handle(Request $request, Closure $next): Response
    {
        /** @var Response $response */
        $response = $next($request);

        if ($request->is('api/admin/*') && $response->isSuccessful() && $this->notice->isPending()) {
            $response->headers->set('X-PetPosture-Cache-Warning', 'purge-pending');
        }

        return $response;
    }
}
