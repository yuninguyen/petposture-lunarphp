<?php

namespace App\Console\Commands;

use App\Services\StorefrontRefreshJournal;
use Illuminate\Console\Command;
use Throwable;

class ReplayStorefrontRefresh extends Command
{
    protected $signature = 'storefront:refresh-replay {--limit=100 : Maximum selected records (1-100)} {--max-seconds=20 : Maximum time to start work (1-20)}';
    protected $description = 'Resubmit durable storefront refresh work and reclaim expired leases';

    public function handle(StorefrontRefreshJournal $journal): int
    {
        $limit = filter_var($this->option('limit'), FILTER_VALIDATE_INT);
        $seconds = filter_var($this->option('max-seconds'), FILTER_VALIDATE_INT);
        if ($limit === false || $seconds === false || $limit < 1 || $limit > 100 || $seconds < 1 || $seconds > 20) {
            $this->error('Use --limit=1..100 and --max-seconds=1..20.');
            return self::INVALID;
        }
        try {
            $count = $journal->replay($limit, $seconds);
        } catch (Throwable) {
            $this->error('Storefront refresh journal unavailable; no completion guarantee.');
            return self::FAILURE;
        }
        $this->info("Processed {$count} journal records; submission is not refresh completion.");
        return self::SUCCESS;
    }
}
