<?php

namespace Tests\Feature\Api\Admin;

use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Auth\Events\Login;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Lunar\Models\Order;
use Spatie\Activitylog\Models\Activity;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class ProfileControllerTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RoleSeeder::class);

        foreach (['super_admin', 'admin', 'staff', 'Product Manager', 'Order Manager', 'Support', 'customer'] as $role) {
            Role::firstOrCreate(['name' => $role, 'guard_name' => 'web']);
        }
    }

    public function test_unauthenticated_request_is_rejected(): void
    {
        $this->getJson('/api/admin/profile')->assertUnauthorized();
        $this->putJson('/api/admin/profile', [])->assertUnauthorized();
        $this->putJson('/api/admin/profile/password', [])->assertUnauthorized();
    }

    public function test_customer_cannot_access_admin_profile(): void
    {
        Sanctum::actingAs($this->userWithRole('customer'));

        $this->getJson('/api/admin/profile')->assertForbidden();
        $this->putJson('/api/admin/profile', ['name' => 'Test', 'email' => 't@example.com'])->assertForbidden();
        $this->putJson('/api/admin/profile/password', [])->assertForbidden();
    }

    public function test_product_manager_can_access_own_profile_and_change_password(): void
    {
        $user = User::factory()->create([
            'name' => 'PM User',
            'email' => 'pm@example.com',
            'password' => Hash::make('original-password-123'),
        ]);
        $user->assignRole('Product Manager');
        Sanctum::actingAs($user);

        // GET profile
        $getResponse = $this->getJson('/api/admin/profile')->assertOk();
        $this->assertSame('PM User', $getResponse->json('data.name'));
        $this->assertSame('pm@example.com', $getResponse->json('data.email'));

        // PUT profile update
        $updateResponse = $this->putJson('/api/admin/profile', [
            'name' => 'PM User Updated',
            'email' => 'pm-updated@example.com',
        ])->assertOk();
        $this->assertSame('PM User Updated', $updateResponse->json('data.name'));
        $this->assertSame('pm-updated@example.com', $updateResponse->json('data.email'));

        // PUT password update
        $passwordResponse = $this->putJson('/api/admin/profile/password', [
            'current_password' => 'original-password-123',
            'password' => 'new-secure-password-456',
            'password_confirmation' => 'new-secure-password-456',
        ])->assertOk();

        $this->assertTrue(Hash::check('new-secure-password-456', $user->refresh()->password));
    }

    public function test_order_manager_and_support_can_access_profile(): void
    {
        $orderManager = $this->userWithRole('Order Manager');
        Sanctum::actingAs($orderManager);
        $this->getJson('/api/admin/profile')->assertOk();

        $support = $this->userWithRole('Support');
        Sanctum::actingAs($support);
        $this->getJson('/api/admin/profile')->assertOk();
    }

    public function test_get_profile_returns_user_details_and_system_wide_activity_labeled_honestly(): void
    {
        $user = User::factory()->create([
            'name' => 'Sarah Connor',
            'email' => 'sarah@example.com',
            'last_login_at' => now()->subHours(3),
        ]);
        $user->assignRole('admin');
        Sanctum::actingAs($user);

        // Create an activity log entry without a causer (system event)
        if (class_exists(Activity::class)) {
            activity()
                ->performedOn($user)
                ->log('user account created');
        }

        $response = $this->getJson('/api/admin/profile')->assertOk();

        $response->assertJsonStructure([
            'data' => [
                'id',
                'name',
                'email',
                'role_labels',
                'joined_at',
                'last_login_at',
                'recent_activity' => [
                    'scope',
                    'label',
                    'items' => [
                        '*' => [
                            'id',
                            'description',
                            'subject_type',
                            'created_at',
                            'created_at_human',
                        ],
                    ],
                ],
            ],
        ]);

        $this->assertSame('system', $response->json('data.recent_activity.scope'));
        $this->assertSame('Recent system activity', $response->json('data.recent_activity.label'));
        $this->assertNotNull($response->json('data.last_login_at'));
    }

    public function test_login_event_listener_updates_last_login_at(): void
    {
        $user = User::factory()->create([
            'email' => 'login-test@example.com',
            'password' => Hash::make('password123'),
            'last_login_at' => null,
        ]);

        event(new Login('web', $user, false));

        $user->refresh();
        $this->assertNotNull($user->last_login_at);
        $this->assertTrue(now()->diffInSeconds($user->last_login_at) < 10);
    }

    public function test_put_profile_validates_required_fields_and_unique_email_excluding_self(): void
    {
        $user1 = User::factory()->create(['email' => 'user1@example.com']);
        $user1->assignRole('admin');

        $user2 = User::factory()->create(['email' => 'user2@example.com']);
        $user2->assignRole('admin');

        Sanctum::actingAs($user1);

        // Blank name/email fails
        $this->putJson('/api/admin/profile', ['name' => '', 'email' => ''])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['name', 'email']);

        // Keeping own email succeeds
        $this->putJson('/api/admin/profile', [
            'name' => 'User One',
            'email' => 'user1@example.com',
        ])->assertOk();

        // Taking user2 email fails
        $this->putJson('/api/admin/profile', [
            'name' => 'User One',
            'email' => 'user2@example.com',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['email']);
    }

    public function test_put_profile_password_requires_current_password_and_confirmation(): void
    {
        $user = User::factory()->create([
            'password' => Hash::make('correct-current-pass'),
        ]);
        $user->assignRole('admin');
        Sanctum::actingAs($user);

        // Incorrect current password
        $this->putJson('/api/admin/profile/password', [
            'current_password' => 'wrong-pass',
            'password' => 'new-secure-pass-999',
            'password_confirmation' => 'new-secure-pass-999',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['current_password']);

        // Mismatched confirmation
        $this->putJson('/api/admin/profile/password', [
            'current_password' => 'correct-current-pass',
            'password' => 'new-secure-pass-999',
            'password_confirmation' => 'different-pass',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['password']);
    }

    private function userWithRole(string $role): User
    {
        $user = User::factory()->create();
        $user->assignRole($role);

        return $user;
    }
}
