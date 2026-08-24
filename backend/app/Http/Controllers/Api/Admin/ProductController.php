<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreProductRequest;
use App\Http\Requests\Admin\UpdateProductRequest;
use App\Http\Resources\Admin\ProductResource;
use App\Models\CuratorMedia;
use App\Services\Admin\ProductAttributeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Lunar\Models\Attribute;
use Lunar\Models\Currency;
use Lunar\Models\Product;
use Lunar\Models\ProductType;
use Lunar\Models\ProductVariant;
use Lunar\Models\TaxClass;

class ProductController extends Controller
{
    public function __construct(private readonly ProductAttributeService $attributeService)
    {
    }

    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'search' => ['nullable', 'string', 'max:255'],
            'status' => ['nullable', 'in:draft,published'],
            'brand_id' => ['nullable', 'integer', 'exists:lunar_brands,id'],
            'product_type_id' => ['nullable', 'integer', 'exists:lunar_product_types,id'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $query = Product::query()
            ->with(['productType', 'brand', 'thumbnail', 'collections', 'variants.prices'])
            ->withSum('variants', 'stock')
            ->latest('updated_at')
            ->orderByDesc('id');

        if ($search = trim((string) ($validated['search'] ?? ''))) {
            $like = '%'.strtolower($search).'%';
            $query->where(function ($query) use ($like): void {
                $query->whereRaw('LOWER(CAST(attribute_data AS CHAR)) LIKE ?', [$like])
                    ->orWhereHas('variants', fn ($variantQuery) => $variantQuery->whereRaw('LOWER(sku) LIKE ?', [$like]));
            });
        }

        foreach (['status', 'brand_id', 'product_type_id'] as $filter) {
            if (array_key_exists($filter, $validated) && $validated[$filter] !== null) {
                $query->where($filter, $validated[$filter]);
            }
        }

        $products = $query->paginate($validated['per_page'] ?? 15);
        $currency = Currency::getDefault();

        return response()->json([
            'data' => $products->getCollection()->map(function (Product $product) use ($currency): array {
                $prices = $currency ? $product->variants
                    ->flatMap->prices
                    ->filter(fn ($price) => (int) $price->currency_id === (int) $currency->id
                        && $price->customer_group_id === null
                        && (int) $price->min_quantity === 1) : collect();
                $lowest = $prices->sortBy(fn ($price) => $price->getRawOriginal('price'))->first();

                return [
                    'id' => $product->id,
                    'thumbnail' => $product->thumbnail?->getUrl('small') ?: null,
                    'name' => (string) ($product->translateAttribute('name') ?: 'Untitled product'),
                    'description' => strip_tags((string) $product->translateAttribute('description')),
                    'product_type' => ['id' => $product->productType->id, 'name' => $product->productType->name],
                    'brand' => $product->brand ? ['id' => $product->brand->id, 'name' => $product->brand->name] : null,
                    'first_collection' => $product->collections->first() ? [
                        'id' => $product->collections->first()->id,
                        'name' => (string) $product->collections->first()->translateAttribute('name'),
                    ] : null,
                    'total_stock' => (int) ($product->variants_sum_stock ?? 0),
                    'price' => $lowest ? [
                        'amount' => (int) $lowest->getRawOriginal('price'),
                        'formatted' => $lowest->price->formatted(),
                        'currency' => $currency->code,
                    ] : null,
                    'status' => $product->status,
                    'created_at' => $product->created_at?->toISOString(),
                    'updated_at' => $product->updated_at?->toISOString(),
                ];
            })->values(),
            'meta' => [
                'current_page' => $products->currentPage(),
                'last_page' => $products->lastPage(),
                'per_page' => $products->perPage(),
                'total' => $products->total(),
            ],
        ]);
    }

    public function store(StoreProductRequest $request): JsonResponse
    {
        $validated = $request->validated();

        $product = DB::transaction(function () use ($validated): Product {
            $productType = ProductType::query()->lockForUpdate()->findOrFail($validated['product_type_id']);
            $nameAttribute = Attribute::query()
                ->where('attribute_type', Product::morphName())
                ->where('handle', 'name')
                ->first();
            $currency = Currency::getDefault();
            $taxClass = TaxClass::getDefault();

            if (! $nameAttribute || ! $currency || ! $taxClass) {
                throw ValidationException::withMessages([
                    'product' => 'Product prerequisites are not configured: name attribute, default currency, and default tax class are required.',
                ]);
            }

            $product = Product::query()->create([
                'status' => 'draft',
                'product_type_id' => $productType->id,
                'attribute_data' => [
                    'name' => $this->attributeService->makeNameValue($nameAttribute->type, $validated['name']),
                ],
            ]);
            $variant = $product->variants()->create([
                'tax_class_id' => $taxClass->id,
                'sku' => $validated['sku'],
            ]);
            $variant->prices()->create([
                'min_quantity' => 1,
                'currency_id' => $currency->id,
                'customer_group_id' => null,
                'price' => (int) bcmul((string) $validated['base_price'], (string) $currency->factor, 0),
            ]);

            return $product;
        });

        return (new ProductResource($this->loadProduct($product)))
            ->response()
            ->setStatusCode(Response::HTTP_CREATED);
    }

    public function show(Product $product): ProductResource
    {
        return new ProductResource($this->loadProduct($product));
    }

    public function update(UpdateProductRequest $request, Product $product): ProductResource
    {
        $validated = $request->validated();

        DB::transaction(function () use ($validated, $product): void {
            $locked = Product::query()->lockForUpdate()->findOrFail($product->id);
            $locked->load('productType');
            $locked->attribute_data = $this->attributeService->apply(
                $locked->productType,
                'product',
                $locked->attribute_data ?? collect(),
                $validated['attributes']
            );
            $locked->status = $validated['status'];
            $locked->brand_id = $validated['brand_id'] ?? null;
            $locked->save();

            if (array_key_exists('collections', $validated)) {
                $sync = collect($validated['collections'])->mapWithKeys(
                    fn ($id, $index): array => [(int) $id => ['position' => $index + 1]]
                )->all();
                $locked->collections()->sync($sync);
            }

            if (array_key_exists('media', $validated)) {
                $this->syncMedia($locked, $validated['media']);
            }
        });

        return new ProductResource($this->loadProduct($product->fresh()));
    }

    public function destroy(Product $product): Response
    {
        $product->delete();

        return response()->noContent();
    }

    private function loadProduct(Product $product): Product
    {
        return $product->load([
            'productType',
            'brand',
            'collections',
            'images' => fn ($query) => $query->orderBy('order_column')->orderBy('id'),
            'variants' => fn ($query) => $query->orderBy('id'),
            'variants.product.productType',
            'variants.prices.currency',
            'variants.values' => fn ($query) => $query->orderBy('product_option_id')->orderBy('position')->orderBy('id'),
            'variants.values.option',
        ]);
    }

    private function syncMedia(Product $product, array $requested): void
    {
        $current = $product->images()->lockForUpdate()->get()->keyBy('id');
        $keptIds = [];

        foreach ($requested as $index => $item) {
            if ($item['source'] === 'spatie') {
                $media = $current->get((int) $item['id']);
                if (! $media) {
                    throw ValidationException::withMessages(['media' => 'An existing product image is invalid.']);
                }
            } else {
                $curator = CuratorMedia::query()->find($item['id']);
                if (! $curator) {
                    throw ValidationException::withMessages(['media' => 'A selected media-library image is invalid.']);
                }

                $media = $current->first(fn ($candidate) => (int) $candidate->getCustomProperty('curator_media_id') === (int) $curator->id);
                if (! $media) {
                    $media = $product->addMediaFromDisk($curator->path, $curator->disk)
                        ->usingName($curator->name)
                        ->withCustomProperties(['curator_media_id' => $curator->id, 'primary' => false])
                        ->toMediaCollection(config('lunar.media.collection'));
                    $current->put($media->id, $media);
                }
            }

            $media->order_column = $index + 1;
            $media->setCustomProperty('primary', $index === 0);
            $media->save();
            $keptIds[] = $media->id;
        }

        $current->reject(fn ($media) => in_array($media->id, $keptIds, true))->each->delete();
    }
}
