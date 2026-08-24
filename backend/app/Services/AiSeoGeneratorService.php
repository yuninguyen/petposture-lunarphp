<?php

namespace App\Services;

use Anthropic\Client;
use App\Models\Setting;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;
use RuntimeException;

class AiSeoGeneratorService
{
    private function apiKey(): string
    {
        return Cache::remember('anthropic_api_key', 300, fn () => Setting::get('anthropic_api_key') ?: (string) config('services.anthropic.key')
        );
    }

    public function isConfigured(): bool
    {
        return filled($this->apiKey());
    }

    /**
     * @return array{seo_title: string, focus_keyphrase: string, meta_description: string, social_title: string, social_description: string}
     */
    public function generate(string $title, ?string $content, string $contentType = 'blog'): array
    {
        if (! $this->isConfigured()) {
            throw new RuntimeException('Anthropic API key is not configured. Add it in Settings, or ANTHROPIC_API_KEY in .env.');
        }

        $plainContent = trim(strip_tags((string) $content));
        $excerpt = Str::limit($plainContent, 3000, '');
        $prompt = match ($contentType) {
            'product' => "You are an SEO copywriter for the PetPosture pet-ergonomics e-commerce store. Given the product name and description below, write SEO metadata for a product detail page. Keep claims grounded in the supplied description, use purchase-intent keywords naturally, and never use clickbait or exaggerated benefits.\n\nProduct name: {$title}\n\nProduct description:\n{$excerpt}",
            default => "You are an SEO copywriter for the PetPosture pet-ergonomics editorial blog. Given the article title and content below, write SEO metadata that is accurate to the content, keyword-relevant, and never clickbait or exaggerated.\n\nArticle title: {$title}\n\nArticle content:\n{$excerpt}",
        };

        $client = new Client(apiKey: $this->apiKey());

        $message = $client->messages->create(
            model: 'claude-opus-5',
            maxTokens: 1024,
            messages: [
                [
                    'role' => 'user',
                    'content' => $prompt,
                ],
            ],
            outputConfig: [
                'format' => [
                    'type' => 'json_schema',
                    'schema' => [
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
                        'required' => ['seo_title', 'focus_keyphrase', 'meta_description', 'social_title', 'social_description'],
                        'additionalProperties' => false,
                    ],
                ],
            ],
        );

        $text = (string) ($message->content[0]->text ?? '');
        $decoded = json_decode($text, true);

        if (! is_array($decoded)) {
            throw new RuntimeException('Anthropic API returned an unexpected response format.');
        }

        return [
            'seo_title' => (string) ($decoded['seo_title'] ?? ''),
            'focus_keyphrase' => (string) ($decoded['focus_keyphrase'] ?? ''),
            'meta_description' => (string) ($decoded['meta_description'] ?? ''),
            'social_title' => (string) ($decoded['social_title'] ?? ''),
            'social_description' => (string) ($decoded['social_description'] ?? ''),
        ];
    }
}
