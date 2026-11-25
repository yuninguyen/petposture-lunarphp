<?php

namespace App\Services;

use InvalidArgumentException;

final class StorefrontProjection
{
    private const URL = 'https://petposture.com';

    private const DESCRIPTION = 'Breed-focused pet product recommendations based on practical fit, materials, usability and everyday comfort.';

    // The homepage declares its own metadata (frontend/app/page.tsx), whatever the admin settings say. These must stay
    // the same as there, or the automatic cache purge stops; StorefrontHomepageContractTest compares the two.
    private const HOME_TITLE = 'PetPosture | Dog Product Picks by Breed & Body Type';

    private const HOME_DESCRIPTION = 'Dog product picks matched to breed and body type. Ramp guides for Dachshunds, harness and feeding guides for French Bulldogs. Browse by breed or need.';

    private const HOME_SITE_NAME = 'PetPosture';

    public static function fromPublicData(array $settings, array $banners): array
    {
        foreach (['shop_name', 'shop_logo', 'description', 'social', 'contact'] as $key) {
            if (! array_key_exists($key, $settings)) {
                throw new InvalidArgumentException('Invalid public settings.');
            }
        }
        $name = self::text($settings['shop_name']) ?? 'PetPosture';
        $description = self::text($settings['description']) ?? self::DESCRIPTION;
        $logo = self::text($settings['shop_logo']);
        $social = $settings['social'] ?? [];
        $contact = $settings['contact'] ?? [];
        if (! is_array($social) || ! is_array($contact) || ! array_is_list($banners)) {
            throw new InvalidArgumentException('Invalid public projection.');
        }
        $sameAs = [];
        foreach (['facebook', 'instagram', 'twitter', 'tiktok', 'pinterest', 'youtube'] as $key) {
            $value = self::text($social[$key] ?? null);
            // ECMAScript WhiteSpace + LineTerminator, not PHP trim(). Retain emitted text.
            if ($value !== null && preg_match('/[^\x{0009}-\x{000D}\x{0020}\x{00A0}\x{1680}\x{2000}-\x{200A}\x{2028}\x{2029}\x{202F}\x{205F}\x{3000}\x{FEFF}]/u', $value)) {
                $sameAs[] = $value;
            }
        }
        $organization = ['@type' => 'Organization', '@id' => self::URL.'/#organization', 'name' => $name, 'url' => self::URL];
        if ($logo !== null) {
            $organization['logo'] = $logo;
        }
        $organization['description'] = $description;
        if ($sameAs !== []) {
            $organization['sameAs'] = $sameAs;
        }
        if (($phone = self::text($contact['phone'] ?? null)) !== null) {
            $organization['telephone'] = $phone;
        }
        if (($address = self::text($contact['address'] ?? null)) !== null) {
            $organization['address'] = ['@type' => 'PostalAddress', 'streetAddress' => $address];
        }
        $hero = null;
        $found = false;
        foreach ($banners as $banner) {
            if (! is_array($banner) || ! array_key_exists('title', $banner) || ! array_key_exists('url', $banner)) {
                throw new InvalidArgumentException('Invalid public banner.');
            }
            self::text($banner['title']);
            $url = self::text($banner['url']);
            if (! $found && $banner['title'] === 'hero') {
                $hero = $url;
                $found = true;
            }
        }
        $preview = self::URL.'/assets/banner/social-preview.webp';

        return [
            'organization' => $organization,
            'website' => ['@type' => 'WebSite', '@id' => self::URL.'/#website', 'name' => $name, 'url' => self::URL],
            'metadata' => [
                'title' => self::HOME_TITLE, 'description' => self::HOME_DESCRIPTION,
                'og:site_name' => self::HOME_SITE_NAME, 'og:type' => 'website', 'og:url' => self::URL,
                'og:title' => self::HOME_TITLE, 'og:description' => self::HOME_DESCRIPTION, 'og:image' => $preview,
                'og:image:width' => '1200', 'og:image:height' => '630', 'og:image:alt' => self::HOME_SITE_NAME.' pet products',
                'twitter:card' => 'summary_large_image', 'twitter:title' => self::HOME_TITLE,
                'twitter:description' => self::HOME_DESCRIPTION, 'twitter:image' => $preview,
            ],
            'hero' => $hero ?? '/assets/banner/hero-banner-homepage.webp',
        ];
    }

    private static function text(mixed $value): ?string
    {
        if ($value !== null && (! is_string($value) || ! mb_check_encoding($value, 'UTF-8'))) {
            throw new InvalidArgumentException('Invalid public string.');
        }

        return $value === '' ? null : $value;
    }
}
