<?php

namespace App\Observers;

use App\Http\Controllers\Api\ProductController;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Cache;

class ProductCacheObserver extends PublicContentCacheObserver
{
    public function saved(Model $model): void
    {
        $this->forgetListing($model);
        parent::saved($model);
    }

    public function deleted(Model $model): void
    {
        $this->forgetListing($model);
        parent::deleted($model);
    }

    // The storefront refresh journal only accepts `setting:` and site-media keys, so the
    // product listing cache is cleared here, after commit so a concurrent request cannot
    // re-cache the old rows before the change is visible.
    private function forgetListing(Model $model): void
    {
        $model->getConnection()->afterCommit(
            static fn () => Cache::forget(ProductController::INDEX_CACHE_KEY),
        );
    }
}
