<?php

namespace Tests\Feature;

use App\Models\Breed;
use App\Models\Page;
use App\Models\Post;
use App\Models\Setting;
use App\Models\SiteMedia;
use App\Models\Solution;
use App\Models\User;
use App\Services\CloudflareCacheService;
use App\Services\PublicContentPurgeCoordinator;
use App\ValueObjects\CloudflarePurgeResult;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\Cache;
use Laravel\Sanctum\Sanctum;
use Lunar\Models\Brand;
use Lunar\Models\Product;
use Mockery;
use PHPUnit\Framework\Attributes\DataProvider;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class PublicContentPurgeTest extends TestCase
{
    use RefreshDatabase;

    /**
     * @return array<string, array{class-string, string}>
     */
    public static function publicContentEvents(): array
    {
        $models = [
            Page::class,
            Post::class,
            Product::class,
            Brand::class,
            Breed::class,
            Solution::class,
            Setting::class,
            SiteMedia::class,
        ];

        $events = [];
        foreach ($models as $model) {
            foreach (['saved', 'deleted'] as $event) {
                $events[class_basename($model).' '.$event] = [$model, $event];
            }
        }

        return $events;
    }

    #[DataProvider('publicContentEvents')]
    public function test_public_content_model_events_call_the_purge_coordinator_once(string $modelClass, string $event): void
    {
        $coordinator = Mockery::mock(PublicContentPurgeCoordinator::class);
        $coordinator->shouldReceive('purge')->once()->andReturn(new CloudflarePurgeResult(true, false));
        $this->app->instance(PublicContentPurgeCoordinator::class, $coordinator);

        event("eloquent.{$event}: {$modelClass}", [new $modelClass]);
    }

    public function test_setting_events_keep_per_key_cache_invalidation(): void
    {
        $coordinator = Mockery::mock(PublicContentPurgeCoordinator::class);
        $coordinator->shouldReceive('purge')->twice()->andReturn(new CloudflarePurgeResult(true, false));
        $this->app->instance(PublicContentPurgeCoordinator::class, $coordinator);
        $setting = new Setting(['key' => 'storefront.name']);

        Cache::put('setting:storefront.name', 'cached');
        event('eloquent.saved: '.Setting::class, [$setting]);
        $this->assertFalse(Cache::has('setting:storefront.name'));

        Cache::put('setting:storefront.name', 'cached');
        event('eloquent.deleted: '.Setting::class, [$setting]);
        $this->assertFalse(Cache::has('setting:storefront.name'));
    }

    public function test_page_update_succeeds_and_warns_when_immediate_purge_fails(): void
    {
        Bus::fake();
        $this->seed(RoleSeeder::class);
        $user = User::factory()->create();
        $user->assignRole(Role::findByName('admin'));
        Sanctum::actingAs($user);
        $page = Page::query()->createQuietly([
            'title' => 'Privacy Policy',
            'slug' => 'privacy-policy',
            'content' => 'Original content',
            'status' => 'published',
            'is_active' => true,
            'is_core' => false,
        ]);

        $service = $this->mock(CloudflareCacheService::class);
        $service->shouldReceive('purgeAll')->once()->andReturn(
            new CloudflarePurgeResult(false, true, 500, 'Cloudflare cache purge failed.'),
        );

        $response = $this->putJson('/api/admin/pages/'.$page->id, [
            'title' => 'Privacy Policy Updated',
            'slug' => 'privacy-policy',
            'content' => 'Updated content',
            'status' => 'published',
            'is_active' => true,
        ]);

        $response
            ->assertOk()
            ->assertHeader('X-PetPosture-Cache-Warning', 'purge-pending')
            ->assertJsonPath('title', 'Privacy Policy Updated');
    }
}
