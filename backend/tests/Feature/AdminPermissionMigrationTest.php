<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class AdminPermissionMigrationTest extends TestCase
{
    use RefreshDatabase;

    public function test_deployment_migrations_install_the_business_role_matrix(): void
    {
        $productManager = Role::findByName('Product Manager');
        $orderManager = Role::findByName('Order Manager');
        $support = Role::findByName('Support');

        $this->assertTrue($productManager->hasPermissionTo('publish_product'));
        $this->assertTrue($orderManager->hasPermissionTo('refund_order'));
        $this->assertTrue($support->hasPermissionTo('update_review'));
        $this->assertFalse($support->hasPermissionTo('refund_order'));
    }
}
