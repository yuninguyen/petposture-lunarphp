<?php

namespace App\Services\AiSeoProviders;

class GrokSeoProvider extends OpenAiSeoProvider
{
    public function name(): string
    {
        return 'grok';
    }

    protected function apiKeySetting(): string
    {
        return 'xai_api_key';
    }

    protected function apiKeyConfig(): string
    {
        return 'services.xai.key';
    }

    protected function modelSetting(): string
    {
        return 'xai_model';
    }

    protected function modelConfig(): string
    {
        return 'services.xai.model';
    }

    protected function endpoint(): string
    {
        return 'https://api.x.ai/v1/chat/completions';
    }
}
