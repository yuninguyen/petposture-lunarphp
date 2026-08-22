<?php

namespace Tests\Feature\Api\Admin;

use App\Models\BlogCategory;
use App\Models\BlogTag;
use App\Models\Breed;
use App\Models\Post;
use App\Models\Solution;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class PostControllerTaxonomyTest extends TestCase
{
    use RefreshDatabase;

    protected BlogCategory $category;

    protected function setUp(): void
    {
        parent::setUp();
        Role::firstOrCreate(['name' => 'admin', 'guard_name' => 'web']);
        $user = User::factory()->create();
        $user->assignRole('admin');
        Sanctum::actingAs($user);

        $this->category = BlogCategory::factory()->create();
    }

    protected function basePayload(array $overrides = []): array
    {
        return array_merge([
            'blog_category_id' => $this->category->id,
            'title' => 'Taxonomy Post',
            'slug' => 'taxonomy-post',
            'content' => '<p>Body</p>',
            'status' => 'draft',
            'type' => Post::TYPE_ARTICLE,
        ], $overrides);
    }

    public function test_store_persists_breeds_solutions_and_tags(): void
    {
        $breed = Breed::create(['name' => 'Dachshund', 'slug' => 'dachshund', 'body_type' => 'long-backed']);
        $solution = Solution::create(['name' => 'Mobility', 'slug' => 'mobility']);
        $tag = BlogTag::create(['name' => 'Guides', 'slug' => 'guides']);

        $response = $this->postJson('/api/admin/posts', $this->basePayload([
            'breeds' => [$breed->id],
            'solutions' => [$solution->id],
            'tags' => [$tag->id],
        ]))->assertCreated();

        $this->assertSame('Dachshund', $response->json('data.breeds.0.name'));
        $this->assertSame('Mobility', $response->json('data.solutions.0.name'));
        $this->assertSame('Guides', $response->json('data.tags.0.name'));

        $post = Post::find($response->json('data.id'));
        $this->assertSame([$breed->id], $post->breeds->pluck('id')->all());
        $this->assertSame([$solution->id], $post->solutions->pluck('id')->all());
        $this->assertSame([$tag->id], $post->tags->pluck('id')->all());
    }

    public function test_update_replaces_taxonomy_instead_of_appending(): void
    {
        $breedA = Breed::create(['name' => 'Dachshund', 'slug' => 'dachshund', 'body_type' => 'long-backed']);
        $breedB = Breed::create(['name' => 'Pug', 'slug' => 'pug', 'body_type' => 'flat-faced']);

        $post = Post::create([
            'blog_category_id' => $this->category->id,
            'title' => 'Existing', 'slug' => 'existing', 'content' => '<p>x</p>', 'status' => 'draft',
        ]);
        $post->breeds()->sync([$breedA->id]);

        $this->putJson("/api/admin/posts/{$post->id}", ['breeds' => [$breedB->id]])->assertOk();

        $this->assertSame([$breedB->id], $post->fresh()->breeds->pluck('id')->all());
    }

    public function test_store_rejects_invalid_taxonomy_ids(): void
    {
        $this->postJson('/api/admin/posts', $this->basePayload([
            'breeds' => [99999],
            'solutions' => [99999],
            'tags' => [99999],
        ]))
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['breeds.0', 'solutions.0', 'tags.0']);
    }

    public function test_show_response_includes_taxonomy_with_ids(): void
    {
        $breed = Breed::create(['name' => 'Dachshund', 'slug' => 'dachshund', 'body_type' => 'long-backed']);
        $tag = BlogTag::create(['name' => 'Guides', 'slug' => 'guides']);

        $post = Post::create([
            'blog_category_id' => $this->category->id,
            'title' => 'Existing', 'slug' => 'existing', 'content' => '<p>x</p>', 'status' => 'draft',
        ]);
        $post->breeds()->sync([$breed->id]);
        $post->tags()->sync([$tag->id]);

        $this->getJson("/api/admin/posts/{$post->id}")
            ->assertOk()
            ->assertJsonPath('data.breeds.0.id', (string) $breed->id)
            ->assertJsonPath('data.breeds.0.name', 'Dachshund')
            ->assertJsonPath('data.tags.0.id', (string) $tag->id)
            ->assertJsonPath('data.solutions', []);
    }
}
