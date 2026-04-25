<?php

namespace App\Tax\Contracts;

interface SalesTaxProviderInterface
{
    public function quote(array $address, int $taxableAmount): array;
}
