<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Lunar\Models\TaxZone;

class EnsureDefaultTaxZone extends Command
{
    protected $signature = 'tax:ensure-default-zone';

    protected $description = 'Create a default Tax Zone if none exists, so checkout does not crash when no postcode/state/country zone matches';

    public function handle(): int
    {
        if (TaxZone::getDefault()) {
            $this->info('A default tax zone already exists — nothing to do.');

            return self::SUCCESS;
        }

        $zone = TaxZone::create([
            'name' => 'Default',
            'zone_type' => 'country',
            'price_display' => 'tax_exclusive',
            'active' => true,
            'default' => true,
        ]);

        $this->info("Created default tax zone (id={$zone->id}).");

        return self::SUCCESS;
    }
}
