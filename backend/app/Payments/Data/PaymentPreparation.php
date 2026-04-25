<?php

namespace App\Payments\Data;

class PaymentPreparation
{
    public function __construct(
        public readonly string $method,
        public readonly string $label,
        public readonly string $gateway,
        public readonly string $collectionType,
        public readonly string $orderStatus = 'awaiting-payment',
        public readonly string $paymentStatus = 'pending',
        public readonly ?string $instructions = null,
        public readonly array $meta = [],
    ) {
    }

    public function toMeta(): array
    {
        return array_filter([
            'payment_method' => $this->method,
            'payment_label' => $this->label,
            'payment_gateway' => $this->gateway,
            'payment_collection' => $this->collectionType,
            'payment_status' => $this->paymentStatus,
            'payment_instructions' => $this->instructions,
            ...$this->meta,
        ], static fn ($value) => $value !== null);
    }
}
