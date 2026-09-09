<?php

namespace Tests\Fixtures;

final class StorefrontHtml
{
    public static function settings(string $name = 'B'): array
    {
        return ['shop_name' => $name, 'shop_logo' => null, 'description' => 'Committed description', 'social' => [], 'contact' => []];
    }

    public static function render(string $name = 'B', string $hero = '/assets/banner/hero-banner-homepage.webp'): string
    {
        // Fixture builder is independent of production normalization and parser code.
        $title = $name.' — Breed-Focused Pet Product Recommendations';
        $fields = ['description' => 'Committed description', 'og:site_name' => $name, 'og:type' => 'website',
            'og:url' => 'https://petposture.com', 'og:title' => $title, 'og:description' => 'Committed description',
            'og:image' => 'https://petposture.com/assets/banner/social-preview.webp', 'og:image:width' => '1200',
            'og:image:height' => '630', 'og:image:alt' => $name.' pet products', 'twitter:card' => 'summary_large_image',
            'twitter:title' => $title, 'twitter:description' => 'Committed description', 'twitter:image' => 'https://petposture.com/assets/banner/social-preview.webp'];
        $html = '<!DOCTYPE html><html><head><title>'.htmlspecialchars($title).'</title>';
        foreach ($fields as $key => $value) {
            $html .= '<meta '.(str_starts_with($key, 'og:') ? 'property' : 'name').'="'.$key.'" content="'.htmlspecialchars($value).'">';
        }
        $html .= '<link rel="canonical" href="https://petposture.com/"></head><body>';
        $schema = ['@context' => 'https://schema.org', '@graph' => [
            ['@type' => 'Organization', '@id' => 'https://petposture.com/#organization', 'name' => $name, 'url' => 'https://petposture.com', 'description' => 'Committed description'],
            ['@type' => 'WebSite', '@id' => 'https://petposture.com/#website', 'name' => $name, 'url' => 'https://petposture.com'],
        ]];
        $html .= '<script type="application/ld+json">'.json_encode($schema, JSON_HEX_TAG | JSON_THROW_ON_ERROR).'</script>';

        return $html.'<img alt="Comfortable feeding setup" src="'.htmlspecialchars($hero).'"></body></html>';
    }
}
