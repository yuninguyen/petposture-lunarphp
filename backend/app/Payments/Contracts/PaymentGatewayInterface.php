<?php

namespace App\Payments\Contracts;

use App\Payments\Data\PaymentPreparation;

interface PaymentGatewayInterface
{
    public function method(): string;

    public function label(): string;

    public function prepare(array $payload = []): PaymentPreparation;

    public function definition(): array;
}
