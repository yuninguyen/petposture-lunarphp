<?php

namespace Tests\Feature\Services;

use App\Exceptions\AiSeoGenerationException;
use App\Models\Setting;
use App\Services\AiSeoProviders\AiSeoMetadata;
use App\Services\AiSeoProviders\AnthropicSeoProvider;
use App\Services\AiSeoProviders\GeminiSeoProvider;
use App\Services\AiSeoProviders\GrokSeoProvider;
use App\Services\AiSeoProviders\OpenAiSeoProvider;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class AiSeoProvidersTest extends TestCase
{
    use RefreshDatabase;

    public function test_normalize_returns_exactly_the_five_seo_metadata_fields(): void
    {
        $metadata = AiSeoMetadata::normalize([
            'seo_title' => 'Dog Ramp Guide',
            'focus_keyphrase' => 'dog ramp',
            'meta_description' => 'A grounded dog ramp guide.',
            'social_title' => 'Choose a dog ramp',
            'social_description' => 'Practical dog-ramp fit advice.',
            'unexpected' => 'discarded',
        ]);

        $this->assertSame([
            'seo_title' => 'Dog Ramp Guide',
            'focus_keyphrase' => 'dog ramp',
            'meta_description' => 'A grounded dog ramp guide.',
            'social_title' => 'Choose a dog ramp',
            'social_description' => 'Practical dog-ramp fit advice.',
        ], $metadata);
    }

    public function test_normalize_rejects_a_response_missing_a_required_field(): void
    {
        $this->expectException(AiSeoGenerationException::class);
        $this->expectExceptionMessage('AI provider returned an invalid SEO response.');

        AiSeoMetadata::normalize([
            'seo_title' => 'Dog Ramp Guide',
            'focus_keyphrase' => 'dog ramp',
            'meta_description' => 'A grounded dog ramp guide.',
            'social_title' => 'Choose a dog ramp',
        ]);
    }

    public function test_schema_requires_exactly_the_five_seo_metadata_fields(): void
    {
        $schema = AiSeoMetadata::schema();

        $this->assertSame('object', $schema['type']);
        $this->assertSame([
            'seo_title',
            'focus_keyphrase',
            'meta_description',
            'social_title',
            'social_description',
        ], $schema['required']);
        $this->assertFalse($schema['additionalProperties']);
    }

    public function test_openai_requires_both_an_api_key_and_model(): void
    {
        config()->set('services.openai.key', 'environment-key');
        config()->set('services.openai.model', '');

        $this->assertFalse(app(OpenAiSeoProvider::class)->isConfigured());

        Setting::set('openai_model', 'account-approved-model', 'string', 'ai');

        $this->assertTrue(app(OpenAiSeoProvider::class)->isConfigured());
    }

    public function test_anthropic_uses_the_approved_sonnet_fallback_when_model_is_blank(): void
    {
        config()->set('services.anthropic.key', 'environment-key');
        config()->set('services.anthropic.model', '');

        $provider = app(AnthropicSeoProvider::class);

        $this->assertTrue($provider->isConfigured());
        $this->assertSame('claude-sonnet-5', $provider->model());
    }

    public function test_openai_uses_database_configuration_and_normalizes_its_response(): void
    {
        config()->set('services.openai.key', 'environment-key');
        config()->set('services.openai.model', 'environment-model');
        Setting::set('openai_api_key', 'database-key', 'string', 'ai');
        Setting::set('openai_model', 'database-model', 'string', 'ai');
        Http::fake([
            'https://api.openai.com/v1/chat/completions' => Http::response([
                'choices' => [[
                    'message' => ['content' => json_encode($this->metadata())],
                ]],
            ]),
        ]);

        $this->assertSame($this->metadata(), app(OpenAiSeoProvider::class)->generate('Prompt'));

        Http::assertSent(function (Request $request): bool {
            return $request->url() === 'https://api.openai.com/v1/chat/completions'
                && $request->hasHeader('Authorization', 'Bearer database-key')
                && $request['model'] === 'database-model'
                && data_get($request->data(), 'response_format.json_schema.strict') === true;
        });
    }

    public function test_grok_normalizes_an_openai_compatible_response(): void
    {
        config()->set('services.xai.key', 'xai-key');
        config()->set('services.xai.model', 'grok-account-model');
        Http::fake([
            'https://api.x.ai/v1/chat/completions' => Http::response([
                'choices' => [[
                    'message' => ['content' => json_encode($this->metadata())],
                ]],
            ]),
        ]);

        $this->assertSame($this->metadata(), app(GrokSeoProvider::class)->generate('Prompt'));
    }

    public function test_gemini_normalizes_a_structured_response(): void
    {
        config()->set('services.gemini.key', 'gemini-key');
        config()->set('services.gemini.model', 'gemini-account-model');
        Http::fake([
            '*' => Http::response([
                'candidates' => [[
                    'content' => [
                        'parts' => [['text' => json_encode($this->metadata())]],
                    ],
                ]],
            ]),
        ]);

        $this->assertSame($this->metadata(), app(GeminiSeoProvider::class)->generate('Prompt'));

        Http::assertSent(function (Request $request): bool {
            $schema = data_get($request->data(), 'generationConfig.responseSchema', []);

            return $request->url() === 'https://generativelanguage.googleapis.com/v1beta/models/gemini-account-model:generateContent'
                && $request->hasHeader('x-goog-api-key', 'gemini-key')
                && ! array_key_exists('additionalProperties', $schema);
        });
    }

    public function test_gemini_schema_omits_unsupported_additional_properties_keyword(): void
    {
        $this->assertArrayNotHasKey('additionalProperties', AiSeoMetadata::geminiSchema());
    }

    public function test_provider_rejects_malformed_structured_content(): void
    {
        config()->set('services.openai.key', 'openai-key');
        config()->set('services.openai.model', 'openai-account-model');
        Http::fake([
            'https://api.openai.com/v1/chat/completions' => Http::response([
                'choices' => [[
                    'message' => ['content' => '{not valid json'],
                ]],
            ]),
        ]);

        $this->expectException(AiSeoGenerationException::class);
        $this->expectExceptionMessage('AI provider returned an invalid SEO response.');

        app(OpenAiSeoProvider::class)->generate('Prompt');
    }

    /**
     * @return array{seo_title: string, focus_keyphrase: string, meta_description: string, social_title: string, social_description: string}
     */
    private function metadata(): array
    {
        return [
            'seo_title' => 'Dog Ramp Guide',
            'focus_keyphrase' => 'dog ramp',
            'meta_description' => 'A grounded dog ramp guide.',
            'social_title' => 'Choose a dog ramp',
            'social_description' => 'Practical dog-ramp fit advice.',
        ];
    }
}
