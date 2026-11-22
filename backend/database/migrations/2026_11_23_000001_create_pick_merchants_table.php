<?php

use App\Models\AffiliateNetwork;
use App\Support\RetailerUrl;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Lunar\Models\Product;

// The stores a Pick can be bought from besides its first one (for example PetSmart or Amazon next to Chewy), as a list
// of any length. The first store stays in the product's own attributes (retailer, link, price, checked date) because
// creating a Pick, the bulk import, a variant's own link and the structured data all rely on it; this table holds the
// ones after it. Existing "second retailer" attributes are copied in as the first extra store. The attributes are left
// where they are, unused, so a rollback loses nothing.
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('pick_merchants')) {
            Schema::create('pick_merchants', function (Blueprint $table): void {
                $table->id();
                $table->unsignedBigInteger('product_id')->index();
                $table->unsignedSmallInteger('position')->default(1);
                $table->foreignId('affiliate_network_id')->constrained('affiliate_networks')->cascadeOnDelete();
                $table->string('url', 2048);
                $table->decimal('price', 10, 2)->nullable();
                $table->date('price_checked_date')->nullable();
                $table->timestamps();
            });
        }

        $this->copySecondRetailers();
    }

    public function down(): void
    {
        Schema::dropIfExists('pick_merchants');
    }

    private function copySecondRetailers(): void
    {
        Product::query()->orderBy('id')->each(function (Product $product): void {
            $url = RetailerUrl::web($product->translateAttribute('second_retailer_url'));
            $slug = trim((string) $product->translateAttribute('second_retailer_slug'));

            // Same rule the page used: a web address AND an affiliate network that exists, or there was no second store.
            if ($url === null || $slug === '') {
                return;
            }

            $network = AffiliateNetwork::where('slug', $slug)->first();

            if (! $network) {
                return;
            }

            DB::table('pick_merchants')->updateOrInsert(
                ['product_id' => $product->id, 'affiliate_network_id' => $network->id],
                [
                    'position' => 1,
                    'url' => $url,
                    'price' => $this->price($product->translateAttribute('second_retailer_price')),
                    'price_checked_date' => $this->date($product->translateAttribute('second_retailer_price_checked_date')),
                    'created_at' => now(),
                    'updated_at' => now(),
                ],
            );
        });
    }

    private function price(mixed $value): ?float
    {
        $raw = str_replace(['$', ','], '', trim((string) $value));

        return is_numeric($raw) && (float) $raw >= 0 ? round((float) $raw, 2) : null;
    }

    private function date(mixed $value): ?string
    {
        $raw = trim((string) $value);
        $date = DateTimeImmutable::createFromFormat('!Y-m-d', $raw);

        return $date && $date->format('Y-m-d') === $raw ? $raw : null;
    }
};
