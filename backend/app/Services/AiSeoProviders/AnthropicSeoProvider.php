<?php

namespace App\Services\AiSeoProviders;

use Anthropic\Client;

class AnthropicSeoProvider extends AbstractAiSeoProvider
{
    public function name(): string
    {
        return 'anthropic';
    }

    protected function apiKeySetting(): string
    {
        return 'anthropic_api_key';
    }

    protected function apiKeyConfig(): string
    {
        return 'services.anthropic.key';
    }

    protected function modelSetting(): string
    {
        return 'anthropic_model';
    }

    protected function modelConfig(): string
    {
        return 'services.anthropic.model';
    }

    public function model(): string
    {
        return parent::model() ?: 'claude-sonnet-5';
    }

    /**
     * @return array{seo_title: string, focus_keyphrase: string, meta_description: string, social_title: string, social_description: string}
     */
    public function generate(string $prompt): array
    {
        $this->ensureConfigured();

        $message = (new Client(apiKey: $this->apiKey()))->messages->create(
            model: $this->model(),
            maxTokens: 1024,
            messages: [[
                'role' => 'user',
                'content' => $prompt,
            ]],
            outputConfig: [
                'format' => [
                    'type' => 'json_schema',
                    'schema' => AiSeoMetadata::schema(),
                ],
            ],
        );

        return $this->decodeMetadata($message->content[0]->text ?? null);
    }
}
