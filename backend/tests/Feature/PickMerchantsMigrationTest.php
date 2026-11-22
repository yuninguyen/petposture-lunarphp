<?php

namespace Tests\Feature;

use App\Models\AffiliateNetwork;
use App\Models\PickMerchant;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Lunar\FieldTypes\Text;
use Lunar\Models\Product;
use Lunar\Models\ProductType;
use Tests\TestCase;

class PickMerchantsMigrationTest extends TestCase
{
    use RefreshDatabase;

    private const URL = 'https://www.petsmart.com/dog/toys/benebone.html';

    private function migration(): object
    {
        return require base_path('database/migrations/2026_11_23_000001_create_pick_merchants_table.php');
    }

    /** The table as it was before the migration: gone, so up() has to create it and copy. */
    private function beforeTheMigration(): void
    {
        Schema::dropIfExists('pick_merchants');
    }

    private function pick(array $attributes): Product
    {
        $type = ProductType::query()->firstOrCreate(['name' => 'Pets']);

        return Product::query()->create([
            'product_type_id' => $type->id,
            'status' => 'published',
            'attribute_data' => collect(array_map(fn ($value) => new Text($value), $attributes + ['name' => 'Pick'])),
        ]);
    }

    private function network(string $slug, string $name): AffiliateNetwork
    {
        return AffiliateNetwork::query()->firstOrCreate(['slug' => $slug], ['name' => $name, 'active' => true]);
    }

    public function test_it_creates_the_table_and_copies_the_second_retailer_as_the_first_of_the_other_stores(): void
    {
        $petsmart = $this->network('petsmart', 'PetSmart');
        $product = $this->pick([
            'second_retailer_slug' => 'petsmart', 'second_retailer_url' => self::URL,
            'second_retailer_price' => '$40.99', 'second_retailer_price_checked_date' => '2026-11-21',
        ]);
        $this->beforeTheMigration();

        $this->migration()->up();

        $row = PickMerchant::query()->where('product_id', $product->id)->sole();
        $this->assertSame($petsmart->id, $row->affiliate_network_id);
        $this->assertSame(1, $row->position);
        $this->assertSame(self::URL, $row->url);
        $this->assertSame('40.99', $row->price);
        $this->assertSame('2026-11-21', $row->price_checked_date->format('Y-m-d'));
    }

    public function test_a_price_that_is_not_a_number_or_a_date_that_does_not_exist_is_copied_as_nothing(): void
    {
        $this->network('petsmart', 'PetSmart');
        $bad = $this->pick(['second_retailer_slug' => 'petsmart', 'second_retailer_url' => self::URL, 'second_retailer_price' => 'cheap', 'second_retailer_price_checked_date' => '2026-13-45']);
        $this->beforeTheMigration();

        $this->migration()->up();

        $row = PickMerchant::query()->where('product_id', $bad->id)->sole();
        $this->assertNull($row->price);
        $this->assertNull($row->price_checked_date);
        $this->assertSame(self::URL, $row->url);
    }

    public function test_a_second_retailer_the_page_never_showed_is_not_copied(): void
    {
        $this->network('petsmart', 'PetSmart');
        $this->pick([]);
        $this->pick(['second_retailer_slug' => 'petsmart']);
        $this->pick(['second_retailer_url' => self::URL]);
        $this->pick(['second_retailer_slug' => 'no-such-store', 'second_retailer_url' => self::URL]);
        $this->pick(['second_retailer_slug' => 'petsmart', 'second_retailer_url' => 'javascript:alert(1)']);
        $this->pick(['second_retailer_slug' => 'petsmart', 'second_retailer_url' => 'petsmart.com/dog']);
        $this->beforeTheMigration();

        $this->migration()->up();

        $this->assertSame(0, PickMerchant::query()->count());
    }

    public function test_running_it_twice_does_not_copy_a_store_twice_and_leaves_the_old_attributes_where_they_are(): void
    {
        $this->network('petsmart', 'PetSmart');
        $product = $this->pick(['second_retailer_slug' => 'petsmart', 'second_retailer_url' => self::URL]);
        $this->beforeTheMigration();

        $this->migration()->up();
        $this->migration()->up();

        $this->assertSame(1, PickMerchant::query()->where('product_id', $product->id)->count());
        $this->assertSame('petsmart', $product->fresh()->translateAttribute('second_retailer_slug'));
        $this->assertSame(self::URL, $product->fresh()->translateAttribute('second_retailer_url'));
    }

    public function test_down_drops_the_table(): void
    {
        $this->assertTrue(Schema::hasTable('pick_merchants'));

        $this->migration()->down();

        $this->assertFalse(Schema::hasTable('pick_merchants'));
    }
}
