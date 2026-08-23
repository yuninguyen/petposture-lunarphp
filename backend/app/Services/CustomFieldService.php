<?php

namespace App\Services;

use App\Enums\ErrorCode;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Lunar\FieldTypes\Text;
use Lunar\Models\Attribute;
use Lunar\Models\AttributeGroup;
use Lunar\Models\ProductType;

class CustomFieldService
{
    public function __construct(private readonly AttributeUsageChecker $usageChecker)
    {
    }

    public function manageableQuery()
    {
        return Attribute::query()
            ->whereIn('attribute_type', ['product', 'product_variant'])
            ->where('system', false)
            ->where(function ($query) {
                $query->whereNull('section')->orWhere('section', '!=', 'main');
            })
            ->where('type', Text::class);
    }

    public function create(array $data): Attribute
    {
        return DB::transaction(function () use ($data) {
            $attributeType = $this->attributeType($data['target']);
            $group = $this->getOrCreateGroup($attributeType);

            $attribute = Attribute::create([
                'attribute_type' => $attributeType,
                'attribute_group_id' => $group->id,
                'position' => (int) Attribute::query()->where('attribute_type', $attributeType)->max('position') + 1,
                'name' => array_filter($data['name'], fn ($value) => $value !== null),
                'description' => null,
                'handle' => $data['handle'],
                'section' => 'custom',
                'type' => Text::class,
                'required' => $data['required'],
                'default_value' => null,
                'configuration' => ['richtext' => false],
                'system' => false,
                'validation_rules' => null,
                'filterable' => false,
                'searchable' => false,
            ]);

            $this->attachToProductTypes($attribute, $data['product_type_ids']);

            return $this->withProductTypes($attribute);
        });
    }

    public function update(Attribute $attribute, array $data): Attribute
    {
        return DB::transaction(function () use ($attribute, $data) {
            $currentIds = $this->mappedProductTypeIds($attribute);
            $requestedIds = collect($data['product_type_ids'])->map(fn ($id) => (int) $id)->values();
            $addedIds = $requestedIds->diff($currentIds)->values();
            $removedIds = $currentIds->diff($requestedIds)->values();

            $this->assertCanUnmap($attribute, $removedIds);

            $attribute->update([
                'name' => array_merge($attribute->name?->all() ?? [], $data['name']),
                'required' => $data['required'],
            ]);

            $this->attachToProductTypes($attribute, $addedIds->all());
            $this->detachFromProductTypes($attribute, $removedIds->all());

            return $this->withProductTypes($attribute->fresh());
        });
    }

    public function delete(Attribute $attribute): void
    {
        DB::transaction(function () use ($attribute) {
            $allProductTypeIds = ProductType::query()->pluck('id')->map(fn ($id) => (int) $id);
            $this->assertCanUnmap($attribute, $allProductTypeIds);
            $attribute->delete();
        });
    }

    public function withProductTypes(Attribute $attribute): Attribute
    {
        $productTypes = ProductType::query()
            ->whereHas('mappedAttributes', fn ($query) => $query->whereKey($attribute->id))
            ->orderBy('name')
            ->get();

        return $attribute->setRelation('productTypes', $productTypes);
    }

    private function getOrCreateGroup(string $attributeType): AttributeGroup
    {
        $handle = $attributeType === 'product_variant' ? 'custom_fields_variant' : 'custom_fields_product';
        $group = AttributeGroup::query()->firstOrCreate(
            ['handle' => $handle],
            [
                'attributable_type' => $attributeType,
                'name' => ['en' => 'Custom Fields'],
                'position' => (int) AttributeGroup::query()->where('attributable_type', $attributeType)->max('position') + 1,
            ]
        );

        if ($group->attributable_type !== $attributeType) {
            throw new \LogicException("Attribute group [{$handle}] belongs to an unexpected target.");
        }

        return $group;
    }

    private function mappedProductTypeIds(Attribute $attribute): Collection
    {
        return ProductType::query()
            ->whereHas('mappedAttributes', fn ($query) => $query->whereKey($attribute->id))
            ->pluck('id')
            ->map(fn ($id) => (int) $id);
    }

    /**
     * @param array<int, int> $productTypeIds
     */
    private function attachToProductTypes(Attribute $attribute, array $productTypeIds): void
    {
        ProductType::query()->whereKey($productTypeIds)->each(
            fn (ProductType $productType) => $productType->mappedAttributes()->syncWithoutDetaching([$attribute->id])
        );
    }

    /**
     * @param array<int, int> $productTypeIds
     */
    private function detachFromProductTypes(Attribute $attribute, array $productTypeIds): void
    {
        ProductType::query()->whereKey($productTypeIds)->each(
            fn (ProductType $productType) => $productType->mappedAttributes()->detach($attribute->id)
        );
    }

    private function assertCanUnmap(Attribute $attribute, Collection $productTypeIds): void
    {
        foreach ($productTypeIds as $productTypeId) {
            if (! $this->usageChecker->hasNonNullValue($attribute->attribute_type, $attribute->handle, $productTypeId)) {
                continue;
            }

            throw new HttpResponseException(response()->json([
                'code' => ErrorCode::CUSTOM_FIELD_IN_USE->value,
                'message' => 'The custom field is in use and cannot be unmapped or deleted.',
                'details' => [
                    'attribute_id' => $attribute->id,
                    'product_type_id' => $productTypeId,
                    'target' => $attribute->attribute_type === 'product_variant' ? 'variant' : 'product',
                ],
            ], 409));
        }
    }

    private function attributeType(string $target): string
    {
        return $target === 'variant' ? 'product_variant' : 'product';
    }
}
