<?php

namespace App\Services\AiSeoProviders;

use Illuminate\Support\Facades\Http;

class GeminiSeoProvider extends AbstractAiSeoProvider
{
    /**
     * Gemini 3 models answered in 15 to 45 seconds when measured on 2026-11-22 (about 1,000 to 1,600 "thinking"
     * tokens each time, and a 503 "high demand" now and then), so 20 seconds cut most requests off. PHP allows a web
     * request 210 seconds (docker/uploads.ini) and Cloudflare waits 100, so 60 leaves room for one slow answer.
     */
    private const TIMEOUT_SECONDS = 60;

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
            ->timeout(self::TIMEOUT_SECONDS)
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
                    ] + $this->thinkingConfig(),
                ]
            );

        if (! $response->successful()) {
            $this->invalidResponse();
        }

        return $this->decodeMetadata(data_get($response->json(), 'candidates.0.content.parts.0.text'));
    }

    /**
     * Writing five short SEO fields needs no long reasoning, so Gemini 3 models are asked to think at the "low" level
     * (measured: 0 thinking tokens instead of about 1,000 to 1,600, same quality of answer). Gemini 3 takes
     * thinkingLevel; older models (2.5 and earlier) use a different field, so they are left on their defaults rather
     * than sent a field they may reject. The model name is whatever the admin set in AI Settings.
     *
     * @return array{thinkingConfig?: array{thinkingLevel: string}}
     */
    private function thinkingConfig(): array
    {
        return str_starts_with(strtolower($this->model()), 'gemini-3')
            ? ['thinkingConfig' => ['thinkingLevel' => 'low']]
            : [];
    }
}
