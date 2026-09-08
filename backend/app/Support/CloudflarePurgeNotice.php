<?php

namespace App\Support;

use App\ValueObjects\CloudflarePurgeResult;

class CloudflarePurgeNotice
{
    private ?CloudflarePurgeResult $result = null;

    public function hasAttempted(): bool
    {
        return $this->result !== null;
    }

    public function record(CloudflarePurgeResult $result): void
    {
        if (! $this->isPending()) {
            $this->result = $result;
        }
    }

    public function result(): ?CloudflarePurgeResult
    {
        return $this->result;
    }

    public function isPending(): bool
    {
        return $this->result !== null
            && $this->result->configured
            && ! $this->result->successful;
    }

    public function markPending(): void
    {
        $this->record(new CloudflarePurgeResult(false, true, message: 'Cloudflare cache purge pending.'));
    }
}
