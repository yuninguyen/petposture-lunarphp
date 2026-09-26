<?php

namespace Tests\Feature\Api\Admin;

use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class NotificationTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RoleSeeder::class);

        foreach (['super_admin', 'admin', 'staff', 'Product Manager', 'Order Manager', 'Support', 'customer'] as $role) {
            Role::firstOrCreate(['name' => $role, 'guard_name' => 'web']);
        }

        $this->admin = User::factory()->create([
            'is_active' => true,
        ]);
        $this->admin->assignRole('admin');
    }

    public function test_unauthenticated_requests_return_401(): void
    {
        $this->getJson('/api/admin/notifications')->assertUnauthorized();
        $this->patchJson('/api/admin/notifications/123/read')->assertUnauthorized();
        $this->postJson('/api/admin/notifications/read-all')->assertUnauthorized();
    }

    public function test_customer_cannot_access_notifications_returns_403(): void
    {
        $customer = User::factory()->create(['is_active' => true]);
        $customer->assignRole('customer');

        Sanctum::actingAs($customer);

        $this->getJson('/api/admin/notifications')->assertForbidden();
        $this->patchJson('/api/admin/notifications/123/read')->assertForbidden();
        $this->postJson('/api/admin/notifications/read-all')->assertForbidden();
    }

    public function test_admin_can_list_notifications_with_pagination_and_unread_count(): void
    {
        Sanctum::actingAs($this->admin);

        // 1. Create notifications for the admin
        $this->admin->notifications()->create([
            'id' => (string) Str::uuid(),
            'type' => 'App\Notifications\NewCustomerRegisteredNotification',
            'data' => [
                'type' => 'new_customer',
                'icon' => 'heroicon-o-user-plus',
                'color' => 'info',
                'title' => 'New Customer',
                'body' => 'Customer A created an account.',
                'url' => 'http://localhost:8000/admin/users/1/edit',
            ],
            'read_at' => null,
            'created_at' => now()->subMinutes(10),
        ]);

        $this->admin->notifications()->create([
            'id' => (string) Str::uuid(),
            'type' => 'App\Notifications\OrderPlacedNotification',
            'data' => [
                'type' => 'order_placed',
                'icon' => 'heroicon-o-shopping-bag',
                'color' => 'success',
                'title' => 'New Order',
                'body' => 'Order #101 was placed.',
                'url' => 'http://localhost:8000/admin/orders/101',
            ],
            'read_at' => null,
            'created_at' => now()->subMinutes(5),
        ]);

        $this->admin->notifications()->create([
            'id' => (string) Str::uuid(),
            'type' => 'App\Notifications\NewReviewNotification',
            'data' => [
                'type' => 'new_review',
                'icon' => 'heroicon-o-star',
                'color' => 'warning',
                'title' => 'New Review',
                'body' => '5-star review received.',
                'url' => 'http://localhost:8000/admin/reviews/5/edit',
            ],
            'read_at' => now()->subMinutes(20),
            'created_at' => now()->subMinutes(30),
        ]);

        // 2. Notification for another user (should NOT be returned)
        $otherUser = User::factory()->create(['is_active' => true]);
        $otherUser->assignRole('admin');
        $otherUser->notifications()->create([
            'id' => (string) Str::uuid(),
            'type' => 'App\Notifications\NewCustomerRegisteredNotification',
            'data' => [
                'type' => 'new_customer',
                'title' => 'Private to Other',
                'body' => 'Should not leak.',
            ],
            'read_at' => null,
        ]);

        $response = $this->getJson('/api/admin/notifications');

        $response->assertOk()
            ->assertJsonStructure([
                'data' => [
                    '*' => [
                        'id',
                        'type',
                        'icon',
                        'color',
                        'title',
                        'body',
                        'url',
                        'read_at',
                        'created_at',
                    ],
                ],
                'meta' => [
                    'current_page',
                    'last_page',
                    'per_page',
                    'total',
                    'unread_count',
                ],
            ]);

        $data = $response->json('data');
        $this->assertCount(3, $data);
        $this->assertSame(3, $response->json('meta.total'));
        $this->assertSame(2, $response->json('meta.unread_count'));

        // Verify latest first order
        $this->assertSame('New Order', $data[0]['title']);
        $this->assertSame('order_placed', $data[0]['type']);
        $this->assertNull($data[0]['read_at']);
    }

    public function test_non_core_admin_roles_can_access_notifications(): void
    {
        foreach (['Product Manager', 'Order Manager', 'Support'] as $roleName) {
            $user = User::factory()->create(['is_active' => true]);
            $user->assignRole($roleName);

            Sanctum::actingAs($user);

            $response = $this->getJson('/api/admin/notifications');
            $response->assertOk();
            $this->assertSame(0, $response->json('meta.unread_count'));
        }
    }

    public function test_user_can_mark_single_notification_as_read(): void
    {
        Sanctum::actingAs($this->admin);

        $notification = $this->admin->notifications()->create([
            'id' => (string) Str::uuid(),
            'type' => 'App\Notifications\NewCustomerRegisteredNotification',
            'data' => [
                'type' => 'new_customer',
                'title' => 'Mark Me Read',
                'body' => 'Testing mark as read.',
            ],
            'read_at' => null,
        ]);

        $this->assertNull($notification->read_at);

        $response = $this->patchJson("/api/admin/notifications/{$notification->id}/read");
        $response->assertOk()->assertJson(['success' => true]);

        $notification->refresh();
        $this->assertNotNull($notification->read_at);
    }

    public function test_marking_another_users_notification_as_read_returns_404(): void
    {
        $otherUser = User::factory()->create(['is_active' => true]);
        $otherUser->assignRole('admin');

        $notification = $otherUser->notifications()->create([
            'id' => (string) Str::uuid(),
            'type' => 'App\Notifications\NewCustomerRegisteredNotification',
            'data' => [
                'type' => 'new_customer',
                'title' => 'Other User Notification',
                'body' => 'Belongs to other user.',
            ],
            'read_at' => null,
        ]);

        Sanctum::actingAs($this->admin);

        $response = $this->patchJson("/api/admin/notifications/{$notification->id}/read");
        $response->assertNotFound();

        $notification->refresh();
        $this->assertNull($notification->read_at);
    }

    public function test_user_can_mark_all_notifications_as_read(): void
    {
        Sanctum::actingAs($this->admin);

        // 3 unread for admin
        for ($i = 0; $i < 3; $i++) {
            $this->admin->notifications()->create([
                'id' => (string) Str::uuid(),
                'type' => 'App\Notifications\OrderPlacedNotification',
                'data' => ['title' => "Order {$i}"],
                'read_at' => null,
            ]);
        }

        // 1 unread for other user
        $otherUser = User::factory()->create(['is_active' => true]);
        $otherUser->assignRole('admin');
        $otherNotification = $otherUser->notifications()->create([
            'id' => (string) Str::uuid(),
            'type' => 'App\Notifications\OrderPlacedNotification',
            'data' => ['title' => 'Other order'],
            'read_at' => null,
        ]);

        $this->assertSame(3, $this->admin->unreadNotifications()->count());
        $this->assertSame(1, $otherUser->unreadNotifications()->count());

        $response = $this->postJson('/api/admin/notifications/read-all');
        $response->assertOk()->assertJson(['success' => true]);

        $this->assertSame(0, $this->admin->unreadNotifications()->count());
        $this->assertSame(1, $otherUser->unreadNotifications()->count());
    }
}
