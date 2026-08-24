<?php

namespace Tests\Feature\Console;

use App\Models\Breed;
use App\Models\CuratorMedia;
use App\Models\Post;
use App\Models\Solution;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Lunar\Models\Product;
use Tests\TestCase;

class BackfillCuratorMediaFoldersTest extends TestCase
{
    use RefreshDatabase;

    public function test_command_backfills_content_product_and_orphan_media_folders(): void
    {
        $blog = $this->media('blog.jpg');
        $breed = $this->media('breed.jpg');
        $solution = $this->media('solution.jpg');
        $product = $this->media('product.jpg');
        $orphan = $this->media('orphan.jpg', CuratorMedia::FOLDER_BANNER);

        Post::query()->create([
            'title' => 'Post',
            'slug' => 'post',
            'content' => 'Content',
            'featured_media_id' => $blog->id,
        ]);
        Breed::query()->create([
            'name' => 'Breed',
            'slug' => 'breed',
            'featured_media_id' => $breed->id,
        ]);
        Solution::query()->create([
            'name' => 'Solution',
            'slug' => 'solution',
            'featured_media_id' => $solution->id,
        ]);
        DB::table('media')->insert([
            'model_type' => Product::morphName(),
            'model_id' => 999,
            'uuid' => (string) Str::uuid(),
            'collection_name' => 'images',
            'name' => 'Product image',
            'file_name' => 'product.jpg',
            'mime_type' => 'image/jpeg',
            'disk' => 'public',
            'conversions_disk' => 'public',
            'size' => 100,
            'manipulations' => '[]',
            'custom_properties' => json_encode(['curator_media_id' => $product->id]),
            'generated_conversions' => '[]',
            'responsive_images' => '[]',
            'order_column' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->artisan('media:backfill-folders')->assertSuccessful();

        $this->assertSame(CuratorMedia::FOLDER_BLOG, $blog->fresh()->folder);
        $this->assertSame(CuratorMedia::FOLDER_BREED, $breed->fresh()->folder);
        $this->assertSame(CuratorMedia::FOLDER_SOLUTION, $solution->fresh()->folder);
        $this->assertSame(CuratorMedia::FOLDER_PRODUCT, $product->fresh()->folder);
        $this->assertSame(CuratorMedia::FOLDER_GENERAL, $orphan->fresh()->folder);
    }

    public function test_command_skips_missing_owner_columns_and_media_table(): void
    {
        $orphan = $this->media('partial-schema.jpg', CuratorMedia::FOLDER_BANNER);

        Schema::rename('breeds', 'breeds_with_featured_media');
        Schema::create('breeds', function (Blueprint $table): void {
            $table->id();
            $table->string('name');
            $table->string('slug');
            $table->timestamps();
        });
        Schema::rename('media', 'media_unavailable');

        try {
            $this->artisan('media:backfill-folders')->assertSuccessful();

            $this->assertSame(CuratorMedia::FOLDER_GENERAL, $orphan->fresh()->folder);
        } finally {
            Schema::drop('breeds');
            Schema::rename('breeds_with_featured_media', 'breeds');
            Schema::rename('media_unavailable', 'media');
        }
    }

    private function media(string $name, ?string $folder = null): CuratorMedia
    {
        return CuratorMedia::query()->create([
            'disk' => 'public',
            'directory' => 'media',
            'visibility' => 'public',
            'name' => $name,
            'path' => 'media/'.$name,
            'width' => 20,
            'height' => 20,
            'size' => 100,
            'type' => 'image',
            'ext' => 'jpg',
            'folder' => $folder,
        ]);
    }
}
