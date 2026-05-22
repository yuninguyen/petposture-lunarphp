<?php

use Illuminate\Database\Migrations\Migration;
use Spatie\Permission\Models\Role;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        $roles = [
            'super_admin',
            'Product Manager',
            'Order Manager',
            'Support',
            'customer',
        ];

        foreach ($roles as $roleName) {
            try {
                Role::firstOrCreate(['name' => $roleName, 'guard_name' => 'web']);
            } catch (\Exception $e) {
                // Fail silently if table does not exist or guard is not defined yet
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
