<?php

namespace App\Support;

final class StorefrontMutationBatch
{
    private bool $collecting = false;

    private bool $changed = false;

    private array $cacheKeys = [];

    public function begin(): void
    {
        $this->collecting = true;
    }

    /** @param list<string> $cacheKeys */
    public function addCommitted(array $cacheKeys = []): void
    {
        $this->changed = true;
        $this->cacheKeys = array_values(array_unique([...$this->cacheKeys, ...$cacheKeys]));
    }

    public function isCollecting(): bool
    {
        return $this->collecting;
    }

    public function hasChanges(): bool
    {
        return $this->changed;
    }

    /** @return list<string> */
    public function drainCacheKeys(): array
    {
        $keys = $this->cacheKeys;
        $this->cacheKeys = [];
        $this->changed = false;

        return $keys;
    }

    public function end(): void
    {
        $this->collecting = false;
    }
}
