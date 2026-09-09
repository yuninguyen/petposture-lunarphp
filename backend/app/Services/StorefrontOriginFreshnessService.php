<?php

namespace App\Services;

use DOMXPath;
use GuzzleHttp\Psr7\Uri;
use GuzzleHttp\Psr7\UriResolver;
use Masterminds\HTML5;
use RuntimeException;
use Throwable;

class StorefrontOriginFreshnessService
{
    public function matches(string $html, array $expected): bool
    {
        try {
            if (strlen($html) > 2097152 || ! mb_check_encoding($html, 'UTF-8')
                || ! preg_match('~<!doctype\s+html\s*>~i', $html)
                || ! preg_match('~</body>\s*</html>\s*\z~i', $html)) {
                return false;
            }
            $parser = new HTML5(['disable_html_ns' => true]);
            $document = $parser->loadHTML($html);
            if ($parser->hasErrors()) {
                return false;
            }
            $xpath = new DOMXPath($document);
            if ($xpath->query('//*[@nonce] | //base')->length !== 0) {
                return false;
            }
            foreach ($expected['metadata'] as $key => $value) {
                $selector = $key === 'title' ? '//head/title'
                    : (str_starts_with($key, 'og:') ? '//meta[@property="'.$key.'"]' : '//meta[@name="'.$key.'"]');
                $nodes = $xpath->query($selector);
                if ($nodes->length !== 1 || ($key === 'title' ? $nodes[0]->textContent : $nodes[0]->getAttribute('content')) !== $value) {
                    return false;
                }
            }
            $canonical = $xpath->query('//link[@rel="canonical"]');
            if ($canonical->length !== 1 || ! in_array($canonical[0]->getAttribute('href'), ['https://petposture.com', 'https://petposture.com/'], true)) {
                return false;
            }
            $entities = [];
            foreach ($xpath->query('//script[@type="application/ld+json"]') as $script) {
                $root = json_decode($script->textContent, true, 32, JSON_THROW_ON_ERROR);
                if (! is_array($root) || ($root['@context'] ?? null) !== 'https://schema.org' || ! is_array($root['@graph'] ?? null)) {
                    return false;
                }
                foreach ($root['@graph'] as $entity) {
                    if (! is_array($entity) || ! is_string($entity['@id'] ?? null) || isset($entities[$entity['@id']])) {
                        return false;
                    }
                    $entities[$entity['@id']] = $entity;
                }
            }
            foreach (['organization', 'website'] as $key) {
                $wanted = $expected[$key];
                if (! self::sameValue($entities[$wanted['@id']] ?? null, $wanted)) {
                    return false;
                }
            }
            $images = $xpath->query('//img[@alt="Comfortable feeding setup"]');
            if ($images->length !== 1 || $this->source($images[0]->getAttribute('src')) !== $this->absolute($expected['hero'])) {
                return false;
            }
            if ($images[0]->hasAttribute('srcset')) {
                $srcset = $images[0]->getAttribute('srcset');
                if ($srcset === '') {
                    return false;
                }
                foreach (explode(',', $srcset) as $candidate) {
                    if (! preg_match('/^\s*(\S+)\s+([1-9][0-9]*w|(?:[0-9]+\.)?[0-9]+x)\s*$/D', $candidate, $parts)
                        || $this->source($parts[1]) !== $this->absolute($expected['hero'])) {
                        return false;
                    }
                }
            }

            return true;
        } catch (Throwable) {
            return false;
        }
    }

    private static function sameValue(mixed $actual, mixed $expected): bool
    {
        if (! is_array($expected)) {
            return $actual === $expected;
        }
        if (! is_array($actual) || count($actual) !== count($expected) || array_is_list($actual) !== array_is_list($expected)) {
            return false;
        }
        foreach ($expected as $key => $value) {
            if (! array_key_exists($key, $actual) || ! self::sameValue($actual[$key], $value)) {
                return false;
            }
        }

        return true;
    }

    private function source(string $source): string
    {
        $uri = new Uri($this->absolute($source));
        if ($uri->getScheme() === 'https' && $uri->getAuthority() === 'petposture.com' && $uri->getPath() === '/_next/image') {
            $sources = [];
            foreach (explode('&', $uri->getQuery()) as $part) {
                [$key, $value] = array_pad(explode('=', $part, 2), 2, '');
                if (urldecode($key) === 'url') {
                    $sources[] = urldecode($value);
                }
            }
            if (count($sources) !== 1) {
                throw new RuntimeException('Ambiguous image source.');
            }

            return $this->absolute($sources[0]);
        }

        return (string) $uri;
    }

    private function absolute(string $source): string
    {
        if ($source === '' || preg_match('/[\x00-\x20\\\\]/', $source) || preg_match('/%(?![a-fA-F0-9]{2})/', $source)) {
            throw new RuntimeException('Invalid image source.');
        }
        $uri = UriResolver::resolve(new Uri('https://petposture.com/'), new Uri($source));
        if (! in_array($uri->getScheme(), ['http', 'https'], true) || $uri->getHost() === '' || $uri->getUserInfo() !== '' || $uri->getFragment() !== '') {
            throw new RuntimeException('Invalid image authority.');
        }

        return (string) $uri;
    }
}
