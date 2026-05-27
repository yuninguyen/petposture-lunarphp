<?php

namespace App\Jobs;

use App\Models\Setting;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class DispatchOutboundWebhook implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public int $backoff = 30;

    public function __construct(
        private readonly string $event,
        private readonly array $payload,
    ) {
    }

    public function handle(): void
    {
        $url = Setting::get('outbound_webhook_url');

        if (! $url) {
            return;
        }

        $body = array_merge($this->payload, [
            'event'    => $this->event,
            'fired_at' => now()->toIso8601String(),
        ]);

        $response = Http::timeout(10)
            ->withHeaders(['User-Agent' => 'PetPosture-Webhook/1.0'])
            ->post($url, $body);

        if (! $response->successful()) {
            Log::warning('Outbound webhook delivery failed', [
                'event'  => $this->event,
                'url'    => $url,
                'status' => $response->status(),
            ]);

            $this->fail(new \RuntimeException("Webhook POST to {$url} returned {$response->status()}"));
        }
    }
}
