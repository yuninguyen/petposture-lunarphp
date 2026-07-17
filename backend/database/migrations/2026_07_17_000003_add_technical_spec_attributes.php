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

        $nextPosition = (int) Attribute::where('attribute_type', 'product')->max('position') + 1;

        $specs = [
            'material'          => 'Material',
            'weight'            => 'Weight',
            'dimensions'        => 'Dimensions',
            'care_instructions' => 'Care Instructions',
            'warranty'          => 'Warranty',
        ];

        foreach ($specs as $handle => $label) {
            if (Attribute::where('attribute_type', 'product')->where('handle', $handle)->exists()) {
                continue;
            }

            Attribute::create([
                'attribute_type'     => 'product',
                'attribute_group_id' => $detailsGroup->id,
                'position'           => $nextPosition++,
                'name'               => ['en' => $label],
                'description'        => null,
                'handle'             => $handle,
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
    }

    public function down(): void
    {
        Attribute::where('attribute_type', 'product')
            ->whereIn('handle', ['material', 'weight', 'dimensions', 'care_instructions', 'warranty'])
            ->delete();
    }
};
