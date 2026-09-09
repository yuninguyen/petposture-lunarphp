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
                $this->notifyWebRecoveryFailure($request, $response ?? null);
            }
        }

        if ($request->is('api/admin/*') && $response->isSuccessful() && $this->notice->isPending()) {
            $response->headers->set('X-PetPosture-Cache-Warning', 'purge-pending');
            if ($this->notice->isRecoveryUnavailable()) {
                $response->headers->set('X-PetPosture-Cache-Recovery', 'unavailable');
            }
        }

        return $response;
    }

    private function notifyWebRecoveryFailure(Request $request, ?Response $response): void
    {
        try {
            if ($request->is('api/*') || ! $request->hasSession() || ! $this->notice->isRecoveryUnavailable()) {
                return;
            }

            \Filament\Notifications\Notification::make('storefront-recovery-unavailable')
                ->danger()
                ->title('Cache refresh recovery unavailable')
                ->body($this->notice->result()->message)
                ->persistent()
                ->send();

            // Completion follows Livewire dehydration, so Filament's normal
            // notificationsSent hook may already have run with an empty session.
            // Redirects consume the session notification on the destination mount.
            if (! $request->hasHeader('X-Livewire') || ! $response instanceof \Illuminate\Http\JsonResponse) {
                return;
            }
            $data = $response->getData(true);
            foreach ($data['components'] ?? [] as $component) {
                if (isset($component['effects']['redirect'])) {
                    return;
                }
                foreach ($component['effects']['dispatches'] ?? [] as $event) {
                    if (($event['name'] ?? null) === 'notificationsSent') {
                        return;
                    }
                }
            }
            if (isset($data['components'][0])) {
                $data['components'][0]['effects']['dispatches'][] = ['name' => 'notificationsSent', 'params' => []];
                $response->setData($data);
            }
        } catch (\Throwable) {
            // Notification/session failure must not replace saved output or the
            // handler's original exception. This is not durable recovery storage.
        }
    }
}
