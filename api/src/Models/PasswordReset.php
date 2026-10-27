<?php

declare(strict_types=1);

namespace App\Models;

use App\Core\Database;

/** Tokens de un solo uso para "olvidé mi contraseña". */
final class PasswordReset
{
    private const TTL_SECONDS = 3600;

    /** Genera un token, guarda solo su hash, y devuelve el token crudo (va en el link del mail). */
    public static function create(int $userId): string
    {
        $token = bin2hex(random_bytes(32));

        Database::execute(
            'INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
            [$userId, hash('sha256', $token), date('Y-m-d H:i:s', time() + self::TTL_SECONDS)],
        );

        return $token;
    }

    /** Token válido (no usado, no vencido) + datos del usuario, o null. */
    public static function findValidByToken(string $token): ?array
    {
        return Database::selectOne(
            'SELECT pr.id, pr.user_id, u.name, u.email
             FROM password_resets pr
             JOIN users u ON u.id = pr.user_id
             WHERE pr.token_hash = ? AND pr.used_at IS NULL AND pr.expires_at > NOW()
             ORDER BY pr.id DESC
             LIMIT 1',
            [hash('sha256', $token)],
        );
    }

    public static function markUsed(int $id): void
    {
        Database::execute('UPDATE password_resets SET used_at = NOW() WHERE id = ?', [$id]);
    }
}
