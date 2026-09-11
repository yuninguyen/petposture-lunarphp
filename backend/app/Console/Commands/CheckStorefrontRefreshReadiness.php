<?php

namespace App\Console\Commands;

use App\Jobs\PurgeCloudflareCache;
use Illuminate\Console\Command;

/** Offline activation gate; declared hard bounds must be verified by the deployment owner. */
class CheckStorefrontRefreshReadiness extends Command
{
    protected $signature = 'storefront:refresh-readiness {--request-timeout= : Verified server hard request timeout in seconds} {--io-timeout= : Verified maximum DB/cache/queue IO timeout in seconds}';
    protected $description = 'Reject unverified or incompatible storefront journal lease activation settings';

    public function handle(): int
    {
        $request = filter_var($this->option('request-timeout'), FILTER_VALIDATE_INT);
        $io = filter_var($this->option('io-timeout'), FILTER_VALIDATE_INT);
        $queue = config('queue.connections.'.config('queue.default'), []);
        $visibility = filter_var($queue['retry_after'] ?? null, FILTER_VALIDATE_INT);
        $worker = (new PurgeCloudflareCache)->timeout;
        if (! in_array($queue['driver'] ?? null, ['database', 'redis', 'beanstalkd'], true)
            || $request === false || $io === false || $request < 1 || $io < 1
            || $request >= 120 || $io >= min($request, $worker)
            || $worker >= 120 || $visibility === false || $visibility <= $worker) {
            $this->error('Not ready: require verified request < 120s, IO < min(request, worker), and async worker < visibility with worker < 120s. Unknown bounds fail closed.');
            return self::FAILURE;
        }
        $this->info('Numeric checks passed: Cloudflare HTTP 5s < job 60s < queue visibility; job < lease 120s. Initial synchronous work is not governed by the job timeout.');
        $this->error('Not ready: missing operator evidence for wall-clock request/replay hard stops, bounded DB/cache/queue IO, enforced worker timeout and graceful drain. Numeric configuration is not runtime proof.');
        $this->line('Replay 20s is cooperative only; PHP max_execution_time is not a Unix wall-clock IO bound. Supervisor stopwaitsecs 30s cannot certify draining a 60s job. Verify running scheduler/worker ownership and full-chain approval separately; this command cannot certify activation.');
        return self::FAILURE;
    }
}
