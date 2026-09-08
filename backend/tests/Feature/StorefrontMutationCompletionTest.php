<?php

namespace Tests\Feature;

use App\Support\StorefrontMutationBatch;
use Tests\TestCase;

class StorefrontMutationCompletionTest extends TestCase
{
    public function test_batch_deduplicates_keys_and_resets_scope(): void
    {
        $batch = new StorefrontMutationBatch;

        $batch->begin();
        $this->assertTrue($batch->isCollecting());
        $batch->addCommitted(['setting:shop_name', 'setting:shop_name']);
        $batch->addCommitted(['setting:description', 'setting:shop_name']);

        $this->assertTrue($batch->hasChanges());
        $this->assertSame([
            'setting:shop_name',
            'setting:description',
        ], $batch->drainCacheKeys());
        $this->assertFalse($batch->hasChanges());
        $batch->end();
        $this->assertFalse($batch->isCollecting());
    }

    public function test_work_added_after_drain_is_preserved_for_next_completion(): void
    {
        $batch = new StorefrontMutationBatch;
        $batch->begin();
        $batch->addCommitted(['setting:one']);

        $this->assertSame(['setting:one'], $batch->drainCacheKeys());
        $batch->addCommitted(['setting:two']);
        $this->assertSame(['setting:two'], $batch->drainCacheKeys());
    }
}
