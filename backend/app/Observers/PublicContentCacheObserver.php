<?php

namespace App\Observers;

use App\Services\PublicContentPurgeCoordinator;
use Illuminate\Database\Eloquent\Model;

class PublicContentCacheObserver
{
    public function saved(Model $model): void
    {
        app(PublicContentPurgeCoordinator::class)->requestPurge([], $model->getConnectionName());
    }

    public function deleted(Model $model): void
    {
        app(PublicContentPurgeCoordinator::class)->requestPurge([], $model->getConnectionName());
    }
}
