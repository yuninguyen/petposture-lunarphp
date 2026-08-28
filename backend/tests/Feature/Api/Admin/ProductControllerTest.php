<?php

namespace Tests\Feature\Api\Admin;

use App\Models\CuratorMedia;
use App\Models\SeoMetadata;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;
use Laravel\Sanctum\Sanctum;
use Lunar\FieldTypes\Text;
use Lunar\FieldTypes\TranslatedText;
use Lunar\Models\Attribute;
use Lunar\Models\AttributeGroup;
use Lunar\Models\Brand;
use Lunar\Models\Collection;
use Lunar\Models\CollectionGroup;
use Lunar\Models\Currency;
use Lunar\Models\CustomerGroup;
use Lunar\Models\Language;
use Lunar\Models\OrderLine;
use Lunar\Models\Product;
use Lunar\Models\ProductAssociation;
use Lunar\Models\ProductOption;
use Lunar\Models\ProductOptionValue;
use Lunar\Models\ProductType;
use Lunar\Models\ProductVariant;
use Lunar\Models\TaxClass;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class ProductControllerTest extends TestCase
{
    use RefreshDatabase;

    private Currency $currency;

    private TaxClass $taxClass;

    private ProductType $productType;

    private Attribute $nameAttribute;

    private Attribute $descriptionAttribute;

    private Attribute $careAttribute;

    private Attribute $variantNoteAttribute;

    protected function setUp(): void
    {
        parent::setUp();

        Role::firstOrCreate(['name' => 'admin', 'guard_name' => 'web']);
        Role::firstOrCreate(['name' => 'customer', 'guard_name' => 'web']);
        Storage::fake('public');

        $this->currency = Currency::query()->create([
            'code' => 'BHD',
            'name' => 'Bahraini Dinar',
            'exchange_rate' => 1,
            'decimal_places' => 3,
            'enabled' => true,
            'default' => true,
            'sync_prices' => false,
        ]);
        $this->taxClass = TaxClass::query()->create([
            'name' => 'Default Tax',
            'default' => true,
        ]);
        $this->productType = ProductType::query()->create(['name' => 'Pet Products']);

        $productGroup = AttributeGroup::query()->create([
            'attributable_type' => Product::morphName(),
            'name' => ['en' => 'Product details'],
            'handle' => 'product_details',
            'position' => 1,
        ]);
        $variantGroup = AttributeGroup::query()->create([
            'attributable_type' => ProductVariant::morphName(),
            'name' => ['en' => 'Variant details'],
            'handle' => 'variant_details',
            'position' => 1,
        ]);

        $this->nameAttribute = $this->attribute($productGroup, Product::morphName(), 'name', Text::class, true, true, 1);
        $this->descriptionAttribute = $this->attribute($productGroup, Product::morphName(), 'description', Text::class, false, false, 2);
        $this->careAttribute = $this->attribute($productGroup, Product::morphName(), 'care', TranslatedText::class, false, false, 3);
        $this->variantNoteAttribute = $this->attribute($variantGroup, ProductVariant::morphName(), 'variant_note', TranslatedText::class, false, false, 1);

        $this->productType->mappedAttributes()->attach([
            $this->nameAttribute->id,
            $this->descriptionAttribute->id,
            $this->careAttribute->id,
            $this->variantNoteAttribute->id,
        ]);
    }

    public function test_product_routes_require_admin_authentication_and_role(): void
    {
        $product = $this->product('Protected product');
        $variant = $this->variant($product, 'PROTECTED-1', 1000);
        $target = $this->product('Protected target');
        $association = ProductAssociation::query()->create([
            'product_parent_id' => $product->id,
            'product_target_id' => $target->id,
            'type' => 'cross-sell',
        ]);

        $requests = [
            ['getJson', '/api/admin/products', []],
            ['postJson', '/api/admin/products', []],
            ['postJson', '/api/admin/products/bulk-delete', []],
            ['postJson', '/api/admin/products/bulk-status', []],
            ['getJson', "/api/admin/products/{$product->id}", []],
            ['getJson', "/api/admin/products/{$product->id}/preview-url", []],
            ['putJson', "/api/admin/products/{$product->id}", []],
            ['deleteJson', "/api/admin/products/{$product->id}", []],
            ['getJson', "/api/admin/products/{$product->id}/associations", []],
            ['postJson', "/api/admin/products/{$product->id}/associations", []],
            ['deleteJson', "/api/admin/products/{$product->id}/associations/{$association->id}", []],
            ['postJson', "/api/admin/products/{$product->id}/options", []],
            ['postJson', "/api/admin/products/{$product->id}/variants/generate", []],
            ['putJson', "/api/admin/products/{$product->id}/variants/{$variant->id}", []],
            ['deleteJson', "/api/admin/products/{$product->id}/variants/{$variant->id}", []],
        ];

        foreach ($requests as [$method, $uri, $payload]) {
            $this->{$method}($uri, $payload)->assertUnauthorized();
        }

        $customer = User::factory()->create();
        $customer->assignRole('customer');
        Sanctum::actingAs($customer);

        foreach ($requests as [$method, $uri, $payload]) {
            $this->{$method}($uri, $payload)->assertForbidden();
        }
    }

    public function test_admin_can_create_product_with_currency_factor_and_text_name(): void
    {
        $this->actingAsAdmin();

        $response = $this->postJson('/api/admin/products', [
            'name' => 'Posture Bowl',
            'product_type_id' => $this->productType->id,
            'sku' => 'BOWL-001',
            'base_price' => '12.345',
        ])->assertCreated()
            ->assertJsonPath('data.status', 'draft')
            ->assertJsonPath('data.product_type_id', $this->productType->id)
            ->assertJsonPath('data.variants.0.sku', 'BOWL-001')
            ->assertJsonPath('data.variants.0.base_price', '12.345');

        $product = Product::query()->findOrFail($response->json('data.id'));
        $variant = $product->variants()->sole();
        $price = $variant->prices()->sole();

        $this->assertInstanceOf(Text::class, $product->attribute_data->get('name'));
        $this->assertSame('Posture Bowl', $product->attribute_data->get('name')->getValue());
        $this->assertSame($this->taxClass->id, $variant->tax_class_id);
        $this->assertSame($this->currency->id, $price->currency_id);
        $this->assertNull($price->customer_group_id);
        $this->assertSame(1, $price->min_quantity);
        $this->assertSame(12345, (int) $price->getRawOriginal('price'));
    }

    public function test_create_uses_translated_text_name_definition_when_configured(): void
    {
        $this->nameAttribute->update(['type' => TranslatedText::class]);
        $this->actingAsAdmin();

        $response = $this->postJson('/api/admin/products', [
            'name' => 'Translated Bowl',
            'product_type_id' => $this->productType->id,
            'sku' => 'TRANS-001',
            'base_price' => '1.250',
        ])->assertCreated();

        $name = Product::query()->findOrFail($response->json('data.id'))->attribute_data->get('name');

        $this->assertInstanceOf(TranslatedText::class, $name);
        $this->assertSame('Translated Bowl', $name->getValue()->get('en')->getValue());
        $this->assertSame('Translated Bowl', $name->getValue()->get('vi')->getValue());
    }

    public function test_index_supports_search_filters_and_pagination_with_stock_and_lowest_price(): void
    {
        $this->actingAsAdmin();
        $brandA = Brand::query()->create(['name' => 'Alpha']);
        $brandB = Brand::query()->create(['name' => 'Beta']);

        $matching = $this->product('Orthopedic Bowl', 'published', $brandA->id);
        $this->variant($matching, 'ORTHO-L', 15500, 4);
        $this->variant($matching, 'ORTHO-S', 12500, 6);
        $other = $this->product('Travel Mat', 'draft', $brandB->id);
        $this->variant($other, 'MAT-001', 9900, 3);

        $this->getJson('/api/admin/products?search=ORTHO-S&status=published&brand_id='.$brandA->id.'&product_type_id='.$this->productType->id.'&per_page=1')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $matching->id)
            ->assertJsonPath('data.0.total_stock', 10)
            ->assertJsonPath('data.0.price.amount', 12500)
            ->assertJsonPath('meta.per_page', 1)
            ->assertJsonPath('meta.total', 1);

        $this->getJson('/api/admin/products?search=travel')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $other->id);
    }

    public function test_product_update_preserves_unsubmitted_attributes_and_syncs_ordered_collections_and_media(): void
    {
        $this->actingAsAdmin();
        $brand = Brand::query()->create(['name' => 'Posture Co']);
        $product = $this->product('Old Name', 'draft', null, [
            'description' => new Text('Keep this description'),
            'care' => new TranslatedText(['en' => 'Old EN', 'vi' => 'Old VI']),
            'legacy' => new Text('Keep legacy'),
        ]);
        $this->variant($product, 'MEDIA-001', 5000);
        [$first, $second] = $this->collections();
        [$curatorA, $curatorB] = $this->curatorMedia();

        $updateResponse = $this->putJson("/api/admin/products/{$product->id}", [
            'status' => 'published',
            'brand_id' => $brand->id,
            'attributes' => [
                'name' => 'New Name',
                'care' => ['en' => 'Hand wash', 'vi' => 'Rửa tay'],
            ],
            'collections' => [$second->id, $first->id],
            'media' => [
                ['source' => 'curator', 'id' => $curatorB->id],
                ['source' => 'curator', 'id' => $curatorA->id],
            ],
        ])->assertOk()
            ->assertJsonPath('data.status', 'published')
            ->assertJsonPath('data.brand_id', $brand->id)
            ->assertJsonPath('data.collection_ids', [$second->id, $first->id])
            ->assertJsonPath('data.media.0.id', (string) $curatorB->id)
            ->assertJsonPath('data.media.1.id', (string) $curatorA->id);

        $product->refresh();
        $this->assertSame('New Name', $product->attribute_data->get('name')->getValue());
        $this->assertSame('Keep this description', $product->attribute_data->get('description')->getValue());
        $this->assertSame('Keep legacy', $product->attribute_data->get('legacy')->getValue());
        $this->assertSame('Hand wash', $product->attribute_data->get('care')->getValue()->get('en')->getValue());
        $this->assertSame('Rửa tay', $product->attribute_data->get('care')->getValue()->get('vi')->getValue());
        $this->assertSame(
            [$second->id => 1, $first->id => 2],
            $product->collections()->get()->mapWithKeys(fn (Collection $collection) => [
                $collection->id => (int) $collection->pivot->position,
            ])->all()
        );

        $media = $product->images()->orderBy('order_column')->get();
        $this->assertCount(2, $media);
        $this->assertSame($curatorB->id, (int) $media[0]->getCustomProperty('curator_media_id'));
        $this->assertTrue((bool) $media[0]->getCustomProperty('primary'));
        $this->assertSame($curatorA->id, (int) $media[1]->getCustomProperty('curator_media_id'));
        $this->assertFalse((bool) $media[1]->getCustomProperty('primary'));

        $roundTripMedia = $updateResponse->json('data.media');
        $this->putJson("/api/admin/products/{$product->id}", [
            'status' => 'published',
            'brand_id' => $brand->id,
            'attributes' => ['name' => 'New Name'],
            'media' => $roundTripMedia,
        ])->assertOk()
            ->assertJsonPath('data.media', $roundTripMedia);
        $this->assertSame(2, $product->fresh()->images()->count());

        $this->putJson("/api/admin/products/{$product->id}", [
            'status' => 'published',
            'brand_id' => $brand->id,
            'attributes' => ['name' => 'New Name'],
            'media' => [
                ['source' => 'spatie', 'id' => $media[1]->id],
            ],
        ])->assertOk();

        $remaining = $product->fresh()->images()->get();
        $this->assertCount(1, $remaining);
        $this->assertSame($media[1]->id, $remaining->first()->id);
        $this->assertTrue((bool) $remaining->first()->getCustomProperty('primary'));
    }

    public function test_product_description_is_sanitized_before_persistence(): void
    {
        $this->actingAsAdmin();
        $product = $this->product('Sanitized product', 'draft', null, [
            'description' => new Text('Old description'),
        ]);

        $this->putJson("/api/admin/products/{$product->id}", [
            'status' => 'draft',
            'attributes' => [
                'name' => 'Sanitized product',
                'description' => '<p>Safe <strong>content</strong><img src="/pet.jpg" onerror="alert(1)"><a href="javascript:alert(2)">click</a></p><script>alert(3)</script><iframe src="https://evil.example/embed"></iframe>',
            ],
        ])->assertOk();

        $description = (string) $product->fresh()->attribute_data->get('description')->getValue();
        $this->assertStringContainsString('<strong>content</strong>', $description);
        $this->assertStringNotContainsString('<script', $description);
        $this->assertStringNotContainsString('onerror', $description);
        $this->assertStringNotContainsString('javascript:', $description);
        $this->assertStringNotContainsString('<iframe', $description);
    }

    public function test_product_seo_metadata_round_trips_through_the_existing_polymorphic_table(): void
    {
        $this->actingAsAdmin();
        $product = $this->product('SEO product');
        $this->variant($product, 'SEO-001', 1000);
        SeoMetadata::query()->create([
            'seoable_type' => 'App\\Models\\Post',
            'seoable_id' => $product->id,
            'title' => 'Unrelated SEO row',
            'is_indexable' => true,
            'is_followable' => true,
        ]);

        $this->getJson("/api/admin/products/{$product->id}")
            ->assertOk()
            ->assertJsonPath('data.seo.title', '')
            ->assertJsonPath('data.seo.is_indexable', true)
            ->assertJsonPath('data.seo.is_followable', true);

        $seo = [
            'title' => 'Ergonomic dog bowl',
            'description' => 'Support comfortable feeding posture with an ergonomic dog bowl.',
            'keyphrase' => 'ergonomic dog bowl',
            'og_title' => 'A better bowl for comfortable meals',
            'og_description' => 'Explore a posture-friendly feeding setup for dogs.',
            'og_image' => 'https://cdn.example.com/products/bowl.jpg',
            'canonical_url' => 'https://petposture.com/shop/dogs/ergonomic-bowl',
            'is_indexable' => false,
            'is_followable' => false,
        ];

        $this->putJson("/api/admin/products/{$product->id}", [
            'status' => 'published',
            'brand_id' => null,
            'attributes' => ['name' => 'SEO product'],
            'seo' => $seo,
        ])->assertOk()
            ->assertJsonPath('data.seo', $seo);

        $this->assertDatabaseHas('seo_metadata', [
            'seoable_type' => Product::class,
            'seoable_id' => $product->id,
            'title' => $seo['title'],
            'is_indexable' => false,
            'is_followable' => false,
        ]);
        $this->assertDatabaseHas('seo_metadata', [
            'seoable_type' => 'App\\Models\\Post',
            'seoable_id' => $product->id,
            'title' => 'Unrelated SEO row',
        ]);

        $this->putJson("/api/admin/products/{$product->id}", [
            'status' => 'draft',
            'brand_id' => null,
            'attributes' => ['name' => 'SEO product'],
        ])->assertOk()->assertJsonPath('data.seo.title', $seo['title']);

        $this->putJson("/api/admin/products/{$product->id}", [
            'status' => 'published',
            'brand_id' => null,
            'attributes' => ['name' => 'SEO product'],
            'seo' => array_merge($seo, ['canonical_url' => 'not-a-url']),
        ])->assertUnprocessable()->assertJsonValidationErrors('seo.canonical_url');
    }

    public function test_product_slug_changes_preserve_redirect_history_and_public_api_signals_the_canonical_route(): void
    {
        $this->actingAsAdmin();
        $language = Language::getDefault();
        $product = $this->product('Slug product');
        $this->variant($product, 'SLUG-001', 1000, 5);
        $product->urls()->delete();
        $url = $product->urls()->create([
            'language_id' => $language->id,
            'slug' => 'old-product-slug',
            'default' => true,
        ]);
        $other = $this->product('Other product');
        $other->urls()->delete();
        $other->urls()->create([
            'language_id' => $language->id,
            'slug' => 'already-used',
            'default' => true,
        ]);

        $this->getJson("/api/admin/products/{$product->id}")
            ->assertOk()
            ->assertJsonPath('data.slug', 'old-product-slug');

        $payload = [
            'status' => 'published',
            'brand_id' => null,
            'attributes' => ['name' => 'Slug product'],
        ];
        $this->putJson("/api/admin/products/{$product->id}", $payload + ['slug' => 'Uppercase-Slug'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('slug');
        $this->putJson("/api/admin/products/{$product->id}", $payload + ['slug' => 'already-used'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('slug');

        $this->putJson("/api/admin/products/{$product->id}", $payload + ['slug' => 'new-product-slug'])
            ->assertOk()
            ->assertJsonPath('data.slug', 'new-product-slug');

        $url->refresh();
        $this->assertSame('new-product-slug', $url->slug);
        $this->assertSame($language->id, $url->language_id);
        $this->assertTrue($url->default);
        $this->assertSame(1, $product->urls()->count());
        $this->assertDatabaseHas('product_redirects', [
            'product_id' => $product->id,
            'old_slug' => 'old-product-slug',
        ]);

        $this->putJson("/api/admin/products/{$product->id}", $payload + ['slug' => 'new-product-slug'])
            ->assertOk();
        $this->assertDatabaseCount('product_redirects', 1);

        $this->putJson("/api/admin/products/{$product->id}", $payload + ['slug' => 'final-product-slug'])
            ->assertOk()
            ->assertJsonPath('data.slug', 'final-product-slug');
        $this->assertDatabaseHas('product_redirects', [
            'product_id' => $product->id,
            'old_slug' => 'new-product-slug',
        ]);
        $this->assertDatabaseCount('product_redirects', 2);

        foreach (['old-product-slug', 'new-product-slug'] as $oldSlug) {
            $this->getJson("/api/products/{$oldSlug}")
                ->assertOk()
                ->assertJsonMissingPath('data')
                ->assertJsonPath('redirect.path', '/shop/categories/final-product-slug')
                ->assertJsonPath('redirect.slug', 'final-product-slug')
                ->assertJsonPath('redirect.categorySlug', 'categories');
        }
        $this->getJson('/api/products/final-product-slug')
            ->assertOk()
            ->assertJsonPath('data.slug', 'final-product-slug');

        $this->putJson("/api/admin/products/{$product->id}", array_merge($payload, [
            'slug' => 'final-product-slug',
            'status' => 'draft',
        ]))->assertOk();
        $this->getJson('/api/products/old-product-slug')->assertNotFound();
    }

    public function test_product_update_creates_a_default_url_when_one_is_missing(): void
    {
        $this->actingAsAdmin();
        $language = Language::getDefault();
        $product = $this->product('Missing URL');
        $product->urls()->delete();

        $this->putJson("/api/admin/products/{$product->id}", [
            'slug' => 'created-product-url',
            'status' => 'draft',
            'brand_id' => null,
            'attributes' => ['name' => 'Missing URL'],
        ])->assertOk()
            ->assertJsonPath('data.slug', 'created-product-url');

        $url = $product->urls()->sole();
        $this->assertSame($language->id, $url->language_id);
        $this->assertSame('created-product-url', $url->slug);
        $this->assertTrue($url->default);
    }

    public function test_admin_can_generate_a_signed_preview_for_a_draft_product(): void
    {
        $this->actingAsAdmin();
        config()->set('app.frontend_url', 'https://storefront.example.test');
        $product = $this->product('Draft preview product', 'draft');
        $this->variant($product, 'PREVIEW-001', 1000, 3);
        $product->urls()->create([
            'language_id' => Language::getDefault()->id,
            'slug' => 'draft-preview-product',
            'default' => true,
        ]);

        $this->getJson('/api/products/draft-preview-product')->assertNotFound();

        $response = $this->getJson("/api/admin/products/{$product->id}/preview-url")
            ->assertOk();
        $url = $response->json('url');
        $parts = parse_url($url);
        parse_str($parts['query'] ?? '', $query);

        $this->assertSame('https', $parts['scheme'] ?? null);
        $this->assertSame('storefront.example.test', $parts['host'] ?? null);
        $this->assertSame('/shop/categories/draft-preview-product', $parts['path'] ?? null);
        $this->assertGreaterThan(now()->addHours(23)->timestamp, (int) ($query['expires'] ?? 0));
        $this->assertNotEmpty($query['signature'] ?? null);
        $this->assertArrayNotHasKey('preview_token', $query);

        $previewQuery = http_build_query($query);
        $this->getJson('/api/products/draft-preview-product?'.$previewQuery)
            ->assertOk()
            ->assertJsonPath('data.slug', 'draft-preview-product')
            ->assertJsonPath('data.name', 'Draft preview product');

        $this->getJson('/api/products/draft-preview-product?'.http_build_query([
            'expires' => $query['expires'],
            'signature' => str_repeat('0', 64),
        ]))->assertNotFound();

        $expiredUrl = URL::temporarySignedRoute('products.show', now()->subMinute(), [
            'slug' => 'draft-preview-product',
        ]);
        $this->getJson($expiredUrl)->assertNotFound();
    }

    public function test_product_associations_are_written_and_removed_synchronously_for_all_supported_types(): void
    {
        $this->actingAsAdmin();
        config()->set('queue.default', 'database');
        $product = $this->product('Association parent');
        $target = $this->product('Association target');
        $other = $this->product('Association other');

        $associationIds = [];
        foreach (['cross-sell', 'up-sell', 'alternate'] as $type) {
            $response = $this->postJson("/api/admin/products/{$product->id}/associations", [
                'target_product_id' => $target->id,
                'type' => $type,
            ])->assertCreated()
                ->assertJsonPath('data.type', $type)
                ->assertJsonPath('data.target.id', $target->id)
                ->assertJsonPath('data.target.name', 'Association target');
            $associationIds[$type] = $response->json('data.id');

            $this->assertDatabaseHas('lunar_product_associations', [
                'id' => $associationIds[$type],
                'product_parent_id' => $product->id,
                'product_target_id' => $target->id,
                'type' => $type,
            ]);
        }

        $this->getJson("/api/admin/products/{$product->id}/associations")
            ->assertOk()
            ->assertJsonCount(3, 'data');

        $this->postJson("/api/admin/products/{$product->id}/associations", [
            'target_product_id' => $target->id,
            'type' => 'cross-sell',
        ])->assertUnprocessable()->assertJsonValidationErrors('target_product_id');
        $this->postJson("/api/admin/products/{$product->id}/associations", [
            'target_product_id' => $product->id,
            'type' => 'alternate',
        ])->assertUnprocessable()->assertJsonValidationErrors('target_product_id');
        $this->postJson("/api/admin/products/{$product->id}/associations", [
            'target_product_id' => $other->id,
            'type' => 'invalid',
        ])->assertUnprocessable()->assertJsonValidationErrors('type');

        $this->deleteJson("/api/admin/products/{$other->id}/associations/{$associationIds['cross-sell']}")
            ->assertNotFound();
        $this->assertDatabaseHas('lunar_product_associations', ['id' => $associationIds['cross-sell']]);

        $this->deleteJson("/api/admin/products/{$product->id}/associations/{$associationIds['cross-sell']}")
            ->assertNoContent();
        $this->assertDatabaseMissing('lunar_product_associations', ['id' => $associationIds['cross-sell']]);
        $this->assertDatabaseHas('lunar_product_associations', ['id' => $associationIds['up-sell']]);
        $this->assertDatabaseHas('lunar_product_associations', ['id' => $associationIds['alternate']]);

        $target->delete();
        $this->getJson("/api/admin/products/{$product->id}/associations")
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.target.id', $target->id);
        $this->deleteJson("/api/admin/products/{$product->id}/associations/{$associationIds['up-sell']}")
            ->assertNoContent();
        $this->assertDatabaseMissing('lunar_product_associations', ['id' => $associationIds['up-sell']]);
        $this->assertDatabaseHas('lunar_product_associations', ['id' => $associationIds['alternate']]);
    }

    public function test_direct_variant_update_isolated_from_siblings_options_pivots_and_non_base_prices(): void
    {
        $this->actingAsAdmin();
        $product = $this->product('Variant product');
        $target = $this->variant($product, 'VAR-RED', 10000, 5, [
            'variant_note' => new TranslatedText(['en' => 'Old note', 'vi' => 'Ghi chú cũ']),
        ]);
        $sibling = $this->variant($product, 'VAR-BLUE', 11000, 8);

        $option = ProductOption::query()->create([
            'name' => ['en' => 'Color'],
            'label' => ['en' => 'Color'],
            'handle' => 'color',
            'shared' => true,
        ]);
        $red = ProductOptionValue::query()->create([
            'product_option_id' => $option->id,
            'name' => ['en' => 'Red'],
            'position' => 1,
        ]);
        $blue = ProductOptionValue::query()->create([
            'product_option_id' => $option->id,
            'name' => ['en' => 'Blue'],
            'position' => 2,
        ]);
        $product->productOptions()->attach($option->id, ['position' => 1]);
        $target->values()->attach($red->id);
        $sibling->values()->attach($blue->id);

        $customerGroup = CustomerGroup::query()->create([
            'name' => 'Wholesale',
            'handle' => 'wholesale',
            'default' => false,
        ]);
        $otherCurrency = Currency::query()->create([
            'code' => 'JPY',
            'name' => 'Japanese Yen',
            'exchange_rate' => 1,
            'decimal_places' => 0,
            'enabled' => true,
            'default' => false,
            'sync_prices' => false,
        ]);
        $tierPrice = $target->prices()->create([
            'currency_id' => $this->currency->id,
            'customer_group_id' => null,
            'min_quantity' => 5,
            'price' => 9000,
        ]);
        $groupPrice = $target->prices()->create([
            'currency_id' => $this->currency->id,
            'customer_group_id' => $customerGroup->id,
            'min_quantity' => 1,
            'price' => 8000,
        ]);
        $foreignPrice = $target->prices()->create([
            'currency_id' => $otherCurrency->id,
            'customer_group_id' => null,
            'min_quantity' => 1,
            'price' => 700,
        ]);

        $siblingBefore = (array) DB::table('lunar_product_variants')->where('id', $sibling->id)->first();
        $optionsBefore = DB::table('lunar_product_options')->orderBy('id')->get()->map(fn ($row) => (array) $row)->all();
        $valuesBefore = DB::table('lunar_product_option_values')->orderBy('id')->get()->map(fn ($row) => (array) $row)->all();
        $productOptionsBefore = DB::table('lunar_product_product_option')->orderBy('id')->get()->map(fn ($row) => (array) $row)->all();
        $variantValuesBefore = DB::table('lunar_product_option_value_product_variant')->orderBy('variant_id')->orderBy('value_id')->get()->map(fn ($row) => (array) $row)->all();

        $this->putJson("/api/admin/products/{$product->id}/variants/{$target->id}", [
            'sku' => 'VAR-RED-UPDATED',
            'gtin' => '1234567890123',
            'mpn' => 'MPN-UPDATED',
            'ean' => '9876543210123',
            'stock' => 21,
            'backorder' => 2,
            'purchasable' => 'in_stock_or_on_backorder',
            'unit_quantity' => 2,
            'quantity_increment' => 2,
            'min_quantity' => 2,
            'tax_class_id' => $this->taxClass->id,
            'tax_ref' => 'TAX-REF',
            'shippable' => false,
            'length_value' => 10.5,
            'length_unit' => 'cm',
            'width_value' => 8,
            'width_unit' => 'cm',
            'height_value' => 4,
            'height_unit' => 'cm',
            'weight_value' => 1.2,
            'weight_unit' => 'kg',
            'base_price' => '15.750',
            'attributes' => [
                'variant_note' => ['en' => 'New note', 'vi' => 'Ghi chú mới'],
            ],
        ])->assertOk()
            ->assertJsonPath('data.sku', 'VAR-RED-UPDATED')
            ->assertJsonPath('data.stock', 21)
            ->assertJsonPath('data.base_price', '15.750')
            ->assertJsonPath('data.option_values.0.option_id', $option->id)
            ->assertJsonPath('data.option_values.0.value_id', $red->id);

        $target->refresh();
        $this->assertSame('VAR-RED-UPDATED', $target->sku);
        $this->assertSame(21, $target->stock);
        $this->assertSame('New note', $target->attribute_data->get('variant_note')->getValue()->get('en')->getValue());
        $this->assertSame(15750, (int) $target->prices()
            ->where('currency_id', $this->currency->id)
            ->whereNull('customer_group_id')
            ->where('min_quantity', 1)
            ->sole()
            ->getRawOriginal('price'));

        $this->assertSame($siblingBefore, (array) DB::table('lunar_product_variants')->where('id', $sibling->id)->first());
        $this->assertSame($optionsBefore, DB::table('lunar_product_options')->orderBy('id')->get()->map(fn ($row) => (array) $row)->all());
        $this->assertSame($valuesBefore, DB::table('lunar_product_option_values')->orderBy('id')->get()->map(fn ($row) => (array) $row)->all());
        $this->assertSame($productOptionsBefore, DB::table('lunar_product_product_option')->orderBy('id')->get()->map(fn ($row) => (array) $row)->all());
        $this->assertSame($variantValuesBefore, DB::table('lunar_product_option_value_product_variant')->orderBy('variant_id')->orderBy('value_id')->get()->map(fn ($row) => (array) $row)->all());
        $this->assertSame(9000, (int) $tierPrice->fresh()->getRawOriginal('price'));
        $this->assertSame(8000, (int) $groupPrice->fresh()->getRawOriginal('price'));
        $this->assertSame(700, (int) $foreignPrice->fresh()->getRawOriginal('price'));
        $this->assertSame(2, ProductVariant::query()->where('product_id', $product->id)->count());
    }

    public function test_variant_update_rejects_variant_owned_by_another_product(): void
    {
        $this->actingAsAdmin();
        $product = $this->product('First');
        $other = $this->product('Second');
        $variant = $this->variant($other, 'OTHER-001', 1000);

        $this->putJson("/api/admin/products/{$product->id}/variants/{$variant->id}", $this->variantPayload('OTHER-UPDATED'))
            ->assertNotFound();

        $this->assertSame('OTHER-001', $variant->fresh()->sku);
    }

    public function test_admin_can_manage_options_and_regenerate_matrix_without_changing_unchanged_variant_ids(): void
    {
        $this->actingAsAdmin();
        $product = $this->product('Matrix product');
        $baseVariant = $this->variant($product, 'MATRIX', 10000, 5);

        $options = $this->postJson("/api/admin/products/{$product->id}/options", [
            'options' => [
                ['name' => 'Color', 'values' => [['name' => 'Red'], ['name' => 'Blue']]],
                ['name' => 'Size', 'values' => [['name' => 'Small'], ['name' => 'Medium']]],
            ],
        ])->assertOk()->json('data');

        $this->postJson("/api/admin/products/{$product->id}/variants/generate")
            ->assertOk()
            ->assertJsonCount(4, 'data');

        $firstMatrix = $this->variantIdsByValues($product);
        $this->assertCount(4, $firstMatrix);
        $this->assertContains($baseVariant->id, array_values($firstMatrix));

        $color = $options[0];
        $size = $options[1];
        $red = $color['values'][0];
        $blue = $color['values'][1];
        $small = $size['values'][0];
        $medium = $size['values'][1];

        $this->postJson("/api/admin/products/{$product->id}/options", [
            'options' => [
                ['id' => $color['id'], 'name' => 'Colour', 'values' => [
                    ['id' => $blue['id'], 'name' => 'Blue'],
                    ['id' => $red['id'], 'name' => 'Crimson'],
                ]],
                ['id' => $size['id'], 'name' => 'Size', 'values' => [
                    ['id' => $medium['id'], 'name' => 'Medium'],
                    ['id' => $small['id'], 'name' => 'Small'],
                ]],
            ],
        ])->assertOk();

        $this->postJson("/api/admin/products/{$product->id}/variants/generate")->assertOk();
        $this->assertSame($firstMatrix, $this->variantIdsByValues($product));

        $expandedOptions = $this->postJson("/api/admin/products/{$product->id}/options", [
            'options' => [
                ['id' => $color['id'], 'name' => 'Colour', 'values' => [
                    ['id' => $blue['id'], 'name' => 'Blue'],
                    ['id' => $red['id'], 'name' => 'Crimson'],
                    ['name' => 'Green'],
                ]],
                ['id' => $size['id'], 'name' => 'Size', 'values' => [
                    ['id' => $medium['id'], 'name' => 'Medium'],
                    ['id' => $small['id'], 'name' => 'Small'],
                ]],
            ],
        ])->assertOk()->json('data');
        $green = $expandedOptions[0]['values'][2];

        $this->postJson("/api/admin/products/{$product->id}/variants/generate")
            ->assertOk()
            ->assertJsonCount(6, 'data');
        $expandedMatrix = $this->variantIdsByValues($product);
        foreach ($firstMatrix as $key => $variantId) {
            $this->assertSame($variantId, $expandedMatrix[$key]);
        }

        $blueVariantIds = collect($expandedMatrix)
            ->filter(fn ($variantId, $key) => in_array((string) $blue['id'], explode('-', $key), true))
            ->values();

        $this->postJson("/api/admin/products/{$product->id}/options", [
            'options' => [
                ['id' => $color['id'], 'name' => 'Colour', 'values' => [
                    ['id' => $red['id'], 'name' => 'Crimson'],
                    ['id' => $green['id'], 'name' => 'Green'],
                ]],
                ['id' => $size['id'], 'name' => 'Size', 'values' => [
                    ['id' => $small['id'], 'name' => 'Small'],
                    ['id' => $medium['id'], 'name' => 'Medium'],
                ]],
            ],
        ])->assertOk();
        $this->postJson("/api/admin/products/{$product->id}/variants/generate")
            ->assertOk()
            ->assertJsonCount(4, 'data');

        $reducedMatrix = $this->variantIdsByValues($product);
        foreach ($reducedMatrix as $key => $variantId) {
            $this->assertSame($expandedMatrix[$key], $variantId);
        }
        foreach ($blueVariantIds as $variantId) {
            $this->assertTrue(ProductVariant::withTrashed()->findOrFail($variantId)->trashed());
            $this->assertDatabaseHas('lunar_product_option_value_product_variant', [
                'variant_id' => $variantId,
                'value_id' => $blue['id'],
            ]);
        }
        $this->assertFalse((bool) ProductOptionValue::query()->findOrFail($blue['id'])->meta['admin_active']);

        $activeBeforeCollapse = $product->variants()->pluck('id');
        $this->postJson("/api/admin/products/{$product->id}/options", ['options' => []])
            ->assertOk()
            ->assertJsonPath('data', []);
        $collapsed = $this->postJson("/api/admin/products/{$product->id}/variants/generate")
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->json('data.0.id');
        $this->assertNotContains($collapsed, $activeBeforeCollapse->all());
        foreach ($activeBeforeCollapse as $variantId) {
            $this->assertTrue(ProductVariant::withTrashed()->findOrFail($variantId)->trashed());
        }
    }

    public function test_removing_a_shared_option_only_detaches_it_from_the_current_product(): void
    {
        $this->actingAsAdmin();
        $product = $this->product('Shared option first');
        $other = $this->product('Shared option second');
        $option = ProductOption::query()->create([
            'name' => ['en' => 'Shared color'],
            'label' => ['en' => 'Shared color'],
            'handle' => 'shared-color-test',
            'shared' => true,
        ]);
        $value = $option->values()->create(['name' => ['en' => 'Red'], 'position' => 1]);
        $product->productOptions()->attach($option->id, ['position' => 1]);
        $other->productOptions()->attach($option->id, ['position' => 1]);

        $this->postJson("/api/admin/products/{$product->id}/options", ['options' => []])
            ->assertOk()
            ->assertJsonPath('data', []);

        $this->assertFalse($product->productOptions()->whereKey($option->id)->exists());
        $this->assertTrue($other->productOptions()->whereKey($option->id)->exists());
        $this->assertDatabaseHas('lunar_product_options', ['id' => $option->id]);
        $this->assertDatabaseHas('lunar_product_option_values', ['id' => $value->id]);
    }

    public function test_variant_delete_is_product_scoped_soft_only_and_warns_when_order_history_exists(): void
    {
        $this->actingAsAdmin();
        $product = $this->product('Delete variant product');
        $target = $this->variant($product, 'DELETE-HISTORY', 1000);
        $keeper = $this->variant($product, 'KEEP-VARIANT', 1000);
        $otherProduct = $this->product('Other product');
        $otherVariant = $this->variant($otherProduct, 'OTHER-VARIANT', 1000);
        $orderLine = OrderLine::factory()->create([
            'purchasable_type' => ProductVariant::morphName(),
            'purchasable_id' => $target->id,
        ]);

        $this->getJson("/api/admin/products/{$product->id}")
            ->assertOk()
            ->assertJsonPath('data.variants.0.has_order_history', true)
            ->assertJsonPath('data.variants.1.has_order_history', false);

        $this->deleteJson("/api/admin/products/{$product->id}/variants/{$otherVariant->id}")
            ->assertNotFound();
        $this->assertFalse($otherVariant->fresh()->trashed());

        $this->deleteJson("/api/admin/products/{$product->id}/variants/{$target->id}")
            ->assertNoContent();
        $this->assertSoftDeleted('lunar_product_variants', ['id' => $target->id]);
        $this->assertDatabaseHas('lunar_order_lines', ['id' => $orderLine->id, 'purchasable_id' => $target->id]);
        $this->assertNotNull(ProductVariant::withTrashed()->find($target->id));

        $this->deleteJson("/api/admin/products/{$product->id}/variants/{$keeper->id}")
            ->assertUnprocessable()
            ->assertJsonValidationErrors('variant');
        $this->assertFalse($keeper->fresh()->trashed());
    }

    public function test_dynamic_attribute_money_and_duplicate_media_validation_is_safe(): void
    {
        $this->actingAsAdmin();

        $this->postJson('/api/admin/products', [
            'name' => 'Too precise',
            'product_type_id' => $this->productType->id,
            'sku' => 'PRICE-PRECISION',
            'base_price' => '1.2345',
        ])->assertUnprocessable()->assertJsonValidationErrors('base_price');

        $product = Product::query()->create([
            'product_type_id' => $this->productType->id,
            'status' => 'draft',
            'attribute_data' => ['description' => new Text('No required name')],
        ]);
        $this->variant($product, 'VALIDATION-001', 1000);
        [$curator] = $this->curatorMedia();

        $this->putJson("/api/admin/products/{$product->id}", [
            'status' => 'published',
            'brand_id' => null,
            'attributes' => [
                'name' => 'Valid name',
                'description' => ['not' => 'text'],
            ],
        ])->assertUnprocessable()->assertJsonValidationErrors('attributes.description');

        $this->putJson("/api/admin/products/{$product->id}", [
            'status' => 'published',
            'brand_id' => null,
            'attributes' => ['name' => 'Valid name'],
            'media' => [
                ['source' => 'curator', 'id' => $curator->id],
                ['source' => 'curator', 'id' => $curator->id],
            ],
        ])->assertUnprocessable()->assertJsonValidationErrors('media');

        $this->putJson("/api/admin/products/{$product->id}", [
            'status' => 'published',
            'brand_id' => null,
            'attributes' => ['description' => 'Valid description'],
        ])->assertUnprocessable()->assertJsonValidationErrors('attributes.name');
    }

    public function test_admin_can_bulk_update_status_and_soft_delete_products(): void
    {
        $this->actingAsAdmin();
        $first = $this->product('Bulk first', 'draft');
        $second = $this->product('Bulk second', 'draft');
        $untouched = $this->product('Bulk untouched', 'draft');

        $this->postJson('/api/admin/products/bulk-status', [
            'ids' => [$first->id, $second->id],
            'status' => 'published',
        ])->assertOk()->assertJsonPath('updated', 2);

        $this->assertSame('published', $first->fresh()->status);
        $this->assertSame('published', $second->fresh()->status);
        $this->assertSame('draft', $untouched->fresh()->status);

        $this->postJson('/api/admin/products/bulk-delete', [
            'ids' => [$first->id, $second->id],
        ])->assertNoContent();

        $this->assertSoftDeleted('lunar_products', ['id' => $first->id]);
        $this->assertSoftDeleted('lunar_products', ['id' => $second->id]);
        $this->assertDatabaseHas('lunar_products', ['id' => $untouched->id, 'deleted_at' => null]);
    }

    public function test_product_bulk_actions_validate_ids_and_status(): void
    {
        $this->actingAsAdmin();

        $this->postJson('/api/admin/products/bulk-delete', ['ids' => []])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('ids');
        $this->postJson('/api/admin/products/bulk-status', [
            'ids' => [999999],
            'status' => 'archived',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['ids.0', 'status']);
    }

    public function test_admin_can_soft_delete_product(): void
    {
        $this->actingAsAdmin();
        $product = $this->product('Delete me');
        $this->variant($product, 'DELETE-001', 1000);

        $this->deleteJson("/api/admin/products/{$product->id}")->assertNoContent();

        $this->assertSoftDeleted('lunar_products', ['id' => $product->id]);
        $this->getJson("/api/admin/products/{$product->id}")->assertNotFound();
    }

    private function actingAsAdmin(): User
    {
        $admin = User::factory()->create();
        $admin->assignRole('admin');
        Sanctum::actingAs($admin);

        return $admin;
    }

    private function attribute(
        AttributeGroup $group,
        string $target,
        string $handle,
        string $type,
        bool $required,
        bool $system,
        int $position
    ): Attribute {
        return Attribute::query()->create([
            'attribute_type' => $target,
            'attribute_group_id' => $group->id,
            'position' => $position,
            'name' => ['en' => ucfirst(str_replace('_', ' ', $handle))],
            'description' => ['en' => ''],
            'handle' => $handle,
            'section' => 'main',
            'type' => $type,
            'required' => $required,
            'default_value' => null,
            'configuration' => [],
            'system' => $system,
            'validation_rules' => null,
            'filterable' => false,
            'searchable' => $handle === 'name',
        ]);
    }

    private function product(
        string $name,
        string $status = 'published',
        ?int $brandId = null,
        array $extraAttributes = []
    ): Product {
        return Product::query()->create([
            'product_type_id' => $this->productType->id,
            'status' => $status,
            'brand_id' => $brandId,
            'attribute_data' => array_merge([
                'name' => new Text($name),
            ], $extraAttributes),
        ]);
    }

    private function variant(
        Product $product,
        string $sku,
        int $price,
        int $stock = 0,
        array $attributes = []
    ): ProductVariant {
        $variant = $product->variants()->create([
            'tax_class_id' => $this->taxClass->id,
            'sku' => $sku,
            'stock' => $stock,
            'backorder' => 0,
            'purchasable' => 'always',
            'unit_quantity' => 1,
            'min_quantity' => 1,
            'quantity_increment' => 1,
            'shippable' => true,
            'attribute_data' => $attributes,
        ]);
        $variant->prices()->create([
            'currency_id' => $this->currency->id,
            'customer_group_id' => null,
            'min_quantity' => 1,
            'price' => $price,
        ]);

        return $variant;
    }

    private function variantIdsByValues(Product $product): array
    {
        return $product->variants()->with('values')->orderBy('id')->get()
            ->mapWithKeys(function (ProductVariant $variant): array {
                $key = $variant->values->pluck('id')->map(fn ($id) => (int) $id)->sort()->implode('-');

                return [$key => $variant->id];
            })->sortKeys()->all();
    }

    private function collections(): array
    {
        $group = CollectionGroup::query()->create([
            'name' => 'Categories',
            'handle' => 'categories',
        ]);

        $first = new Collection([
            'collection_group_id' => $group->id,
            'attribute_data' => ['name' => new Text('First')],
        ]);
        $first->saveAsRoot();
        $second = new Collection([
            'collection_group_id' => $group->id,
            'attribute_data' => ['name' => new Text('Second')],
        ]);
        $second->saveAsRoot();

        return [$first, $second];
    }

    private function curatorMedia(): array
    {
        $records = [];

        foreach (['first.jpg', 'second.jpg'] as $index => $name) {
            $path = 'media/'.$name;
            $file = UploadedFile::fake()->image($name, 20, 20);
            Storage::disk('public')->put($path, $file->getContent());
            $records[] = CuratorMedia::query()->create([
                'disk' => 'public',
                'directory' => 'media',
                'visibility' => 'public',
                'name' => $name,
                'path' => $path,
                'width' => 20,
                'height' => 20,
                'size' => Storage::disk('public')->size($path),
                'type' => 'image',
                'ext' => 'jpg',
                'alt' => 'Image '.($index + 1),
            ]);
        }

        return $records;
    }

    private function variantPayload(string $sku): array
    {
        return [
            'sku' => $sku,
            'gtin' => null,
            'mpn' => null,
            'ean' => null,
            'stock' => 1,
            'backorder' => 0,
            'purchasable' => 'always',
            'unit_quantity' => 1,
            'quantity_increment' => 1,
            'min_quantity' => 1,
            'tax_class_id' => $this->taxClass->id,
            'tax_ref' => null,
            'shippable' => true,
            'length_value' => null,
            'length_unit' => null,
            'width_value' => null,
            'width_unit' => null,
            'height_value' => null,
            'height_unit' => null,
            'weight_value' => null,
            'weight_unit' => null,
            'base_price' => '1.000',
            'attributes' => [
                'variant_note' => ['en' => '', 'vi' => ''],
            ],
        ];
    }
}
