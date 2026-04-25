<?php

namespace App\Payments;

use App\Payments\Contracts\PaymentGatewayInterface;
use InvalidArgumentException;

class PaymentGatewayManager
{
    /**
     * @param  iterable<PaymentGatewayInterface>  $gateways
     */
    public function __construct(
        private readonly iterable $gateways
    ) {
    }

    public function forMethod(?string $method): PaymentGatewayInterface
    {
        $requestedMethod = strtolower(trim((string) ($method ?: 'cod')));

        foreach ($this->gateways as $gateway) {
            if ($gateway->method() === $requestedMethod) {
                return $gateway;
            }
        }

        throw new InvalidArgumentException("Unsupported payment method [{$requestedMethod}].");
    }

    public function supportedMethods(): array
    {
        $methods = [];

        foreach ($this->gateways as $gateway) {
            $methods[] = $gateway->definition();
        }

        return $methods;
    }
}
