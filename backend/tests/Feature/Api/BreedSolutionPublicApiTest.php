<?php

namespace Tests\Feature\Api;

use App\Models\BlogCategory;
use App\Models\Breed;
use App\Models\Post;
use App\Models\Solution;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BreedSolutionPublicApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_breed_detail_exposes_the_seo_description_saved_in_the_admin(): void
    {
        $breed = Breed::query()->create([
            'name' => 'Corgi',
            'slug' => 'corgi',
            'body_type' => 'long-backed',
            'description' => 'Plain breed description.',
        ]);
        $breed->seo()->create(['description' => 'A description written for the corgi guide.']);

        $this->getJson('/api/breeds/corgi')
            ->assertOk()
            ->assertJsonPath('data.description', 'Plain breed description.')
            ->assertJsonPath('data.seo.description', 'A description written for the corgi guide.');
    }

    public function test_breed_detail_has_no_seo_when_none_was_saved(): void
    {
        Breed::query()->create(['name' => 'Pug', 'slug' => 'pug', 'description' => 'Plain.']);

        $this->getJson('/api/breeds/pug')
            ->assertOk()
            ->assertJsonPath('data.seo', null);
    }

    public function test_post_lists_the_slug_of_each_breed_and_solution_so_the_page_can_link_to_them(): void
    {
        $post = Post::query()->create([
            'blog_category_id' => BlogCategory::factory()->create()->id,
            'type' => Post::TYPE_ARTICLE,
            'title' => 'Ramp guide',
            'slug' => 'ramp-guide',
            'content' => '<p>Content.</p>',
            'author' => 'PetPosture',
            'read_time' => '1 min read',
            'status' => 'published',
            'published_at' => now()->subHour(),
        ]);
        $breed = Breed::query()->create(['name' => 'Dachshund', 'slug' => 'dachshund']);
        $solution = Solution::query()->create(['name' => 'Mobility', 'slug' => 'mobility']);
        $post->breeds()->attach($breed->id);
        $post->solutions()->attach($solution->id);

        $this->getJson('/api/posts/ramp-guide')
            ->assertOk()
            ->assertJsonPath('data.breeds.0.name', 'Dachshund')
            ->assertJsonPath('data.breeds.0.slug', 'dachshund')
            ->assertJsonPath('data.solutions.0.name', 'Mobility')
            ->assertJsonPath('data.solutions.0.slug', 'mobility');
    }
}
