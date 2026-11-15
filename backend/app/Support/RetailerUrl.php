<?php

namespace App\Support;

/**
 * The retailer link of a Pick is typed in the admin, so it is only trusted when it is a plain web
 * link. Anything else (javascript:, ftp:, a relative path…) is treated as no link at all.
 */
final class RetailerUrl
{
    public static function web(mixed $value): ?string
    {
        $url = trim((string) $value);

        return filter_var($url, FILTER_VALIDATE_URL) && preg_match('#^https?://#i', $url) ? $url : null;
    }
}
