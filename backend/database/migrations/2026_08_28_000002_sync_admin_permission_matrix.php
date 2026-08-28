<?php

use Database\Seeders\RoleSeeder;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        app(RoleSeeder::class)->run();
    }

    public function down(): void
    {
        // Permission rollback is intentionally non-destructive because these roles
        // and permissions may already be assigned by Filament Shield or operators.
    }
};
