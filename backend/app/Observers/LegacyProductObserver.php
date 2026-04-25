<?php

namespace App\Observers;

use App\Models\Product;
use App\Services\ProductSyncService;

class LegacyProductObserver
{
    public function deleting(Product $product): void
    {
        app(ProductSyncService::class)->archiveSyncedProduct($product);
    }
}
