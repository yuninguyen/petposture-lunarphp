<?php

namespace App\Services\AiSeoProviders;

use Illuminate\Support\Facades\Http;

class GeminiSeoProvider extends AbstractAiSeoProvider
{
    public function name(): string
    {
        return 'gemini';
    }

    protected function apiKeySetting(): string
    {
        return 'gemini_api_key';
    }

    protected function apiKeyConfig(): string
    {
        return 'services.gemini.key';
    }

    protected function modelSetting(): string
    {
        return 'gemini_model';
    }

    protected function modelConfig(): string
    {
        return 'services.gemini.model';
    }

    /**
     * @return array{seo_title: string, focus_keyphrase: string, meta_description: string, social_title: string, social_description: string}
     */
    public function generate(string $prompt): array
    {
        $this->ensureConfigured();

        $response = Http::acceptJson()
            ->withHeaders(['x-goog-api-key' => $this->apiKey()])
            ->timeout(20)
            ->post(
                'https://generativelanguage.googleapis.com/v1beta/models/'.rawurlencode($this->model()).':generateContent',
                [
                    'contents' => [[
                        'role' => 'user',
                        'parts' => [['text' => $prompt]],
                    ]],
                    'generationConfig' => [
                        'responseMimeType' => 'application/json',
                        'responseSchema' => AiSeoMetadata::geminiSchema(),
                    ],
                ]
            );

        if (! $response->successful()) {
            $this->invalidResponse();
        }

        return $this->decodeMetadata(data_get($response->json(), 'candidates.0.content.parts.0.text'));
    }
}
