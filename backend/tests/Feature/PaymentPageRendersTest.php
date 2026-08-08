<?php

namespace Tests\Feature;

use App\Filament\Pages\Payment;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class PaymentPageRendersTest extends TestCase
{
    use RefreshDatabase;

    public function test_payment_page_renders_without_error(): void
    {
        Role::firstOrCreate(['name' => 'admin', 'guard_name' => 'web']);
        $user = User::factory()->create();
        $user->assignRole('admin');
        $this->actingAs($user);

        Livewire::test(Payment::class)->assertSuccessful();
    }
}
