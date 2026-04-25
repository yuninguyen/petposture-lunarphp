<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Lunar\Models\Product;
use Lunar\Models\ProductVariant;
use Lunar\Models\Price;
use Lunar\Models\Url;
use Lunar\Models\Channel;
use Lunar\Models\CustomerGroup;
use Lunar\Models\Currency;
use Lunar\Models\ProductType;
use Lunar\Models\Collection;
use Lunar\Models\Url as LunarUrl;
use Lunar\FieldTypes\Text;
use Lunar\FieldTypes\TranslatedText;
use Illuminate\Support\Str;

class ProductMigrationSeeder extends Seeder
{
    public function run()
    {
        $legacyProducts = DB::table('products')->get();
        $productType = ProductType::first();
        $channel = Channel::first();
        $customerGroup = CustomerGroup::first();
        $currency = Currency::where('default', true)->first() ?: Currency::first();
        $taxClass = \Lunar\Models\TaxClass::first();

        // Ensure default collections exist
        $collections = [
            'Dogs' => $this->getOrCreateCollection('Dogs', 'dogs'),
            'Cats' => $this->getOrCreateCollection('Cats', 'cats'),
        ];

        $images = [
            'Test Product' => 'https://images.pexels.com/photos/1108099/pexels-photo-1108099.jpeg',
            'Diagnostic Product' => 'https://images.pexels.com/photos/59523/pexels-photo-59523.jpeg',
            'Interactive Smart Cat Toy' => 'https://images.pexels.com/photos/1170986/pexels-photo-1170986.jpeg',
            'Smart GPS Pet Tracker' => 'https://images.pexels.com/photos/164186/pexels-photo-164186.jpeg',
            'Premium Grain-Free Salmon Cat Food' => 'https://images.pexels.com/photos/731022/pexels-photo-731022.jpeg',
            'Ergonomic Orthopedic Dog Bed' => 'https://images.pexels.com/photos/4587971/pexels-photo-4587971.jpeg',
        ];

        foreach ($legacyProducts as $legacy) {
            // Check if product already exists in Lunar (by slug)
            $existingUrl = Url::where('slug', $legacy->slug)->where('element_type', Product::class)->first();

            $imageUrl = $legacy->image_url;
            if (!$imageUrl) {
                // Find matching image or use fallback
                foreach ($images as $key => $url) {
                    if (str_contains($legacy->name, $key)) {
                        $imageUrl = $url;
                        break;
                    }
                }
            }
            if (!$imageUrl)
                $imageUrl = 'https://images.pexels.com/photos/1108099/pexels-photo-1108099.jpeg';

            $productData = [
                'product_type_id' => $productType->id,
                'status' => 'published',
                'brand_id' => $legacy->brand_id,
                'attribute_data' => [
                    'name' => new Text($legacy->name),
                    'description' => new Text($legacy->description),
                    'image_url' => new Text($imageUrl),
                    'badge' => new Text($legacy->badge),
                    'rating' => new Text($legacy->rating ?? 5),
                    'reviews' => new Text($legacy->reviews_count ?? 0),
                ],
            ];

            if ($existingUrl) {
                $product = Product::find($existingUrl->element_id);
                $product->update($productData);
                echo "Updated: {$legacy->name}\n";
            } else {
                // 1. Create Lunar Product
                $product = Product::create($productData);

                // 2. Create Variant
                $variant = ProductVariant::create([
                    'product_id' => $product->id,
                    'sku' => $legacy->slug . '-default',
                    'stock' => $legacy->stock_quantity ?? 0,
                    'tax_class_id' => $taxClass->id,
                ]);

                // 3. Create Price
                Price::create([
                    'priceable_type' => ProductVariant::class,
                    'priceable_id' => $variant->id,
                    'currency_id' => $currency->id,
                    'price' => (int) ($legacy->price * 100),
                ]);

                // 4. Create URL
                Url::create([
                    'slug' => $legacy->slug,
                    'element_type' => Product::class,
                    'element_id' => $product->id,
                    'language_id' => 1,
                    'default' => true,
                ]);

                echo "Migrated: {$legacy->name}\n";
            }
            // --- Associate with Collection ---
            $cat = str_contains(strtolower($legacy->name), 'cat') ? $collections['Cats'] : $collections['Dogs'];
            $product->collections()->syncWithoutDetaching([$cat->id]);
        }
    }

    protected function getOrCreateCollection($name, $slug)
    {
        $collection = Collection::whereHas('urls', fn($q) => $q->where('slug', $slug))->first();

        if (!$collection) {
            $collection = Collection::create([
                'collection_group_id' => 1,
                'attribute_data' => [
                    'name' => new Text($name),
                ],
            ]);

            LunarUrl::create([
                'slug' => $slug,
                'element_type' => Collection::class,
                'element_id' => $collection->id,
                'language_id' => 1,
                'default' => true,
            ]);
        }

        return $collection;
    }
}
