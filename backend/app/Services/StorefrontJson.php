<?php

namespace App\Services;

use JsonException;

/** Native JSON validation followed by a string-aware duplicate-member scan. */
final class StorefrontJson
{
    public static function decode(string $json): mixed
    {
        $decoded = json_decode($json, true, 32, JSON_THROW_ON_ERROR);
        $offset = 0;
        self::value($json, $offset);
        return $decoded;
    }

    private static function whitespace(string $json, int &$offset): void
    {
        while (isset($json[$offset]) && str_contains(" \t\r\n", $json[$offset])) {
            $offset++;
        }
    }

    private static function stringToken(string $json, int &$offset): string
    {
        $start = $offset++;
        while (isset($json[$offset])) {
            $char = $json[$offset++];
            if ($char === '\\') {
                $offset++; // Escaped quote/backslash is not the end of this token.
            } elseif ($char === '"') {
                return substr($json, $start, $offset - $start);
            }
        }
        throw new JsonException('Incomplete JSON string.');
    }

    private static function value(string $json, int &$offset): void
    {
        self::whitespace($json, $offset);
        $kind = $json[$offset];
        if ($kind === '"') {
            self::stringToken($json, $offset);
            return;
        }
        if ($kind === '{' || $kind === '[') {
            $offset++;
            $end = $kind === '{' ? '}' : ']';
            $keys = [];
            self::whitespace($json, $offset);
            if ($json[$offset] === $end) {
                $offset++;
                return;
            }
            do {
                self::whitespace($json, $offset);
                if ($kind === '{') {
                    $key = json_decode(self::stringToken($json, $offset), true, 2, JSON_THROW_ON_ERROR);
                    // Prefix prevents PHP numeric-string key conversion; decoded escapes collide.
                    $key = ':'.$key;
                    if (isset($keys[$key])) {
                        throw new JsonException('Duplicate JSON object member.');
                    }
                    $keys[$key] = true;
                    self::whitespace($json, $offset);
                    $offset++; // Colon; grammar was already validated by native decoder.
                }
                self::value($json, $offset);
                self::whitespace($json, $offset);
                $separator = $json[$offset++];
            } while ($separator === ',');
            return;
        }
        while (isset($json[$offset]) && ! str_contains(",]} \t\r\n", $json[$offset])) {
            $offset++;
        }
    }
}
