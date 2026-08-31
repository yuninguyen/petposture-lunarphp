<?php

namespace App\Services\AiSeoProviders;

use App\Exceptions\AiSeoGenerationException;

final class AiSeoMetadata
{
    /** @var list<string> */
    public const FIELDS = [
        'seo_title',
        'focus_keyphrase',
        'meta_description',
        'social_title',
        'social_description',
    ];

    public static function schema(): array
    {
        return [
            'type' => 'object',
            'properties' => [
                'seo_title' => [
                    'type' => 'string',
                    'description' => 'Google search title, under 60 characters, includes the primary keyword near the front.',
                ],
                'focus_keyphrase' => [
                    'type' => 'string',
                    'description' => 'The single primary keyword or short phrase this page should rank for.',
                ],
                'meta_description' => [
                    'type' => 'string',
                    'description' => 'Google search meta description, under 160 characters, includes the focus keyphrase, ends with a reason to click.',
                ],
                'social_title' => [
                    'type' => 'string',
                    'description' => 'Open Graph / social share title — can be slightly more attention-grabbing than the SEO title, still accurate.',
                ],
                'social_description' => [
                    'type' => 'string',
                    'description' => 'Open Graph / social share description, under 200 characters.',
                ],
            ],
            'required' => self::FIELDS,
            'additionalProperties' => false,
        ];
    }

    public static function geminiSchema(): array
    {
        $schema = self::schema();
        unset($schema['additionalProperties']);

        return $schema;
    }

    /**
     * @return array{seo_title: string, focus_keyphrase: string, meta_description: string, social_title: string, social_description: string}
     */
    public static function normalize(mixed $value): array
    {
        if (! is_array($value)) {
            throw new AiSeoGenerationException('AI provider returned an invalid SEO response.');
        }

        $metadata = [];

        foreach (self::FIELDS as $field) {
            if (! array_key_exists($field, $value) || ! is_string($value[$field])) {
                throw new AiSeoGenerationException('AI provider returned an invalid SEO response.');
            }

            $metadata[$field] = $value[$field];
        }

        return $metadata;
    }
}
