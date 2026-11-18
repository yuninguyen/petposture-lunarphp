<?php

namespace Tests\Feature\Api\Admin;

use App\Models\User;
use App\Support\PickKind;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Lunar\FieldTypes\Text;
use Lunar\Models\Brand;
use Lunar\Models\Product;
use Lunar\Models\ProductType;
use Tests\TestCase;

/**
 * The admin Products list tells a Pick (a product with a retailer link, shown at /picks) from a Shop product
 * (everything else) using data that is already there, and can filter on it.
 */
class ProductKindTest extends TestCase
{
    use RefreshDatabase;

    private ProductType $general;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
        Sanctum::actingAs(User::factory()->create()->assignRole('admin'));
        $this->general = ProductType::query()->create(['name' => 'General']);
    }

    private function product(string $name, ?string $externalUrl, array $overrides = []): Product
    {
        $attributes = ['name' => new Text($name)];
        if ($externalUrl !== null) {
            $attributes['external_url'] = new Text($externalUrl);
        }

        return Product::query()->create(array_merge([
            'product_type_id' => $this->general->id,
            'status' => 'published',
            'attribute_data' => $attributes,
        ], $overrides));
    }

    private function names(string $query = ''): array
    {
        return collect($this->getJson("/api/admin/products?per_page=100{$query}")->assertOk()->json('data'))->pluck('name')->sort()->values()->all();
    }

    public function test_every_row_says_whether_it_is_a_pick_or_a_shop_product(): void
    {
        $this->product('A Pick', 'https://www.chewy.com/a-pick/dp/1');
        $this->product('Shop Draft', null, ['status' => 'draft']);

        $kinds = collect($this->getJson('/api/admin/products?per_page=100')->assertOk()->json('data'))->pluck('kind', 'name')->all();

        ksort($kinds);

        $this->assertSame(['A Pick' => 'pick', 'Shop Draft' => 'shop'], $kinds);
    }

    public function test_only_a_web_address_makes_a_pick_an_empty_or_odd_link_does_not(): void
    {
        $this->product('Https Pick', 'https://www.chewy.com/x/dp/1');
        $this->product('Http Pick', 'http://www.chewy.com/y/dp/2');
        $this->product('Empty Link', '');
        $this->product('Ftp Link', 'ftp://files.example.com/z');
        $this->product('No Link', null);

        $this->assertSame(['Http Pick', 'Https Pick'], $this->names('&kind=pick'));
        $this->assertSame(['Empty Link', 'Ftp Link', 'No Link'], $this->names('&kind=shop'));
        $this->assertSame(PickKind::PICK, PickKind::of(Product::query()->get()->firstWhere(fn ($p) => $p->translateAttribute('name') === 'Https Pick')));
        $this->assertSame(PickKind::SHOP, PickKind::of(Product::query()->get()->firstWhere(fn ($p) => $p->translateAttribute('name') === 'Ftp Link')));
    }

    public function test_the_filter_and_the_label_agree_for_every_product(): void
    {
        foreach (['P1' => 'https://a.example/1', 'P2' => 'http://a.example/2', 'S1' => null, 'S2' => '', 'S3' => 'not a link'] as $name => $url) {
            $this->product($name, $url);
        }

        $picks = collect($this->getJson('/api/admin/products?per_page=100&kind=pick')->json('data'));
        $shop = collect($this->getJson('/api/admin/products?per_page=100&kind=shop')->json('data'));

        $this->assertTrue($picks->every(fn ($row) => $row['kind'] === 'pick'));
        $this->assertTrue($shop->every(fn ($row) => $row['kind'] === 'shop'));
        $this->assertSame(5, $picks->count() + $shop->count());
    }

    public function test_all_kinds_shows_everything_as_before(): void
    {
        $this->product('A Pick', 'https://www.chewy.com/a/dp/1');
        $this->product('Shop Product', null);

        $this->assertSame(['A Pick', 'Shop Product'], $this->names());
    }

    public function test_the_filter_works_with_the_page_size_and_the_totals(): void
    {
        foreach (range(1, 5) as $number) {
            $this->product("Pick {$number}", "https://www.chewy.com/p{$number}/dp/{$number}");
        }
        $this->product('Shop Product', null);

        $page = $this->getJson('/api/admin/products?kind=pick&per_page=2&page=3')->assertOk();

        $this->assertSame(5, $page->json('meta.total'));
        $this->assertSame(3, $page->json('meta.last_page'));
        $this->assertCount(1, $page->json('data'));
        $this->assertSame('pick', $page->json('data.0.kind'));
    }

    public function test_the_filter_combines_with_search_status_brand_and_type(): void
    {
        $brand = Brand::query()->create(['name' => 'KONG']);
        $harnesses = ProductType::query()->create(['name' => 'Harnesses']);
        $this->product('KONG Puppy Toy', 'https://www.chewy.com/kong/dp/1', ['brand_id' => $brand->id]);
        $this->product('KONG Draft Toy', 'https://www.chewy.com/kong2/dp/2', ['brand_id' => $brand->id, 'status' => 'draft']);
        $this->product('Other Pick', 'https://www.chewy.com/other/dp/3');
        $this->product('KONG Shop Item', null, ['brand_id' => $brand->id]);
        $this->product('Harness Pick', 'https://www.chewy.com/h/dp/4', ['product_type_id' => $harnesses->id]);

        $this->assertSame(['KONG Draft Toy', 'KONG Puppy Toy'], $this->names('&kind=pick&search=kong'));
        $this->assertSame(['KONG Puppy Toy'], $this->names('&kind=pick&search=kong&status=published'));
        $this->assertSame(['KONG Draft Toy', 'KONG Puppy Toy'], $this->names("&kind=pick&brand_id={$brand->id}"));
        $this->assertSame(['KONG Shop Item'], $this->names("&kind=shop&brand_id={$brand->id}"));
        $this->assertSame(['Harness Pick'], $this->names("&kind=pick&product_type_id={$harnesses->id}"));
        $this->assertSame([], $this->names("&kind=shop&product_type_id={$harnesses->id}"));
    }

    public function test_an_unknown_kind_is_refused(): void
    {
        $this->getJson('/api/admin/products?kind=everything')->assertUnprocessable()->assertJsonValidationErrors('kind');
    }

    public function test_listing_by_kind_changes_nothing_about_the_products(): void
    {
        $this->product('A Pick', 'https://www.chewy.com/a/dp/1');
        $this->product('Shop Product', null, ['status' => 'draft']);
        $rows = fn () => DB::table('lunar_products')->orderBy('id')->get()->map(fn ($row) => (array) $row)->all();
        $before = $rows();

        $this->getJson('/api/admin/products?kind=pick')->assertOk();
        $this->getJson('/api/admin/products?kind=shop')->assertOk();

        $this->assertSame($before, $rows());
    }
}
