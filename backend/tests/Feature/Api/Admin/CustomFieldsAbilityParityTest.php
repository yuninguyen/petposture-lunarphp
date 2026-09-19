<?php

declare(strict_types=1);

namespace Tests\Feature\Api\Admin;

use App\Models\User;
use App\Security\AdminAbilityRegistry;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Lunar\FieldTypes\Text;
use Lunar\Models\Attribute;
use Lunar\Models\AttributeGroup;
use Lunar\Models\ProductType;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

/**
 * Parity test suite for Phase 6b: Custom Fields Domain Migration.
 *
 * Verifies exact 100% status code parity across all 7 roles and all custom field actions:
 * - Allowed (super_admin, admin, staff, Product Manager): 200, 201, 204.
 * - Blocked (Order Manager, Support, customer): 403 Forbidden.
 */
class CustomFieldsAbilityParityTest extends TestCase
{
    use RefreshDatabase;

    private const ALLOWED_ROLES = [
        'super_admin',
        'admin',
        'staff',
        'Product Manager',
    ];

    private const BLOCKED_ROLES = [
        'Order Manager',
        'Support',
        'customer',
    ];

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
    }

    public function test_allowed_roles_can_list_custom_fields(): void
    {
        $this->makeAttribute('Parity Field Alpha', 'parity_field_alpha');

        foreach (self::ALLOWED_ROLES as $role) {
            $this->actingAsRole($role);

            $response = $this->getJson('/api/admin/custom-fields');

            $response->assertOk(
                "Role '{$role}' must be permitted to list custom fields (GET /api/admin/custom-fields)."
            );
        }
    }

    public function test_blocked_roles_cannot_list_custom_fields(): void
    {
        $this->makeAttribute('Parity Field Alpha', 'parity_field_alpha');

        foreach (self::BLOCKED_ROLES as $role) {
            $this->actingAsRole($role);

            $response = $this->getJson('/api/admin/custom-fields');

            $response->assertForbidden(
                "Role '{$role}' must be forbidden from listing custom fields (GET /api/admin/custom-fields)."
            );
        }
    }

    public function test_allowed_roles_can_show_custom_field(): void
    {
        $attribute = $this->makeAttribute('Parity Field Show', 'parity_field_show');

        foreach (self::ALLOWED_ROLES as $role) {
            $this->actingAsRole($role);

            $response = $this->getJson("/api/admin/custom-fields/{$attribute->id}");

            $response->assertOk(
                "Role '{$role}' must be permitted to show custom field (GET /api/admin/custom-fields/{$attribute->id})."
            );
            $response->assertJsonPath('data.name', 'Parity Field Show');
        }
    }

    public function test_blocked_roles_cannot_show_custom_field(): void
    {
        $attribute = $this->makeAttribute('Parity Field Show', 'parity_field_show');

        foreach (self::BLOCKED_ROLES as $role) {
            $this->actingAsRole($role);

            $response = $this->getJson("/api/admin/custom-fields/{$attribute->id}");

            $response->assertForbidden(
                "Role '{$role}' must be forbidden from showing custom field (GET /api/admin/custom-fields/{$attribute->id})."
            );
        }
    }

    public function test_allowed_roles_can_create_custom_field(): void
    {
        $type = ProductType::query()->create(['name' => 'Custom Field Target Type']);
        $counter = 1;

        foreach (self::ALLOWED_ROLES as $role) {
            $this->actingAsRole($role);

            $fieldName = "Field Created By {$role} {$counter}";
            $counter++;

            $response = $this->postJson('/api/admin/custom-fields', [
                'name' => $fieldName,
                'target' => 'product',
                'field_type' => 'text',
                'required' => false,
                'product_type_ids' => [$type->id],
            ]);

            $response->assertCreated(
                "Role '{$role}' must be permitted to create custom field (POST /api/admin/custom-fields)."
            );
            $response->assertJsonPath('data.name', $fieldName);
        }
    }

    public function test_blocked_roles_cannot_create_custom_field(): void
    {
        $type = ProductType::query()->create(['name' => 'Custom Field Target Type 2']);
        $counter = 1;

        foreach (self::BLOCKED_ROLES as $role) {
            $this->actingAsRole($role);

            $fieldName = "Unauthorized Field {$role} {$counter}";
            $counter++;

            $response = $this->postJson('/api/admin/custom-fields', [
                'name' => $fieldName,
                'target' => 'product',
                'field_type' => 'text',
                'required' => false,
                'product_type_ids' => [$type->id],
            ]);

            $response->assertForbidden(
                "Role '{$role}' must be forbidden from creating custom field (POST /api/admin/custom-fields)."
            );
        }
    }

    public function test_allowed_roles_can_update_custom_field(): void
    {
        $type = ProductType::query()->create(['name' => 'Custom Field Update Target Type']);
        $attribute = $this->makeAttribute('Initial Field Update Name', 'initial_field_update_name');
        $counter = 1;

        foreach (self::ALLOWED_ROLES as $role) {
            $this->actingAsRole($role);

            $newName = "Field Updated By {$role} {$counter}";
            $counter++;

            $response = $this->putJson("/api/admin/custom-fields/{$attribute->id}", [
                'name' => $newName,
                'required' => false,
                'product_type_ids' => [$type->id],
            ]);

            $response->assertOk(
                "Role '{$role}' must be permitted to update custom field (PUT /api/admin/custom-fields/{$attribute->id})."
            );
            $response->assertJsonPath('data.name', $newName);
        }
    }

    public function test_blocked_roles_cannot_update_custom_field(): void
    {
        $attribute = $this->makeAttribute('Initial Field Protected Name', 'initial_field_protected_name');

        foreach (self::BLOCKED_ROLES as $role) {
            $this->actingAsRole($role);

            $response = $this->putJson("/api/admin/custom-fields/{$attribute->id}", [
                'name' => "Tampered By {$role}",
            ]);

            $response->assertForbidden(
                "Role '{$role}' must be forbidden from updating custom field (PUT /api/admin/custom-fields/{$attribute->id})."
            );
        }
    }

    public function test_allowed_roles_can_delete_custom_field(): void
    {
        $counter = 1;
        foreach (self::ALLOWED_ROLES as $role) {
            $this->actingAsRole($role);

            $attribute = $this->makeAttribute("Field To Delete By {$role} {$counter}", "delete_{$counter}_".strtolower(str_replace(' ', '_', $role)));
            $counter++;

            $response = $this->deleteJson("/api/admin/custom-fields/{$attribute->id}");

            $response->assertNoContent();

            $this->assertDatabaseMissing('lunar_attributes', [
                'id' => $attribute->id,
            ]);
        }
    }

    public function test_blocked_roles_cannot_delete_custom_field(): void
    {
        $attribute = $this->makeAttribute('Field Protected From Deletion', 'field_protected_from_deletion');

        foreach (self::BLOCKED_ROLES as $role) {
            $this->actingAsRole($role);

            $response = $this->deleteJson("/api/admin/custom-fields/{$attribute->id}");

            $response->assertForbidden(
                "Role '{$role}' must be forbidden from deleting custom field (DELETE /api/admin/custom-fields/{$attribute->id})."
            );

            $this->assertDatabaseHas('lunar_attributes', [
                'id' => $attribute->id,
            ]);
        }
    }

    public function test_migration_seeds_and_assigns_custom_field_permissions_to_existing_product_manager(): void
    {
        $migration = require database_path('migrations/2026_09_20_000004_seed_custom_fields_domain_permissions.php');
        $migration->up();

        $pm = Role::query()->where('name', 'Product Manager')->where('guard_name', 'web')->first();
        $this->assertNotNull($pm);

        foreach (AdminAbilityRegistry::CUSTOM_FIELDS as $permission) {
            $this->assertTrue(
                $pm->hasPermissionTo($permission),
                "Product Manager must have permission '{$permission}' after migration."
            );
        }
    }

    public function test_unauthenticated_request_is_unauthorized_for_all_endpoints(): void
    {
        $attribute = $this->makeAttribute('Guest Field', 'guest_field');

        $this->getJson('/api/admin/custom-fields')->assertUnauthorized();
        $this->postJson('/api/admin/custom-fields', ['name' => 'Guest New'])->assertUnauthorized();
        $this->getJson("/api/admin/custom-fields/{$attribute->id}")->assertUnauthorized();
        $this->putJson("/api/admin/custom-fields/{$attribute->id}", ['name' => 'Guest Edit'])->assertUnauthorized();
        $this->deleteJson("/api/admin/custom-fields/{$attribute->id}")->assertUnauthorized();
    }

    private function makeAttribute(string $name, string $handle): Attribute
    {
        $group = AttributeGroup::query()->firstOrCreate(
            ['handle' => 'test_group_parity_product'],
            [
                'attributable_type' => 'product',
                'name' => ['en' => 'Test'],
                'position' => 1,
            ]
        );

        return Attribute::query()->create([
            'attribute_type' => 'product',
            'attribute_group_id' => $group->id,
            'position' => 1,
            'name' => ['en' => $name],
            'description' => null,
            'handle' => $handle,
            'section' => 'custom',
            'type' => Text::class,
            'required' => false,
            'default_value' => null,
            'configuration' => ['richtext' => false],
            'system' => false,
            'validation_rules' => null,
            'filterable' => false,
            'searchable' => false,
        ]);
    }

    private function actingAsRole(string $role): User
    {
        $user = User::factory()->create();
        $user->assignRole($role);
        Sanctum::actingAs($user);

        return $user;
    }
}
