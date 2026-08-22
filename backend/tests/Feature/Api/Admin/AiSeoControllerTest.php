<?php

namespace Tests\Feature\Api\Admin;

use App\Models\User;
use App\Services\AiSeoGeneratorService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class AiSeoControllerTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Role::firstOrCreate(['name' => 'admin', 'guard_name' => 'web']);
        Role::firstOrCreate(['name' => 'customer', 'guard_name' => 'web']);
    }

    public function test_unauthenticated_request_is_rejected(): void
    {
        $this->postJson('/api/admin/posts/generate-seo', ['title' => 'T'])->assertUnauthorized();
    }

    public function test_customer_role_cannot_generate_seo(): void
    {
        $user = User::factory()->create();
        $user->assignRole('customer');
        Sanctum::actingAs($user);

        $this->postJson('/api/admin/posts/generate-seo', ['title' => 'T'])->assertForbidden();
    }

    public function test_generate_returns_service_output_verbatim(): void
    {
        $user = User::factory()->create();
        $user->assignRole('admin');
        Sanctum::actingAs($user);

        $output = [
            'seo_title' => 'SEO Title',
            'focus_keyphrase' => 'dog ramps',
            'meta_description' => 'Meta description',
            'social_title' => 'Social Title',
            'social_description' => 'Social description',
        ];

        $this->mock(AiSeoGeneratorService::class, function ($mock) use ($output) {
            $mock->shouldReceive('generate')
                ->once()
                ->with('My Title', '<p>Body</p>')
                ->andReturn($output);
        });

        $this->postJson('/api/admin/posts/generate-seo', [
            'title' => 'My Title',
            'content' => '<p>Body</p>',
        ])
            ->assertOk()
            ->assertExactJson($output);
    }

    public function test_content_is_optional(): void
    {
        $user = User::factory()->create();
        $user->assignRole('admin');
        Sanctum::actingAs($user);

        $this->mock(AiSeoGeneratorService::class, function ($mock) {
            $mock->shouldReceive('generate')
                ->once()
                ->with('My Title', null)
                ->andReturn([
                    'seo_title' => 'T', 'focus_keyphrase' => 'k', 'meta_description' => 'd',
                    'social_title' => 'st', 'social_description' => 'sd',
                ]);
        });

        $this->postJson('/api/admin/posts/generate-seo', ['title' => 'My Title'])->assertOk();
    }

    public function test_title_is_required(): void
    {
        $user = User::factory()->create();
        $user->assignRole('admin');
        Sanctum::actingAs($user);

        $this->postJson('/api/admin/posts/generate-seo', ['content' => '<p>x</p>'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['title']);
    }

    public function test_service_exception_returns_422_with_message(): void
    {
        $user = User::factory()->create();
        $user->assignRole('admin');
        Sanctum::actingAs($user);

        $this->mock(AiSeoGeneratorService::class, function ($mock) {
            $mock->shouldReceive('generate')->once()->andThrow(new \RuntimeException('API key not configured'));
        });

        $this->postJson('/api/admin/posts/generate-seo', ['title' => 'My Title'])
            ->assertStatus(422)
            ->assertJson(['message' => 'API key not configured']);
    }
}
