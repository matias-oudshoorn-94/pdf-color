<?php

declare(strict_types=1);

/**
 * Reemplazos UTF-8 para las funciones mb_* que usa el proyecto.
 * Solo se activan si el hosting no tiene la extensión mbstring.
 */

if (!function_exists('mb_internal_encoding')) {
    function mb_internal_encoding(?string $encoding = null): string|bool
    {
        return $encoding === null ? 'UTF-8' : true;
    }
}

if (!function_exists('mb_strlen')) {
    function mb_strlen(string $string, ?string $encoding = null): int
    {
        return preg_match_all('/./us', $string) ?: 0;
    }
}

if (!function_exists('mb_substr')) {
    function mb_substr(string $string, int $start, ?int $length = null, ?string $encoding = null): string
    {
        $characters = preg_split('//u', $string, -1, PREG_SPLIT_NO_EMPTY) ?: [];

        return implode('', array_slice($characters, $start, $length));
    }
}

if (!function_exists('mb_strtolower')) {
    function mb_strtolower(string $string, ?string $encoding = null): string
    {
        return function_exists('iconv')
            ? strtolower(iconv('UTF-8', 'UTF-8//IGNORE', $string) ?: $string)
            : strtolower($string);
    }
}
