<?php

namespace App\Support;

use Illuminate\Support\Facades\Http;
use RuntimeException;

/**
 * Downloads an image from a URL typed into an import file. The URL is untrusted, so: only http(s) on the
 * default ports, the host must resolve to public addresses only, the connection is pinned to the address that
 * was checked, redirects are followed by hand and re-checked at every hop, and size and type are limited.
 */
final class SafeImageDownloader
{
    public const MAX_BYTES = 8 * 1024 * 1024;

    private const MAX_REDIRECTS = 3;

    private const TYPES = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp', 'image/gif' => 'gif'];

    /** Throws when the URL could not safely be used; the message is shown to the user. */
    public static function check(string $url): array
    {
        $parts = parse_url($url);

        if (! $parts || ! in_array(strtolower($parts['scheme'] ?? ''), ['http', 'https'], true) || empty($parts['host'])) {
            throw new RuntimeException('Not a web address.');
        }

        $scheme = strtolower($parts['scheme']);
        $port = $parts['port'] ?? ($scheme === 'https' ? 443 : 80);

        if (! in_array($port, [80, 443], true)) {
            throw new RuntimeException('Only the standard web ports are allowed.');
        }

        $host = $parts['host'];
        $ips = filter_var($host, FILTER_VALIDATE_IP) ? [$host] : (gethostbynamel($host) ?: []);

        if ($ips === []) {
            throw new RuntimeException('The host could not be found.');
        }

        foreach ($ips as $ip) {
            if (! filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
                throw new RuntimeException('The address is not a public one.');
            }
        }

        return ['scheme' => $scheme, 'host' => $host, 'port' => $port, 'ip' => $ips[0]];
    }

    /** @return array{bytes: string, extension: string} */
    public static function download(string $url): array
    {
        for ($hop = 0; $hop <= self::MAX_REDIRECTS; $hop++) {
            $target = self::check($url);

            $response = Http::timeout(15)
                ->withOptions([
                    'allow_redirects' => false,
                    'stream' => true,
                    'curl' => [CURLOPT_RESOLVE => ["{$target['host']}:{$target['port']}:{$target['ip']}"]],
                ])
                ->withHeaders(['Accept' => 'image/*', 'User-Agent' => 'Mozilla/5.0 (compatible; PetPostureImport/1.0)'])
                ->get($url);

            if ($response->redirect()) {
                $location = $response->header('Location');
                if ($location === '') {
                    throw new RuntimeException('The redirect has no destination.');
                }
                $url = self::absolute($url, $location);

                continue;
            }

            if (! $response->successful()) {
                throw new RuntimeException("The server answered {$response->status()}.");
            }

            $body = '';
            $stream = $response->toPsrResponse()->getBody();
            while (! $stream->eof()) {
                $body .= $stream->read(65536);
                if (strlen($body) > self::MAX_BYTES) {
                    throw new RuntimeException('The image is larger than 8 MB.');
                }
            }

            $info = @getimagesizefromstring($body);
            $extension = $info ? (self::TYPES[$info['mime']] ?? null) : null;

            if ($extension === null) {
                throw new RuntimeException('The file is not a JPG, PNG, WebP or GIF image.');
            }

            return ['bytes' => $body, 'extension' => $extension];
        }

        throw new RuntimeException('Too many redirects.');
    }

    private static function absolute(string $base, string $location): string
    {
        if (preg_match('#^https?://#i', $location)) {
            return $location;
        }

        $parts = parse_url($base);
        $origin = ($parts['scheme'] ?? 'https').'://'.($parts['host'] ?? '');

        return str_starts_with($location, '/') ? $origin.$location : $origin.'/'.ltrim($location, '/');
    }
}
