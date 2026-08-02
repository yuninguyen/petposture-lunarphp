<?php

use Illuminate\Database\Migrations\Migration;
use Lunar\Models\Attribute;
use Lunar\Models\AttributeGroup;

return new class extends Migration
{
    public function up(): void
    {
        $detailsGroup = AttributeGroup::where('attributable_type', 'product')->first();

        if (! $detailsGroup) {
            return;
        }

        if (Attribute::where('attribute_type', 'product')->where('handle', 'breed_tags')->exists()) {
            return;
        }

        $nextPosition = (int) Attribute::where('attribute_type', 'product')->max('position') + 1;

        Attribute::create([
            'attribute_type'     => 'product',
            'attribute_group_id' => $detailsGroup->id,
            'position'           => $nextPosition,
            'name'               => ['en' => 'Breed Tags'],
            'description'        => 'Comma-separated breed-type slugs, e.g. "flat-faced,long-backed"',
            'handle'             => 'breed_tags',
            'section'            => null,
            'type'               => \Lunar\FieldTypes\Text::class,
            'required'           => false,
            'default_value'      => null,
            'configuration'      => ['richtext' => false],
            'system'             => false,
            'validation_rules'   => null,
            'filterable'         => false,
            'searchable'         => false,
        ]);
    }

    public function down(): void
    {
        Attribute::where('attribute_type', 'product')
            ->where('handle', 'breed_tags')
            ->delete();
    }
};
