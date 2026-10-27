<?php

declare(strict_types=1);

namespace App\Models;

use App\Core\Database;

/**
 * Intención de pedido pagado con Mercado Pago: se guarda acá con todo ya
 * validado/calculado, y recién se convierte en un pedido real (orders) cuando
 * el pago se confirma. Si el cliente nunca paga, esta fila queda inerte, no
 * aparece en ningún listado.
 */
final class PendingOrder
{
    public static function create(int $userId, array $payload): array
    {
        $id = Database::insert(
            'INSERT INTO pending_orders (user_id, payload) VALUES (?, ?)',
            [$userId, json_encode($payload, JSON_UNESCAPED_UNICODE)],
        );

        return self::find($id);
    }

    public static function find(int $id): ?array
    {
        $row = Database::selectOne(
            'SELECT p.*, TIMESTAMPDIFF(MINUTE, p.created_at, CURRENT_TIMESTAMP) AS age_minutes
             FROM pending_orders p WHERE p.id = ?',
            [$id],
        );

        if ($row === null) {
            return null;
        }

        $row['payload'] = json_decode((string) $row['payload'], true) ?? [];

        return $row;
    }

    public static function setPreference(int $id, string $preferenceId): void
    {
        Database::execute('UPDATE pending_orders SET mp_preference_id = ? WHERE id = ?', [$preferenceId, $id]);
    }

    /** Marca que ya nació el pedido real a partir de esta intención. */
    public static function promote(int $id, int $orderId): void
    {
        Database::execute('UPDATE pending_orders SET promoted_order_id = ? WHERE id = ?', [$orderId, $id]);
    }
}
