<?php

namespace App\Services\AiSeoProviders;

use App\Contracts\AiSeoProvider;
use App\Exceptions\AiSeoGenerationException;
use App\Models\Setting;

abstract class AbstractAiSeoProvider implements AiSeoProvider
{
    abstract protected function apiKeySetting(): string;

    abstract protected function apiKeyConfig(): string;

    abstract protected function modelSetting(): string;

    abstract protected function modelConfig(): string;

    protected function baseUrlSetting(): ?string
    {
        return null;
    }

    protected function baseUrlConfig(): ?string
    {
        return null;
    }

    protected function apiKey(): string
    {
        return trim((string) (Setting::get($this->apiKeySetting()) ?: config($this->apiKeyConfig(), '')));
    }

    public function model(): string
    {
        return trim((string) (Setting::get($this->modelSetting()) ?: config($this->modelConfig(), '')));
    }

    protected function baseUrl(): string
    {
        if ($this->baseUrlSetting() === null || $this->baseUrlConfig() === null) {
            return '';
        }

        return trim((string) (Setting::get($this->baseUrlSetting()) ?: config($this->baseUrlConfig(), '')));
    }

    public function isConfigured(): bool
    {
        return filled($this->apiKey()) && filled($this->model());
    }

    protected function ensureConfigured(): void
    {
        if (! $this->isConfigured()) {
            throw new AiSeoGenerationException('AI SEO provider is not configured.');
        }
    }

    /**
     * @return array{seo_title: string, focus_keyphrase: string, meta_description: string, social_title: string, social_description: string}
     */
    protected function decodeMetadata(mixed $content): array
    {
        if (! is_string($content)) {
            throw new AiSeoGenerationException('AI provider returned an invalid SEO response.');
        }

        return AiSeoMetadata::normalize(json_decode($content, true));
    }

    protected function invalidResponse(): never
    {
        throw new AiSeoGenerationException('AI provider returned an invalid SEO response.');
    }
}
