<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Artisan;
use Lunar\Models\Currency;
use Lunar\Models\Channel;
use Lunar\Models\CustomerGroup;
use Lunar\Models\ProductType;
use Lunar\Models\TaxClass;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // 1. Run lunar:install dynamically if we have no currencies to seed basic schema values
        if (Currency::count() === 0) {
            try {
                Artisan::call('lunar:install', [
                    '--no-interaction' => true,
                ]);
            } catch (\Exception $e) {
                // Fail silently and let the manual checks below set up fallback records
            }
        }

        // 2. Ensure a default Currency exists
        if (Currency::count() === 0) {
            Currency::create([
                'code' => 'USD',
                'name' => 'US Dollar',
                'exchange_rate' => 1.0,
                'decimal_places' => 2,
                'default' => true,
            ]);
        }

        // 3. Ensure a default Channel exists
        if (Channel::count() === 0) {
            Channel::create([
                'name' => 'Webstore',
                'handle' => 'webstore',
                'default' => true,
            ]);
        }

        // 4. Ensure a default Customer Group exists
        if (CustomerGroup::count() === 0) {
            CustomerGroup::create([
                'name' => 'Retail',
                'handle' => 'retail',
                'default' => true,
            ]);
        }

        // 5. Ensure a default Product Type exists
        if (ProductType::count() === 0) {
            ProductType::create([
                'name' => 'General',
            ]);
        }

        // 6. Ensure a default Tax Class exists
        if (TaxClass::count() === 0) {
            TaxClass::create([
                'name' => 'Default',
            ]);
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // No-op
    }
};
