<?php

namespace App\Console\Commands;

use App\Services\ReturnRequestService;
use Illuminate\Console\Command;

class ExpireOverdueReturnRequests extends Command
{
    protected $signature = 'returns:expire-overdue';

    protected $description = 'Expire approved return requests where the customer never supplied a return tracking number in time';

    public function handle(ReturnRequestService $returnRequestService): int
    {
        $count = $returnRequestService->expireOverdueRequests();

        $this->info("Expired {$count} overdue return request(s).");

        return self::SUCCESS;
    }
}
