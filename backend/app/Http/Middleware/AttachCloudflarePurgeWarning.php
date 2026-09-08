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
        private readonly \App\Support\StorefrontMutationBatch $batch,
        private readonly \App\Services\PublicContentPurgeCoordinator $coordinator,
    ) {}

    public function handle(Request $request, Closure $next): Response
    {
        $this->batch->begin();
        try {
            /** @var Response $response */
            $response = $next($request);
        } finally {
            try {
                $this->coordinator->flushCompletedMutation();
                foreach (\Illuminate\Support\Facades\DB::getConnections() as $connection) {
                    if ($connection->transactionLevel() > 0) {
                        $this->notice->markPending();
                    }
                }
            } catch (\Throwable) {
                $this->notice->markPending();
            } finally {
                $this->batch->end();
            }
        }

        if ($request->is('api/admin/*') && $response->isSuccessful() && $this->notice->isPending()) {
            $response->headers->set('X-PetPosture-Cache-Warning', 'purge-pending');
        }

        return $response;
    }
}
