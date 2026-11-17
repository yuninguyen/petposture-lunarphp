<?php

namespace Tests\Feature;

use App\Models\AffiliateNetwork;
use App\Models\CuratorMedia;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Lunar\FieldTypes\Text;
use Lunar\Models\Attribute;
use Lunar\Models\AttributeGroup;
use Lunar\Models\Currency;
use Lunar\Models\Language;
use Lunar\Models\Product;
use Lunar\Models\ProductType;
use Lunar\Models\TaxClass;
use Tests\TestCase;

class ProductImportTest extends TestCase
{
    use RefreshDatabase;

    private const HEADER = 'Product name,Chewy URL,Variant,Price,Price checked date,Breeds,Solution,affiliate_network_slug,Image file 1,Image URL 1,Alt text 1,Pros,Cons,Our take,Best for note,Problem,Approach,Quick specs';

    private const HANDLES = ['external_url', 'affiliate_network_slug', 'reference_price', 'price_checked_date', 'best_for_breeds', 'solution_tags',
        'pros', 'cons', 'our_take', 'best_for_note', 'problem', 'approach', 'quick_specs'];

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RoleSeeder::class);
        Storage::fake(config('curator.disk'));
        Currency::query()->updateOrCreate(['code' => 'USD'], ['name' => 'US Dollar', 'exchange_rate' => 1, 'decimal_places' => 2, 'enabled' => true, 'default' => true, 'sync_prices' => false]);
        TaxClass::query()->firstOrCreate(['name' => 'Default Tax'], ['default' => true]);
        Language::query()->firstOrCreate(['code' => 'en'], ['name' => 'English', 'default' => true]);
        AffiliateNetwork::query()->firstOrCreate(['slug' => 'chewy'], ['name' => 'Chewy']);

        $type = ProductType::query()->firstOrCreate(['name' => 'General']);
        $group = AttributeGroup::query()->create(['attributable_type' => Product::morphName(), 'name' => ['en' => 'Details'], 'handle' => 'details', 'position' => 1]);
        foreach (['name', ...self::HANDLES] as $position => $handle) {
            $attribute = Attribute::query()->create([
                'attribute_type' => Product::morphName(), 'attribute_group_id' => $group->id, 'position' => $position + 1, 'name' => ['en' => $handle],
                'handle' => $handle, 'section' => null, 'type' => Text::class, 'required' => $handle === 'name', 'default_value' => null,
                'configuration' => ['richtext' => false], 'system' => $handle === 'name', 'validation_rules' => null, 'filterable' => false, 'searchable' => false,
            ]);
            $type->mappedAttributes()->attach($attribute->id);
        }

        Sanctum::actingAs(User::factory()->create()->assignRole('admin'));
    }

    private function csv(string ...$rows): UploadedFile
    {
        return UploadedFile::fake()->createWithContent('picks.csv', self::HEADER."\n".implode("\n", $rows)."\n");
    }

    private function kong(string $image = 'kong-puppy.jpg', string $url = ''): string
    {
        return 'KONG Puppy Chew Dog Toy,https://www.chewy.com/kong-puppy-chew-dog-toy/dp/380565,"Pink, Small",7.46,2026-11-17,all 5 breeds,,,'
            .$image.','.$url.',"KONG Puppy Chew Dog Toy, Pink, Small","Soft rubber'."\n".'Can be filled","Check the size",Based on reviews,Teething puppies,A problem,An approach,"Type: Puppy chew toy'."\n".'Color: Pink"';
    }

    private function libraryPhoto(string $name = 'kong-puppy.jpg'): CuratorMedia
    {
        $disk = config('curator.disk');
        $path = "media/{$name}";
        Storage::disk($disk)->put($path, UploadedFile::fake()->image($name, 40, 40)->getContent());

        return CuratorMedia::query()->create(['disk' => $disk, 'directory' => 'media', 'visibility' => 'public', 'name' => $name, 'path' => $path,
            'width' => 40, 'height' => 40, 'size' => 100, 'type' => 'image', 'ext' => 'jpg', 'folder' => 'product']);
    }

    private function existing(string $name = 'Existing Toy', string $url = 'https://www.chewy.com/existing/dp/1', string $sku = 'EXISTING-TOY'): Product
    {
        $product = Product::query()->create(['product_type_id' => ProductType::first()->id, 'status' => 'published',
            'attribute_data' => ['name' => new Text($name), 'external_url' => new Text($url)]]);
        $product->variants()->create(['tax_class_id' => TaxClass::first()->id, 'sku' => $sku]);

        return $product;
    }

    public function test_preview_shows_what_would_be_created_and_writes_nothing(): void
    {
        $this->libraryPhoto();
        $before = Product::query()->count();

        $response = $this->postJson('/api/admin/products/import/preview', ['file' => $this->csv($this->kong())])->assertOk();

        $response->assertJsonPath('data.summary', ['create' => 1, 'skipped_duplicate' => 0, 'error' => 0])
            ->assertJsonPath('data.rows.0.name', 'KONG Puppy Chew Dog Toy')
            ->assertJsonPath('data.rows.0.status', 'create')
            ->assertJsonPath('data.rows.0.photos.0.source', 'library');
        $this->assertSame($before, Product::query()->count());
    }

    public function test_it_creates_a_published_pick_like_one_entered_by_hand(): void
    {
        $this->libraryPhoto();

        $this->postJson('/api/admin/products/import', ['file' => $this->csv($this->kong())])
            ->assertCreated()
            ->assertJsonPath('data.created.0.slug', 'kong-puppy-chew-dog-toy');

        $product = Product::query()->firstOrFail();
        $this->assertSame('published', $product->status);
        $this->assertSame('General', $product->productType->name);
        $this->assertSame('KONG Puppy Chew Dog Toy', $product->translateAttribute('name'));
        $this->assertSame('chewy', $product->translateAttribute('affiliate_network_slug'));
        $this->assertSame('7.46', $product->translateAttribute('reference_price'));
        $this->assertSame('2026-11-17', $product->translateAttribute('price_checked_date'));
        $this->assertSame('corgi, dachshund, english-bulldog, french-bulldog, pug', $product->translateAttribute('best_for_breeds'));
        $this->assertSame("Soft rubber\nCan be filled", $product->translateAttribute('pros'));
        $this->assertSame("Type: Puppy chew toy\nColor: Pink", $product->translateAttribute('quick_specs'));

        $variant = $product->variants()->firstOrFail();
        $this->assertSame('KONG-PUPPY-CHEW-DOG-TOY-PINK-SMALL', $variant->sku);
        $this->assertSame(746, $variant->prices()->firstOrFail()->price->value);
        $this->assertSame('kong-puppy-chew-dog-toy', $product->urls()->firstOrFail()->slug);

        $media = $product->images()->firstOrFail();
        $this->assertSame('KONG Puppy Chew Dog Toy, Pink, Small', $media->getCustomProperty('alt'));
        $this->assertTrue((bool) $media->getCustomProperty('primary'));
        $this->assertSame('KONG Puppy Chew Dog Toy, Pink, Small', $this->getJson('/api/products/kong-puppy-chew-dog-toy')->json('data.images.0.alt'));
    }

    public function test_it_never_changes_an_existing_product_and_reports_duplicates(): void
    {
        $existing = $this->existing('KONG Puppy Chew Dog Toy');
        $other = $this->existing('Another Toy', 'https://www.chewy.com/kong-puppy-chew-dog-toy/dp/380565', 'ANOTHER-TOY');

        $this->postJson('/api/admin/products/import', ['file' => $this->csv($this->kong(), $this->kong())])
            ->assertCreated()
            ->assertJsonCount(0, 'data.created')
            ->assertJsonCount(2, 'data.skipped')
            ->assertJsonPath('data.skipped.0.reason', 'A product with this name already exists.');

        $this->assertSame(2, Product::query()->count());
        $this->assertSame('https://www.chewy.com/existing/dp/1', $existing->fresh()->translateAttribute('external_url'));
        $this->assertSame('Another Toy', $other->fresh()->translateAttribute('name'));
    }

    private function brandFile(string $brand): UploadedFile
    {
        return UploadedFile::fake()->createWithContent('picks.csv', "Product name,Chewy URL,Price,Brand\nKONG Toy,https://www.chewy.com/kong/dp/1,7.46,{$brand}\n");
    }

    public function test_the_brand_column_sets_the_brand_of_the_pick_matching_by_name_without_case(): void
    {
        $brand = \Lunar\Models\Brand::query()->create(['name' => 'KONG']);

        $this->postJson('/api/admin/products/import', ['file' => $this->brandFile(' kong ')])->assertCreated()->assertJsonCount(1, 'data.created');

        $this->assertSame($brand->id, Product::query()->firstOrFail()->brand_id);
    }

    public function test_an_unknown_brand_flags_the_row_instead_of_creating_a_new_brand(): void
    {
        \Lunar\Models\Brand::query()->create(['name' => 'KONG']);

        $this->postJson('/api/admin/products/import/preview', ['file' => $this->brandFile('Kongg')])
            ->assertOk()
            ->assertJsonPath('data.rows.0.status', 'error')
            ->assertJsonPath('data.rows.0.brand', 'Kongg');
        $this->postJson('/api/admin/products/import', ['file' => $this->brandFile('Kongg')])->assertCreated()->assertJsonCount(1, 'data.failed');

        $this->assertSame(0, Product::query()->count());
        $this->assertSame(1, \Lunar\Models\Brand::query()->count());
    }

    public function test_a_blank_brand_leaves_the_pick_without_one(): void
    {
        $this->postJson('/api/admin/products/import', ['file' => $this->brandFile('')])->assertCreated()->assertJsonCount(1, 'data.created');

        $this->assertNull(Product::query()->firstOrFail()->brand_id);
    }

    public function test_a_second_row_with_the_same_chewy_url_in_the_file_is_skipped(): void
    {
        $this->libraryPhoto();
        $second = str_replace('KONG Puppy Chew Dog Toy,', 'KONG Puppy Chew Toy Copy,', $this->kong());

        $this->postJson('/api/admin/products/import', ['file' => $this->csv($this->kong(), $second)])
            ->assertCreated()
            ->assertJsonCount(1, 'data.created')
            ->assertJsonPath('data.skipped.0.reason', 'The same Chewy URL appears earlier in this file.');
    }

    public function test_a_generated_sku_that_is_already_used_is_flagged_as_an_error(): void
    {
        $this->existing('Other', 'https://www.chewy.com/other/dp/2', 'KONG-PUPPY-CHEW-DOG-TOY-PINK-SMALL');
        $this->libraryPhoto();

        $this->postJson('/api/admin/products/import/preview', ['file' => $this->csv($this->kong())])
            ->assertOk()
            ->assertJsonPath('data.rows.0.status', 'error')
            ->assertJsonPath('data.rows.0.reasons.0', 'The generated SKU KONG-PUPPY-CHEW-DOG-TOY-PINK-SMALL is already used; add a Variant to tell the products apart.');
    }

    public function test_bad_rows_are_flagged_and_nothing_is_created_for_them(): void
    {
        $this->libraryPhoto();
        $rows = [
            ',https://www.chewy.com/a/dp/1,,5,2026-11-17,pug,,,kong-puppy.jpg,,,,,,,,,',
            'No url,not a url,,5,2026-11-17,pug,,,kong-puppy.jpg,,,,,,,,,',
            'Bad price,https://www.chewy.com/b/dp/2,,five,2026-11-17,pug,,,kong-puppy.jpg,,,,,,,,,',
            'Bad breed,https://www.chewy.com/c/dp/3,,5,2026-11-17,poodle,,,kong-puppy.jpg,,,,,,,,,',
            'Bad date,https://www.chewy.com/d/dp/4,,5,17/11/2026,pug,,,kong-puppy.jpg,,,,,,,,,',
        ];

        $response = $this->postJson('/api/admin/products/import', ['file' => $this->csv(...$rows)])->assertCreated();

        $response->assertJsonCount(0, 'data.created')->assertJsonCount(5, 'data.failed');
        $this->assertSame(0, Product::query()->count());
    }

    public function test_an_image_file_missing_from_the_library_without_a_url_flags_the_row(): void
    {
        $this->postJson('/api/admin/products/import/preview', ['file' => $this->csv($this->kong('not-uploaded.jpg'))])
            ->assertOk()
            ->assertJsonPath('data.rows.0.status', 'error');
    }

    public function test_an_image_url_to_a_private_address_is_refused(): void
    {
        Http::fake();

        $this->postJson('/api/admin/products/import/preview', ['file' => $this->csv($this->kong('', 'http://10.0.0.5/a.png'))])
            ->assertOk()
            ->assertJsonPath('data.rows.0.status', 'error');
        Http::assertNothingSent();
    }

    public function test_an_image_url_is_downloaded_when_the_library_has_no_such_file(): void
    {
        $png = UploadedFile::fake()->image('x.png', 30, 30)->getContent();
        Http::fake(['http://93.184.216.34/a.png' => Http::response($png, 200, ['Content-Type' => 'image/png'])]);

        $this->postJson('/api/admin/products/import', ['file' => $this->csv($this->kong('kong-url.png', 'http://93.184.216.34/a.png'))])
            ->assertCreated()
            ->assertJsonCount(1, 'data.created')
            ->assertJsonCount(0, 'data.photo_warnings');

        $this->assertSame(1, Product::query()->firstOrFail()->images()->count());
        $this->assertTrue(CuratorMedia::query()->where('name', 'kong-url.png')->where('folder', 'product')->exists());
    }

    public function test_a_failed_image_download_skips_the_photo_but_keeps_the_pick(): void
    {
        Http::fake(['http://93.184.216.34/a.png' => Http::response('nope', 404)]);

        $this->postJson('/api/admin/products/import', ['file' => $this->csv($this->kong('', 'http://93.184.216.34/a.png'))])
            ->assertCreated()
            ->assertJsonCount(1, 'data.created')
            ->assertJsonCount(1, 'data.photo_warnings');

        $this->assertSame(0, Product::query()->firstOrFail()->images()->count());
    }

    public function test_a_file_without_the_required_columns_is_rejected(): void
    {
        $file = UploadedFile::fake()->createWithContent('bad.csv', "Name,Link\nKONG,https://x\n");

        $this->postJson('/api/admin/products/import/preview', ['file' => $file])->assertUnprocessable()->assertJsonValidationErrors('file');
    }

    public function test_only_core_roles_can_import(): void
    {
        $this->libraryPhoto();
        Sanctum::actingAs(User::factory()->create()->assignRole('Product Manager'));

        $this->postJson('/api/admin/products/import/preview', ['file' => $this->csv($this->kong())])->assertForbidden();
        $this->postJson('/api/admin/products/import', ['file' => $this->csv($this->kong())])->assertForbidden();
        $this->assertSame(0, Product::query()->count());
    }
}
