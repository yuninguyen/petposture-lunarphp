<?php

namespace App\Services\Pinterest;

use RuntimeException;

/**
 * A call to Pinterest that did not succeed. `outcomeUnknown` is true when the request may still have been carried
 * out (a timeout or a 5xx): for creating a pin that means it might exist, so it must not be retried blindly.
 */
class PinterestException extends RuntimeException
{
    public function __construct(
        string $message,
        public readonly ?int $httpStatus = null,
        public readonly ?string $errorCode = null,
        public readonly bool $outcomeUnknown = false,
    ) {
        parent::__construct($message);
    }

    /** The connection itself is no good (revoked, expired): nothing will work until the owner reconnects. */
    public function isAuthFailure(): bool
    {
        return in_array($this->httpStatus, [401, 403], true) || $this->errorCode === 'invalid_grant';
    }

    public function isRateLimited(): bool
    {
        return $this->httpStatus === 429;
    }
}
