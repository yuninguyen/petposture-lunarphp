<?php

use Illuminate\Database\Migrations\Migration;
use Lunar\Models\Channel;
use Lunar\Models\Currency;
use Lunar\Models\CustomerGroup;
use Lunar\Models\Language;
use Lunar\Models\ProductType;
use Lunar\Models\TaxClass;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // 1. Ensure default Languages exist (en and vi)
        if (Language::count() === 0) {
            Language::create([
                'code' => 'en',
                'name' => 'English',
                'default' => true,
            ]);
            Language::create([
                'code' => 'vi',
                'name' => 'Vietnamese',
                'default' => false,
            ]);
        } else {
            // Ensure at least one language is marked as default
            if (! Language::where('default', true)->exists()) {
                $lang = Language::where('code', 'en')->first() ?? Language::first();
                if ($lang) {
                    $lang->update(['default' => true]);
                }
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
