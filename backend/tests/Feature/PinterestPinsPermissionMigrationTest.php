<?php

namespace Tests\Feature;

use App\Security\AdminAbilityRegistry;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

class PinterestPinsPermissionMigrationTest extends TestCase
{
    use RefreshDatabase;

    private function migration(): object
    {
        return require base_path('database/migrations/2026_11_19_000002_seed_pinterest_pins_domain_permissions.php');
    }

    private function roles(): void
    {
        foreach (['super_admin', 'admin', 'staff', 'Product Manager', 'Order Manager', 'Support', 'Content Writer'] as $name) {
            Role::query()->firstOrCreate(['name' => $name, 'guard_name' => 'web']);
        }
    }

    public function test_it_creates_every_pin_ability_and_gives_them_only_to_the_core_admin_roles(): void
    {
        $this->roles();

        $this->migration()->up();
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        foreach (AdminAbilityRegistry::PINTEREST_PINS as $ability) {
            $this->assertTrue(Permission::query()->where('name', $ability)->where('guard_name', 'web')->exists(), $ability);

            foreach (['super_admin', 'admin', 'staff'] as $role) {
                $this->assertTrue(Role::findByName($role, 'web')->hasPermissionTo($ability), "{$role} must have {$ability}");
            }
            foreach (['Product Manager', 'Order Manager', 'Support', 'Content Writer'] as $role) {
                $this->assertFalse(Role::findByName($role, 'web')->hasPermissionTo($ability), "{$role} must not have {$ability}");
            }
        }
    }

    public function test_it_is_safe_to_run_twice(): void
    {
        $this->roles();

        $this->migration()->up();
        $this->migration()->up();

        $this->assertSame(
            count(AdminAbilityRegistry::PINTEREST_PINS),
            Permission::query()->whereIn('name', AdminAbilityRegistry::PINTEREST_PINS)->count(),
        );
    }

    public function test_it_does_not_take_a_business_role_s_manual_grant_away(): void
    {
        $this->roles();
        $writer = Role::findByName('Content Writer', 'web');
        $this->migration()->up();
        $writer->givePermissionTo('view_any_pinterest_pin');

        $this->migration()->up();

        $this->assertTrue($writer->fresh()->hasPermissionTo('view_any_pinterest_pin'));
    }
}
