<?php

namespace Database\Seeders;

use App\Models\Setting;
use Illuminate\Database\Seeder;

class SettingSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $settings = [
            [
                'key' => 'shop_name',
                'value' => 'PetPosture',
                'type' => 'string',
                'group' => 'general',
            ],
            [
                'key' => 'shop_email',
                'value' => 'support@petposture.com',
                'type' => 'string',
                'group' => 'general',
            ],
            [
                'key' => 'currency',
                'value' => 'USD',
                'type' => 'string',
                'group' => 'shop',
            ],
            [
                'key' => 'tax_rate',
                'value' => '10',
                'type' => 'float',
                'group' => 'shop',
            ],
            [
                'key' => 'low_stock_threshold',
                'value' => '5',
                'type' => 'int',
                'group' => 'shop',
            ],
            [
                'key' => 'enable_backorder',
                'value' => 'true',
                'type' => 'bool',
                'group' => 'shop',
            ],
            [
                'key' => 'social_links',
                'value' => json_encode([
                    'facebook' => 'https://facebook.com/petposture',
                    'instagram' => 'https://instagram.com/petposture',
                    'twitter' => 'https://twitter.com/petposture',
                ]),
                'type' => 'json',
                'group' => 'general',
            ],
        ];

        foreach ($settings as $setting) {
            Setting::updateOrCreate(['key' => $setting['key']], $setting);
        }
    }
}
