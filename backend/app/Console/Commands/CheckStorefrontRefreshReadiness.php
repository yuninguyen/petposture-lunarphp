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
            || $visibility === false || $visibility <= $worker || $visibility >= 120) {
            $this->error('Not ready: require verified request < 120s, IO < min(request, worker), and async worker < visibility < 120s. Unknown bounds fail closed.');
            return self::FAILURE;
        }
        $this->info('Lease configuration checks passed against declared hard bounds; activation still requires independently verified timeout enforcement, scheduler/worker ownership and full refresh-chain approval.');
        return self::SUCCESS;
    }
}
