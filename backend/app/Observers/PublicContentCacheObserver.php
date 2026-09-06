<?php

namespace App\Observers;

use App\Services\PublicContentPurgeCoordinator;

class PublicContentCacheObserver
{
    public function saved(): void
    {
        app(PublicContentPurgeCoordinator::class)->purge();
    }

    public function deleted(): void
    {
        app(PublicContentPurgeCoordinator::class)->purge();
    }
}
