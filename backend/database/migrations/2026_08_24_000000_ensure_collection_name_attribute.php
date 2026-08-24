<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Lunar\FieldTypes\TranslatedText;
use Lunar\Models\Attribute;
use Lunar\Models\AttributeGroup;
use Lunar\Models\Collection;

return new class extends Migration
{
    public function up(): void
    {
        DB::transaction(function (): void {
            $attributeType = Collection::morphName();

            $attribute = Attribute::query()
                ->where('attribute_type', $attributeType)
                ->where('handle', 'name')
                ->lockForUpdate()
                ->first();

            if ($attribute) {
                if ($attribute->type !== TranslatedText::class) {
                    throw new RuntimeException('The collection name attribute exists but is not a TranslatedText attribute.');
                }

                if ($attribute->attributeGroup?->attributable_type !== $attributeType) {
                    throw new RuntimeException('The collection name attribute belongs to an incompatible attribute group.');
                }

                return;
            }

            $group = AttributeGroup::query()
                ->where('handle', 'collection_details')
                ->lockForUpdate()
                ->first();

            if ($group && $group->attributable_type !== $attributeType) {
                throw new RuntimeException('The collection_details attribute group handle is already used by another attributable type.');
            }

            $group ??= AttributeGroup::query()->create([
                'attributable_type' => $attributeType,
                'name' => ['en' => 'Details'],
                'handle' => 'collection_details',
                'position' => ((int) AttributeGroup::query()
                    ->where('attributable_type', $attributeType)
                    ->max('position')) + 1,
            ]);

            Attribute::query()->create([
                'attribute_type' => $attributeType,
                'attribute_group_id' => $group->id,
                'position' => ((int) Attribute::query()
                    ->where('attribute_type', $attributeType)
                    ->max('position')) + 1,
                'name' => ['en' => 'Name'],
                'description' => ['en' => ''],
                'handle' => 'name',
                'section' => 'main',
                'type' => TranslatedText::class,
                'required' => true,
                'default_value' => null,
                'configuration' => ['richtext' => false],
                'system' => true,
                'validation_rules' => null,
                'filterable' => false,
                'searchable' => true,
            ]);
        });
    }

    public function down(): void
    {
        // Intentionally irreversible: compatible production rows may have been adopted.
    }
};
