<?php

use Illuminate\Database\Migrations\Migration;
use Lunar\Models\Language;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Ensure default Languages exist (en and vi)
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
            if (!Language::where('default', true)->exists()) {
                $lang = Language::where('code', 'en')->first() ?? Language::first();
                if ($lang) {
                    $lang->update(['default' => true]);
                }
            }
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
