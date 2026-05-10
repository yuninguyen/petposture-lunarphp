<?php

namespace App\Observers;

use App\Models\Legacy\Product;
use App\Services\ProductSyncService;

class LegacyProductObserver
{
    public function deleting(Product $product): void
    {
        app(ProductSyncService::class)->archiveSyncedProduct($product);
    }
}
