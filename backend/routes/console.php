<?php

use App\Console\Commands\ExpireOverdueReturnRequests;
use App\Jobs\SyncAffiliateReportJob;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Schedule::command(ExpireOverdueReturnRequests::class)->daily();
Schedule::job(new SyncAffiliateReportJob)->dailyAt('06:00');
Schedule::command('storefront:refresh-replay --limit=100 --max-seconds=20')->everyMinute();
// Pinterest: at most one pin per run, and only when the owner has switched automatic posting on (see PinterestPublisher).
Schedule::command('pinterest:publish-next')->everyFifteenMinutes()->withoutOverlapping();
Schedule::command('pinterest:refresh-token')->dailyAt('05:30');
