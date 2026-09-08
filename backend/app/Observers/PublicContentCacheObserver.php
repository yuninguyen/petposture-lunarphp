<?php

namespace App\Observers;

use App\Services\PublicContentPurgeCoordinator;

class PublicContentCacheObserver
{
    public function saved(\Illuminate\Database\Eloquent\Model $model): void
    {
        app(PublicContentPurgeCoordinator::class)->requestPurge([], $model->getConnectionName());
    }

    public function deleted(\Illuminate\Database\Eloquent\Model $model): void
    {
        app(PublicContentPurgeCoordinator::class)->requestPurge([], $model->getConnectionName());
    }
}
