<?php

namespace App\Contracts;

interface AiSeoProvider
{
    public function name(): string;

    public function isConfigured(): bool;

    /**
     * @return array{seo_title: string, focus_keyphrase: string, meta_description: string, social_title: string, social_description: string}
     */
    public function generate(string $prompt): array;
}
