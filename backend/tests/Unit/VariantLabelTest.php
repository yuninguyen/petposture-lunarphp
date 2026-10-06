<?php

namespace Tests\Unit;

use App\Support\Orders\VariantLabel;
use Illuminate\Support\Collection;
use PHPUnit\Framework\TestCase;

class VariantLabelTest extends TestCase
{
    private function value(?string $option, string $name): object
    {
        return new class($option, $name)
        {
            public ?object $option;

            public function __construct(?string $option, private string $name)
            {
                $this->option = $option === null ? null : new class($option)
                {
                    public function __construct(private string $name) {}

                    public function translate(string $attribute): string
                    {
                        return $this->name;
                    }
                };
            }

            public function translate(string $attribute): string
            {
                return $this->name;
            }
        };
    }

    private function line(string $type, ?Collection $values): object
    {
        $purchasable = $values === null ? null : new class($values)
        {
            public function __construct(public Collection $values) {}

            // Lunar's ProductVariant exposes values() as the relation and ->values as its loaded collection.
            public function values(): void {}
        };

        return new class($type, $purchasable)
        {
            public function __construct(public string $type, private ?object $purchasable) {}

            public function getRelationValue(string $relation): ?object
            {
                return $this->purchasable;
            }
        };
    }

    public function test_joins_option_name_and_value_for_every_option(): void
    {
        $line = $this->line('physical', collect([$this->value('Size', 'Medium'), $this->value('Color', 'Black')]));

        $this->assertSame('Size: Medium · Color: Black', VariantLabel::forLine($line));
    }

    public function test_falls_back_to_the_bare_value_when_the_option_has_no_name(): void
    {
        $this->assertSame('Medium', VariantLabel::forLine($this->line('physical', collect([$this->value(null, 'Medium')]))));
    }

    public function test_is_null_without_options_without_a_variant_for_shipping_and_for_no_line(): void
    {
        $this->assertNull(VariantLabel::forLine($this->line('physical', collect())));
        $this->assertNull(VariantLabel::forLine($this->line('physical', null)));
        $this->assertNull(VariantLabel::forLine($this->line('shipping', collect([$this->value('Size', 'Medium')]))));
        $this->assertNull(VariantLabel::forLine(null));
    }
}
