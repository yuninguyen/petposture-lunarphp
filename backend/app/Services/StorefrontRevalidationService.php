<?php

namespace App\Services;

use GuzzleHttp\Psr7\FnStream;
use GuzzleHttp\Psr7\Utils;
use Illuminate\Support\Facades\Http;
use RuntimeException;

class StorefrontRevalidationService
{
    private int $consumed = 0;

    public function invalidate(float $deadline): void
    {
        $secret = config('services.storefront.revalidation_secret');
        if (! is_string($secret) || $secret === '' || preg_match('/[\r\n]/', $secret)) {
            throw new RuntimeException('Storefront revalidation not configured.');
        }
        $response = $this->request('POST', $this->target('internal_url').'/api/internal/storefront-revalidate',
            ['Accept' => 'application/json', 'Authorization' => 'Bearer '.$secret, 'Host' => 'petposture.com'], $deadline, 4096,
            ['scope' => 'homepage']);
        if ($response['type'] !== 'application/json' || json_decode($response['body'], true, 8, JSON_THROW_ON_ERROR) !== ['revalidated' => true, 'scope' => 'homepage']) {
            throw new RuntimeException('Storefront invalidation not accepted.');
        }
    }

    public function expected(float $deadline): array
    {
        $target = $this->target('backend_internal_url');
        $data = [];
        foreach (['/api/settings', '/api/site-media?collection=banner'] as $path) {
            $response = $this->request('GET', $target.$path, ['Accept' => 'application/json'], $deadline, 262144);
            $body = json_decode($response['body'], true, 32, JSON_THROW_ON_ERROR);
            if ($response['type'] !== 'application/json' || ! is_array($body) || ($body['status'] ?? null) !== 'Request was successful.' || ! is_array($body['data'] ?? null)) {
                throw new RuntimeException('Independent public projection unavailable.');
            }
            if ($path === '/api/settings') {
                StorefrontProjection::fromPublicData($body['data'], []);
            }
            $data[] = $body['data'];
        }

        return StorefrontProjection::fromPublicData($data[0], $data[1]);
    }

    public function homepage(float $deadline): string
    {
        $response = $this->request('GET', $this->target('internal_url').'/',
            ['Host' => 'petposture.com', 'Accept' => 'text/html'], $deadline, 2097152);
        $policy = strtolower($response['cache']);
        if ($response['type'] !== 'text/html' || $response['has_cookie'] || str_contains($response['csp'], 'nonce-')
            || preg_match('/(?:^|,)\s*(?:private|no-store|no-cache)(?:\s|,|=|$)/', $policy)
            || ! preg_match('/(?:^|,)\s*public\s*(?:,|$)/', $policy)
            || ! preg_match('/(?:^|,)\s*s-maxage=[1-9][0-9]*\s*(?:,|$)/', $policy)) {
            throw new RuntimeException('Unsafe public homepage response.');
        }

        return $response['body'];
    }

    private function target(string $key): string
    {
        $target = config('services.storefront.'.$key);
        // Literal private IPs only: no DNS rebinding, public edge, credentials, path or caller URL.
        if (! is_string($target) || ! preg_match('~\Ahttp://(127\.0\.0\.1|10\.[0-9]+\.[0-9]+\.[0-9]+|192\.168\.[0-9]+\.[0-9]+|172\.(?:1[6-9]|2[0-9]|3[01])\.[0-9]+\.[0-9]+):([0-9]{1,5})\z~D', $target, $parts)
            || ! filter_var($parts[1], FILTER_VALIDATE_IP, FILTER_FLAG_IPV4) || (int) $parts[2] < 1 || (int) $parts[2] > 65535) {
            throw new RuntimeException('Pinned private storefront target not configured.');
        }

        return $target;
    }

    private function request(string $method, string $url, array $headers, float $deadline, int $limit, ?array $json = null): array
    {
        $remaining = $deadline - hrtime(true) / 1e9;
        if ($remaining <= 0 || ! extension_loaded('curl')) {
            throw new RuntimeException('Storefront request deadline unavailable.');
        }
        $bytes = 0;
        $budgetExceeded = false;
        $stream = Utils::streamFor('');
        $sink = FnStream::decorate($stream, ['write' => function (string $chunk) use ($stream, &$bytes, &$budgetExceeded, $limit, $deadline): int {
            $length = strlen($chunk);
            if ($bytes + $length > $limit || $this->consumed + $length > 13107200 || hrtime(true) / 1e9 >= $deadline) {
                $budgetExceeded = true;
                // A short native write aborts cURL immediately; throwing through its
                // callback can defer unwinding until the transfer timeout on Windows.
                return 0;
            }
            $bytes += $length;
            $this->consumed += $length;

            return $stream->write($chunk);
        }]);
        $body = null;
        try {
            $pending = Http::withHeaders($headers)->withOptions([
                'allow_redirects' => false, 'cookies' => false, 'proxy' => '',
                'timeout' => min(10, $remaining), 'connect_timeout' => min(3, $remaining),
                'stream' => false, 'sink' => $sink, 'decode_content' => false,
                'on_headers' => function ($response) use ($limit): void {
                    $length = $response->getHeaderLine('Content-Length');
                    if ($response->getStatusCode() !== 200 || ($length !== '' && (! ctype_digit($length) || (float) $length > $limit))) {
                        throw new RuntimeException('Storefront response rejected.');
                    }
                },
            ]);
            $response = $json === null ? $pending->send($method, $url) : $pending->send($method, $url, ['json' => $json]);
            $body = $response->toPsrResponse()->getBody();
            if ($budgetExceeded) {
                throw new RuntimeException('Storefront body budget exceeded.');
            }
            if ($response->status() !== 200 || hrtime(true) / 1e9 >= $deadline
                || ($response->header('Content-Length') !== '' && (! ctype_digit($response->header('Content-Length')) || (float) $response->header('Content-Length') > $limit))) {
                throw new RuntimeException('Storefront response rejected.');
            }
            // Production cURL writes through the bounded sink. This second read is also
            // bounded, but Laravel's fake sink adapter may already buffer a fake body;
            // fake responses are not evidence of bounded transport consumption.
            $body->rewind();
            $text = '';
            while (! $body->eof()) {
                $chunk = $body->read(8192);
                if ($chunk === '' && ! $body->eof()) {
                    throw new RuntimeException('Incomplete storefront body.');
                }
                if (strlen($text) + strlen($chunk) > $limit || hrtime(true) / 1e9 >= $deadline) {
                    throw new RuntimeException('Storefront body budget exceeded.');
                }
                if ($bytes === 0) {
                    $this->consumed += strlen($chunk);
                    if ($this->consumed > 13107200) {
                        throw new RuntimeException('Storefront total body budget exceeded.');
                    }
                }
                $text .= $chunk;
            }
            $body->close();
            $length = $response->header('Content-Length');
            if (($length !== '' && (float) $length !== (float) strlen($text))
                || ! in_array(strtolower($response->header('Content-Encoding')), ['', 'identity'], true)) {
                throw new RuntimeException('Incomplete or encoded storefront body.');
            }

            return ['body' => $text, 'type' => strtolower(trim(explode(';', $response->header('Content-Type'))[0])),
                'cache' => $response->header('Cache-Control'), 'has_cookie' => $response->toPsrResponse()->hasHeader('Set-Cookie'),
                'csp' => $response->header('Content-Security-Policy')];
        } catch (\Throwable $error) {
            if ($budgetExceeded) {
                throw new RuntimeException('Storefront body budget exceeded.');
            }
            throw $error;
        } finally {
            try {
                $body?->close();
            } finally {
                $sink->close();
            }
        }
    }
}
