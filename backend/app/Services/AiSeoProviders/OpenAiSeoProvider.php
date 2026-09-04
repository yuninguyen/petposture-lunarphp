<?php

namespace App\Services\AiSeoProviders;

use Illuminate\Support\Facades\Http;

class OpenAiSeoProvider extends AbstractAiSeoProvider
{
    public function name(): string
    {
        return 'openai';
    }

    protected function apiKeySetting(): string
    {
        return 'openai_api_key';
    }

    protected function apiKeyConfig(): string
    {
        return 'services.openai.key';
    }

    protected function modelSetting(): string
    {
        return 'openai_model';
    }

    protected function modelConfig(): string
    {
        return 'services.openai.model';
    }

    protected function baseUrlSetting(): ?string
    {
        return 'openai_base_url';
    }

    protected function baseUrlConfig(): ?string
    {
        return 'services.openai.base_url';
    }

    protected function endpoint(): string
    {
        return rtrim($this->baseUrl() ?: 'https://api.openai.com/v1', '/').'/chat/completions';
    }

    /**
     * @return array{seo_title: string, focus_keyphrase: string, meta_description: string, social_title: string, social_description: string}
     */
    public function generate(string $prompt): array
    {
        $this->ensureConfigured();

        $response = Http::acceptJson()
            ->withToken($this->apiKey())
            ->timeout(20)
            ->post($this->endpoint(), [
                'model' => $this->model(),
                'messages' => [[
                    'role' => 'user',
                    'content' => $prompt,
                ]],
                'response_format' => [
                    'type' => 'json_schema',
                    'json_schema' => [
                        'name' => 'ai_seo_metadata',
                        'strict' => true,
                        'schema' => AiSeoMetadata::schema(),
                    ],
                ],
            ]);

        if (! $response->successful()) {
            $this->invalidResponse();
        }

        return $this->decodeMetadata(data_get($response->json(), 'choices.0.message.content'));
    }
}
