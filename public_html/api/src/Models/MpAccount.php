<?php

declare(strict_types=1);

namespace App\Models;

use App\Core\Config;
use App\Core\Database;
use App\Services\Secrets;

/**
 * Cuentas de Mercado Pago. Cada punto de retiro puede cobrar en la suya; la cuenta
 * principal cobra los envíos y los puntos sin cuenta asignada. Si no hay ninguna
 * cuenta cargada, se usa mercadopago.access_token de config.php (id null).
 *
 * El access token nunca sale de acá descifrado salvo por accessToken(), que usa
 * el servicio de Mercado Pago. Al panel solo llegan los últimos caracteres.
 */
final class MpAccount
{
    /** Columnas que puede ver el panel: todo menos el token cifrado. */
    private const PUBLIC_FIELDS = 'a.id, a.name, a.token_hint, a.is_test, a.mp_user_id, a.mp_nickname, a.mp_email,
                                   a.is_default, a.is_active, a.created_at';

    /** Todas las cuentas (activas primero) con los puntos de retiro que cobran en cada una. */
    public static function all(): array
    {
        $accounts = Database::select(
            'SELECT ' . self::PUBLIC_FIELDS . ' FROM mp_accounts a ORDER BY a.is_active DESC, a.is_default DESC, a.name',
        );
        $points = Database::select(
            'SELECT id, name, mp_account_id FROM pickup_points WHERE mp_account_id IS NOT NULL ORDER BY name',
        );

        foreach ($accounts as &$account) {
            $account['pickup_points'] = array_values(array_map(
                static fn (array $point): array => ['id' => (int) $point['id'], 'name' => $point['name']],
                array_filter($points, static fn (array $point): bool => (int) $point['mp_account_id'] === (int) $account['id']),
            ));
        }

        return $accounts;
    }

    public static function find(int $id): ?array
    {
        return Database::selectOne('SELECT ' . self::PUBLIC_FIELDS . ' FROM mp_accounts a WHERE a.id = ?', [$id]);
    }

    public static function create(string $name, string $accessToken, array $mpUser, bool $isDefault): array
    {
        $id = Database::transaction(static function () use ($name, $accessToken, $mpUser, $isDefault): int {
            // La primera cuenta que se carga queda como principal aunque no se marque.
            $isFirst = Database::selectOne('SELECT 1 FROM mp_accounts WHERE is_active = 1 LIMIT 1') === null;

            if ($isDefault || $isFirst) {
                Database::execute('UPDATE mp_accounts SET is_default = 0');
            }

            return Database::insert(
                'INSERT INTO mp_accounts (name, access_token_enc, token_hint, is_test, mp_user_id, mp_nickname, mp_email, is_default)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [
                    $name,
                    Secrets::encrypt($accessToken),
                    self::hint($accessToken),
                    (int) self::isTestToken($accessToken),
                    $mpUser['id'] ?? null,
                    $mpUser['nickname'] ?? null,
                    $mpUser['email'] ?? null,
                    (int) ($isDefault || $isFirst),
                ],
            );
        });

        return self::find($id);
    }

    public static function rename(int $id, string $name): void
    {
        Database::execute('UPDATE mp_accounts SET name = ? WHERE id = ?', [$name, $id]);
    }

    public static function replaceToken(int $id, string $accessToken, array $mpUser): void
    {
        Database::execute(
            'UPDATE mp_accounts SET access_token_enc = ?, token_hint = ?, is_test = ?, mp_user_id = ?, mp_nickname = ?, mp_email = ?
             WHERE id = ?',
            [
                Secrets::encrypt($accessToken),
                self::hint($accessToken),
                (int) self::isTestToken($accessToken),
                $mpUser['id'] ?? null,
                $mpUser['nickname'] ?? null,
                $mpUser['email'] ?? null,
                $id,
            ],
        );
    }

    public static function makeDefault(int $id): void
    {
        Database::transaction(static function () use ($id): void {
            Database::execute('UPDATE mp_accounts SET is_default = 0');
            Database::execute('UPDATE mp_accounts SET is_default = 1 WHERE id = ?', [$id]);
        });
    }

    /**
     * Archiva la cuenta: deja de cobrar, y los puntos de retiro que la usaban pasan a la
     * principal. El token se conserva para verificar pagos que lleguen tarde.
     */
    public static function archive(int $id): void
    {
        Database::transaction(static function () use ($id): void {
            Database::execute('UPDATE pickup_points SET mp_account_id = NULL WHERE mp_account_id = ?', [$id]);
            Database::execute('UPDATE mp_accounts SET is_active = 0, is_default = 0 WHERE id = ?', [$id]);
        });
    }

    public static function restore(int $id): void
    {
        Database::execute('UPDATE mp_accounts SET is_active = 1 WHERE id = ?', [$id]);
    }

    public static function nameTaken(string $name, ?int $exceptId = null): bool
    {
        return Database::selectOne(
            'SELECT 1 FROM mp_accounts WHERE name = ? AND id <> ? LIMIT 1',
            [$name, $exceptId ?? 0],
        ) !== null;
    }

    public static function isActive(int $id): bool
    {
        return Database::selectOne('SELECT 1 FROM mp_accounts WHERE id = ? AND is_active = 1', [$id]) !== null;
    }

    /**
     * Cuenta con la que se cobra un pedido: la del punto de retiro si tiene una activa;
     * si no (o es envío), la principal. null = usar el token de config.php.
     */
    public static function forCheckout(?array $pickupPoint): ?int
    {
        $pointAccountId = $pickupPoint['mp_account_id'] ?? null;

        if ($pointAccountId !== null && self::isActive((int) $pointAccountId)) {
            return (int) $pointAccountId;
        }

        $default = Database::selectOne('SELECT id FROM mp_accounts WHERE is_default = 1 AND is_active = 1 LIMIT 1');

        return $default !== null ? (int) $default['id'] : null;
    }

    /**
     * Access token descifrado para hablar con la API. Con id null, el de config.php.
     * Incluye cuentas archivadas: un pago puede llegar después de archivarla.
     */
    public static function accessToken(?int $id): string
    {
        if ($id === null) {
            return (string) Config::get('mercadopago.access_token', '');
        }

        $row = Database::selectOne('SELECT access_token_enc FROM mp_accounts WHERE id = ?', [$id]);

        if ($row === null) {
            return '';
        }

        $token = Secrets::decrypt((string) $row['access_token_enc']);

        if ($token === null) {
            error_log("[mercadopago] no se pudo descifrar el token de la cuenta {$id}: volver a cargarlo desde el admin");
        }

        return $token ?? '';
    }

    public static function exists(int $id): bool
    {
        return Database::selectOne('SELECT 1 FROM mp_accounts WHERE id = ?', [$id]) !== null;
    }

    /** Últimos 4 caracteres, para reconocer el token en el panel sin mostrarlo. */
    private static function hint(string $accessToken): string
    {
        return substr($accessToken, -4);
    }

    private static function isTestToken(string $accessToken): bool
    {
        return str_starts_with($accessToken, 'TEST-');
    }
}
