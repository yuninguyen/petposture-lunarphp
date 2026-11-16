<?php

namespace App\Console\Commands;

use App\Services\Pinterest\PinterestPublisher;
use Illuminate\Console\Command;

class PublishNextPinterestPin extends Command
{
    protected $signature = 'pinterest:publish-next';

    protected $description = 'Post the next due Pinterest pin, within the owner\'s limits (at most one per run)';

    public function handle(PinterestPublisher $publisher): int
    {
        $this->info($publisher->publishNext());

        return self::SUCCESS;
    }
}
