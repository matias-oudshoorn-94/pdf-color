<?php

declare(strict_types=1);

namespace App\Core;

/** Límite de intentos por IP + clave, persistido en la tabla rate_limits. */
final class RateLimiter
{
    public static function hit(string $key, string $ip, int $maxAttempts, int $windowSeconds): void
    {
        $identifier = hash('sha256', $key . '|' . $ip);
        $now = time();

        $row = Database::selectOne(
            'SELECT attempts, UNIX_TIMESTAMP(window_start) AS started FROM rate_limits WHERE id = ?',
            [$identifier],
        );

        if ($row === null || ($now - (int) $row['started']) > $windowSeconds) {
            Database::execute(
                'REPLACE INTO rate_limits (id, attempts, window_start) VALUES (?, 1, NOW())',
                [$identifier],
            );

            return;
        }

        if ((int) $row['attempts'] >= $maxAttempts) {
            throw HttpException::tooMany();
        }

        Database::execute('UPDATE rate_limits SET attempts = attempts + 1 WHERE id = ?', [$identifier]);
    }

    public static function clear(string $key, string $ip): void
    {
        Database::execute('DELETE FROM rate_limits WHERE id = ?', [hash('sha256', $key . '|' . $ip)]);
    }
}
