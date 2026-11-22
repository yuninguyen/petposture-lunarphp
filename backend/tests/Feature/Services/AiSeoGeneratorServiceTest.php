<?php

namespace Tests\Feature\Services;

use App\Exceptions\AiSeoGenerationException;
use App\Models\Setting;
use App\Services\AiSeoGeneratorService;
use App\Services\AiSeoProviders\AnthropicSeoProvider;
use App\Services\AiSeoProviders\GeminiSeoProvider;
use App\Services\AiSeoProviders\GrokSeoProvider;
use App\Services\AiSeoProviders\OpenAiSeoProvider;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class AiSeoGeneratorServiceTest extends TestCase
{
    use RefreshDatabase;

    public function test_auto_uses_anthropic_before_other_configured_providers(): void
    {
        $anthropic = Mockery::mock(AnthropicSeoProvider::class);
        $anthropic->shouldReceive('isConfigured')->andReturnTrue();
        $anthropic->shouldReceive('generate')->once()->with(Mockery::type('string'))->andReturn($this->metadata());
        $openai = $this->unconfigured(OpenAiSeoProvider::class);
        $grok = $this->unconfigured(GrokSeoProvider::class);
        $gemini = $this->unconfigured(GeminiSeoProvider::class);
        $this->bindProviders($anthropic, $openai, $grok, $gemini);

        $this->assertSame($this->metadata(), app(AiSeoGeneratorService::class)->generate('Title', null));
    }

    public function test_selected_provider_is_tried_first_then_falls_back_after_failure(): void
    {
        Setting::set('ai_seo_provider', 'openai', 'string', 'ai');
        $anthropic = Mockery::mock(AnthropicSeoProvider::class);
        $anthropic->shouldReceive('isConfigured')->andReturnTrue();
        $anthropic->shouldReceive('generate')->once()->with(Mockery::type('string'))->andReturn($this->metadata());
        $openai = Mockery::mock(OpenAiSeoProvider::class);
        $openai->shouldReceive('isConfigured')->andReturnTrue();
        $openai->shouldReceive('name')->andReturn('openai');
        $openai->shouldReceive('generate')->once()->with(Mockery::type('string'))->andThrow(new AiSeoGenerationException('provider failure'));
        $grok = $this->unconfigured(GrokSeoProvider::class);
        $gemini = $this->unconfigured(GeminiSeoProvider::class);
        $this->bindProviders($anthropic, $openai, $grok, $gemini);

        $this->assertSame($this->metadata(), app(AiSeoGeneratorService::class)->generate('Title', null));
    }

    public function test_no_configured_provider_returns_a_safe_configuration_message(): void
    {
        $this->bindProviders(
            $this->unconfigured(AnthropicSeoProvider::class),
            $this->unconfigured(OpenAiSeoProvider::class),
            $this->unconfigured(GrokSeoProvider::class),
            $this->unconfigured(GeminiSeoProvider::class),
        );

        $this->expectException(AiSeoGenerationException::class);
        $this->expectExceptionMessage('AI SEO is not configured. Add an API key and model in Settings.');

        app(AiSeoGeneratorService::class)->generate('Title', null);
    }

    public function test_all_configured_provider_failures_return_a_safe_temporary_message(): void
    {
        $anthropic = Mockery::mock(AnthropicSeoProvider::class);
        $anthropic->shouldReceive('isConfigured')->andReturnTrue();
        $anthropic->shouldReceive('name')->andReturn('anthropic');
        $anthropic->shouldReceive('generate')->once()->andThrow(new AiSeoGenerationException('provider failure'));
        $this->bindProviders(
            $anthropic,
            $this->unconfigured(OpenAiSeoProvider::class),
            $this->unconfigured(GrokSeoProvider::class),
            $this->unconfigured(GeminiSeoProvider::class),
        );

        $this->expectException(AiSeoGenerationException::class);
        $this->expectExceptionMessage('AI SEO generation is temporarily unavailable. Please try again later.');

        app(AiSeoGeneratorService::class)->generate('Title', null);
    }

    public function test_invalid_provider_preference_uses_auto_order(): void
    {
        Setting::set('ai_seo_provider', 'unknown', 'string', 'ai');
        $anthropic = Mockery::mock(AnthropicSeoProvider::class);
        $anthropic->shouldReceive('isConfigured')->andReturnTrue();
        $anthropic->shouldReceive('generate')->once()->andReturn($this->metadata());
        $this->bindProviders(
            $anthropic,
            $this->unconfigured(OpenAiSeoProvider::class),
            $this->unconfigured(GrokSeoProvider::class),
            $this->unconfigured(GeminiSeoProvider::class),
        );

        $this->assertSame($this->metadata(), app(AiSeoGeneratorService::class)->generate('Title', null));
    }

    public function test_status_helpers_report_the_ordered_configured_providers(): void
    {
        Setting::set('ai_seo_provider', 'openai', 'string', 'ai');
        $anthropic = Mockery::mock(AnthropicSeoProvider::class);
        $anthropic->shouldReceive('isConfigured')->andReturnTrue();
        $anthropic->shouldReceive('name')->andReturn('anthropic');
        $openai = Mockery::mock(OpenAiSeoProvider::class);
        $openai->shouldReceive('isConfigured')->andReturnTrue();
        $openai->shouldReceive('name')->andReturn('openai');
        $this->bindProviders(
            $anthropic,
            $openai,
            $this->unconfigured(GrokSeoProvider::class),
            $this->unconfigured(GeminiSeoProvider::class),
        );

        $service = app(AiSeoGeneratorService::class);

        $this->assertTrue($service->isConfigured());
        $this->assertSame(['openai', 'anthropic'], $service->configuredProviderNames());
        $this->assertSame('openai', $service->activeProviderName());
    }

    private function bindProviders(object $anthropic, object $openai, object $grok, object $gemini): void
    {
        $this->app->instance(AnthropicSeoProvider::class, $anthropic);
        $this->app->instance(OpenAiSeoProvider::class, $openai);
        $this->app->instance(GrokSeoProvider::class, $grok);
        $this->app->instance(GeminiSeoProvider::class, $gemini);
    }

    /**
     * @return array<string, array{0: string, 1: bool}>
     */
    public static function promptRuleCases(): array
    {
        // content type => whether the "PetPosture does not test products" rule belongs in the prompt
        return [
            'blog' => ['blog', true],
            'pick' => ['pick', true],
            'shop product' => ['product', false],
        ];
    }

    #[DataProvider('promptRuleCases')]
    public function test_prompt_carries_the_rules_that_belong_to_the_content_type(string $contentType, bool $noFirsthandTesting): void
    {
        $prompt = null;
        $anthropic = Mockery::mock(AnthropicSeoProvider::class);
        $anthropic->shouldReceive('isConfigured')->andReturnTrue();
        $anthropic->shouldReceive('generate')->once()->with(Mockery::on(function ($given) use (&$prompt) {
            $prompt = $given;

            return true;
        }))->andReturn($this->metadata());
        $this->bindProviders($anthropic, $this->unconfigured(OpenAiSeoProvider::class), $this->unconfigured(GrokSeoProvider::class), $this->unconfigured(GeminiSeoProvider::class));

        app(AiSeoGeneratorService::class)->generate('Necoichi Bowl', '<p>A tilted bowl.</p>', $contentType);

        $this->assertStringContainsString('Never use a call to action or urgency', $prompt);
        $this->assertStringContainsString('never start a sentence with "Read our"', $prompt);

        if ($noFirsthandTesting) {
            $this->assertStringContainsString('PetPosture does not test products itself', $prompt);
            $this->assertStringContainsString('do not use "we tested", "our review", "hands-on" or "we tried"', $prompt);
        } else {
            $this->assertStringNotContainsString('does not test products itself', $prompt);
        }
    }

    public function test_pick_and_shop_product_use_the_product_page_wording_and_a_post_uses_the_article_wording(): void
    {
        $prompts = [];

        foreach (['pick', 'product', 'blog'] as $contentType) {
            $anthropic = Mockery::mock(AnthropicSeoProvider::class);
            $anthropic->shouldReceive('isConfigured')->andReturnTrue();
            $anthropic->shouldReceive('generate')->once()->with(Mockery::on(function ($given) use (&$prompts, $contentType) {
                $prompts[$contentType] = $given;

                return true;
            }))->andReturn($this->metadata());
            $this->bindProviders($anthropic, $this->unconfigured(OpenAiSeoProvider::class), $this->unconfigured(GrokSeoProvider::class), $this->unconfigured(GeminiSeoProvider::class));

            app(AiSeoGeneratorService::class)->generate('Title', 'Body', $contentType);
        }

        $this->assertStringContainsString('Product name: Title', $prompts['pick']);
        $this->assertStringContainsString('Product name: Title', $prompts['product']);
        $this->assertStringContainsString('Article title: Title', $prompts['blog']);
        $this->assertStringContainsString('Never invent ratings, review counts, prices', $prompts['pick']);
    }

    private function unconfigured(string $class): object
    {
        $provider = Mockery::mock($class);
        $provider->shouldReceive('isConfigured')->andReturnFalse();

        return $provider;
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
