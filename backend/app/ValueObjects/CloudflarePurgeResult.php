<?php

namespace App\ValueObjects;

final readonly class CloudflarePurgeResult
{
    public function __construct(
        public bool $successful,
        public bool $configured,
        public ?int $status = null,
        public ?string $message = null,
    ) {}
}
