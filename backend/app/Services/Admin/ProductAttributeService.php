<?php

namespace App\Services\Admin;

use App\Security\RichTextSanitizer;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;
use Lunar\FieldTypes\Text;
use Lunar\FieldTypes\TranslatedText;
use Lunar\Models\Attribute;
use Lunar\Models\ProductType;

class ProductAttributeService
{
    public function __construct(private readonly RichTextSanitizer $richTextSanitizer) {}

    public function definitions(ProductType $productType, string $target, ?Collection $attributeData = null): array
    {
        return $this->attributes($productType, $target)
            ->map(fn (Attribute $attribute): array => [
                'handle' => $attribute->handle,
                'label' => $attribute->translate('name') ?: $attribute->handle,
                'type' => $this->typeKey($attribute->type),
                'section' => $attribute->section,
                'system' => (bool) $attribute->system,
                'required' => (bool) $attribute->required,
                'value' => $this->serializeValue($attribute, $attributeData?->get($attribute->handle)),
            ])
            ->values()
            ->all();
    }

    public function apply(ProductType $productType, string $target, Collection $current, array $values): Collection
    {
        $attributes = $this->attributes($productType, $target);
        $unknownHandles = collect(array_keys($values))->diff($attributes->pluck('handle'));

        if ($unknownHandles->isNotEmpty()) {
            throw ValidationException::withMessages([
                'attributes' => 'One or more attributes are not mapped to this product type.',
            ]);
        }

        foreach ($attributes as $attribute) {
            if (! array_key_exists($attribute->handle, $values)) {
                continue;
            }

            $value = $this->sanitizeValue($attribute, $values[$attribute->handle]);
            $this->validateValue($attribute, $value);
            $current->put($attribute->handle, $this->makeFieldValue($attribute->type, $value));
        }

        foreach ($attributes->where('required', true) as $attribute) {
            $this->validateValue(
                $attribute,
                $this->serializeValue($attribute, $current->get($attribute->handle))
            );
        }

        return $current;
    }

    public function makeNameValue(string $fieldType, string $name): Text|TranslatedText
    {
        return $fieldType === TranslatedText::class
            ? new TranslatedText(['en' => $name, 'vi' => $name])
            : new Text($name);
    }

    private function attributes(ProductType $productType, string $target): Collection
    {
        $relation = $target === 'variant'
            ? $productType->variantAttributes()
            : $productType->productAttributes();

        return $relation
            ->whereIn('type', [Text::class, TranslatedText::class])
            ->orderBy('position')
            ->get();
    }

    private function typeKey(string $fieldType): string
    {
        return $fieldType === TranslatedText::class ? 'translated_text' : 'text';
    }

    private function serializeValue(Attribute $attribute, mixed $value): string|array
    {
        if ($attribute->type === TranslatedText::class) {
            $translated = $value instanceof TranslatedText ? $value->getValue() : collect();

            return [
                'en' => (string) ($translated->get('en') ?? ''),
                'vi' => (string) ($translated->get('vi') ?? ''),
            ];
        }

        return $value instanceof Text ? (string) $value->getValue() : '';
    }

    private function sanitizeValue(Attribute $attribute, mixed $value): mixed
    {
        if ($attribute->handle !== 'description') {
            return $value;
        }

        if ($attribute->type === TranslatedText::class && is_array($value)) {
            foreach ($value as $locale => $localizedValue) {
                if (is_scalar($localizedValue) || $localizedValue === null) {
                    $value[$locale] = $this->richTextSanitizer->sanitize((string) $localizedValue);
                }
            }

            return $value;
        }

        return is_scalar($value) || $value === null
            ? $this->richTextSanitizer->sanitize((string) $value)
            : $value;
    }

    private function validateValue(Attribute $attribute, mixed $value): void
    {
        if ($attribute->type === TranslatedText::class) {
            if (! is_array($value)) {
                throw ValidationException::withMessages([
                    "attributes.{$attribute->handle}" => 'The translated value must contain English and Vietnamese text.',
                ]);
            }

            foreach (['en', 'vi'] as $locale) {
                $rawLocaleValue = $value[$locale] ?? '';
                if (! is_scalar($rawLocaleValue) && $rawLocaleValue !== null) {
                    throw ValidationException::withMessages([
                        "attributes.{$attribute->handle}.{$locale}" => 'The translated value must be text.',
                    ]);
                }

                $localeValue = trim((string) $rawLocaleValue);
                if ($attribute->required && $localeValue === '') {
                    throw ValidationException::withMessages([
                        "attributes.{$attribute->handle}.{$locale}" => 'This field is required.',
                    ]);
                }
            }

            return;
        }

        if (! is_scalar($value) && $value !== null) {
            throw ValidationException::withMessages([
                "attributes.{$attribute->handle}" => 'The value must be text.',
            ]);
        }

        if ($attribute->required && trim((string) $value) === '') {
            throw ValidationException::withMessages([
                "attributes.{$attribute->handle}" => 'This field is required.',
            ]);
        }
    }

    private function makeFieldValue(string $fieldType, mixed $value): Text|TranslatedText
    {
        if ($fieldType === TranslatedText::class) {
            return new TranslatedText([
                'en' => trim((string) ($value['en'] ?? '')),
                'vi' => trim((string) ($value['vi'] ?? '')),
            ]);
        }

        return new Text(trim((string) $value));
    }
}
