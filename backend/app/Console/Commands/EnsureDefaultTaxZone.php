<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Lunar\Models\Country;
use Lunar\Models\TaxZone;

class EnsureDefaultTaxZone extends Command
{
    protected $signature = 'tax:ensure-default-zone';

    protected $description = 'Create a default Tax Zone if none exists and attach all countries to it, mirroring what lunar:install does';

    public function handle(): int
    {
        $zone = TaxZone::getDefault();

        if (! $zone) {
            $zone = TaxZone::create([
                'name' => 'Default',
                'zone_type' => 'country',
                'price_display' => 'tax_exclusive',
                'active' => true,
                'default' => true,
            ]);

            $this->info("Created default tax zone (id={$zone->id}).");
        } else {
            $this->info("Default tax zone already exists (id={$zone->id}).");
        }

        if (! $zone->countries()->exists()) {
            $zone->countries()->createMany(
                Country::get()->map(fn ($country) => ['country_id' => $country->id])
            );

            $this->info('Attached all countries to the default tax zone.');
        } else {
            $this->info('Default tax zone already has countries attached — nothing to do.');
        }

        return self::SUCCESS;
    }
}
