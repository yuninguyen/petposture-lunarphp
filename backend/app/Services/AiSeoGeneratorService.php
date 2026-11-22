<?php

namespace App\Services;

use App\Contracts\AiSeoProvider;
use App\Exceptions\AiSeoGenerationException;
use App\Models\Setting;
use App\Services\AiSeoProviders\AnthropicSeoProvider;
use App\Services\AiSeoProviders\GeminiSeoProvider;
use App\Services\AiSeoProviders\GrokSeoProvider;
use App\Services\AiSeoProviders\OpenAiSeoProvider;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Throwable;

class AiSeoGeneratorService
{
    // The same two rules are written in admin/src/features/posts/seoPrompt.ts for the "Copy prompt" button; keep them in step.
    private const NO_FIRSTHAND_TESTING = 'PetPosture does not test products itself. Never write as if PetPosture tested, reviewed or handled the product firsthand: do not use "we tested", "our review", "hands-on" or "we tried". Passing on what the seller says or what customers say is fine when the supplied content says it.';

    private const NO_CALL_TO_ACTION = 'Never use a call to action or urgency: no "today", "now", "don\'t miss" or "shop now", and never start a sentence with "Read our".';

    public function __construct(
        private AnthropicSeoProvider $anthropic,
        private OpenAiSeoProvider $openai,
        private GrokSeoProvider $grok,
        private GeminiSeoProvider $gemini,
    ) {}

    public function isConfigured(): bool
    {
        return $this->configuredProviders() !== [];
    }

    /** @return list<string> */
    public function configuredProviderNames(): array
    {
        return array_map(
            fn (AiSeoProvider $provider) => $provider->name(),
            $this->configuredProviders(),
        );
    }

    public function activeProviderName(): ?string
    {
        return $this->configuredProviderNames()[0] ?? null;
    }

    /**
     * @return array{seo_title: string, focus_keyphrase: string, meta_description: string, social_title: string, social_description: string}
     */
    public function generate(string $title, ?string $content, string $contentType = 'blog'): array
    {
        $providers = $this->configuredProviders();

        if ($providers === []) {
            throw new AiSeoGenerationException('AI SEO is not configured. Add an API key and model in Settings.');
        }

        $prompt = $this->prompt($title, $content, $contentType);

        foreach ($providers as $provider) {
            try {
                return $provider->generate($prompt);
            } catch (Throwable $exception) {
                Log::warning('AI SEO provider failed', [
                    'provider' => $provider->name(),
                    'exception' => $exception::class,
                ]);
            }
        }

        throw new AiSeoGenerationException('AI SEO generation is temporarily unavailable. Please try again later.');
    }

    /** @return list<AiSeoProvider> */
    private function configuredProviders(): array
    {
        return array_values(array_filter(
            $this->orderedProviders(),
            fn (AiSeoProvider $provider) => $provider->isConfigured(),
        ));
    }

    /** @return list<AiSeoProvider> */
    private function orderedProviders(): array
    {
        $providers = [
            'anthropic' => $this->anthropic,
            'openai' => $this->openai,
            'grok' => $this->grok,
            'gemini' => $this->gemini,
        ];
        $preferred = (string) Setting::get('ai_seo_provider', 'auto');

        if (! array_key_exists($preferred, $providers)) {
            return array_values($providers);
        }

        return [
            $providers[$preferred],
            ...array_values(array_filter(
                $providers,
                fn (string $name) => $name !== $preferred,
                ARRAY_FILTER_USE_KEY,
            )),
        ];
    }

    private function prompt(string $title, ?string $content, string $contentType): string
    {
        $plainContent = trim(strip_tags((string) $content));
        $excerpt = Str::limit($plainContent, 3000, '');
        $positioning = "PetPosture is a breed-focused product recommendation brand that helps dog owners narrow product choices based on how their dog is built, everyday challenges, practical fit, dimensions, materials, usability, cleaning, and access.\n\n"
            .'Never make veterinary, clinical, injury-prevention, posture-correction, testing, or unsupported health claims. Never invent ratings, review counts, prices, test evidence, merchant availability, or numerical proof. Only use claims supported by the supplied content.';

        // A Pick and the editorial pages (posts, breeds, solutions) share both rules. A Shop product is sold by PetPosture
        // itself, so "we do not test products" is not assumed for it; only the call-to-action rule applies.
        $rules = match ($contentType) {
            'product' => self::NO_CALL_TO_ACTION,
            default => self::NO_FIRSTHAND_TESTING."\n\n".self::NO_CALL_TO_ACTION,
        };

        return match ($contentType) {
            'pick', 'product' => "{$positioning}\n\n{$rules}\n\nYou are writing SEO metadata for a product detail page. Keep claims grounded in the supplied description, use purchase-intent keywords naturally, and never use clickbait or exaggerated benefits.\n\nProduct name: {$title}\n\nProduct description:\n{$excerpt}",
            default => "{$positioning}\n\n{$rules}\n\nYou are writing SEO metadata for an editorial blog article. Keep claims accurate to the supplied content, keyword-relevant, and never clickbait or exaggerated.\n\nArticle title: {$title}\n\nArticle content:\n{$excerpt}",
        };
    }
}
