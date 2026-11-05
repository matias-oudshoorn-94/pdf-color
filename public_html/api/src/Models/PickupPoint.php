<?php

declare(strict_types=1);

namespace App\Models;

use App\Core\Database;
use App\Core\Paginator;

/** Puntos de retiro: lista libre administrable, con dirección para el mapa del checkout. */
final class PickupPoint
{
    public const SORTABLE = [
        'name' => 'p.name',
        'is_active' => 'p.is_active',
        'orders_count' => 'orders_count',
        'created_at' => 'p.created_at',
    ];

    public static function all(string $search = '', ?Paginator $page = null): array
    {
        [$where, $params] = self::filters($search);

        $sql = "SELECT p.id, p.name, p.address, p.notes, p.is_active, p.is_default, p.created_at,
                       p.mp_account_id, a.name AS mp_account_name,
                       (SELECT COUNT(*) FROM orders o WHERE o.pickup_point_id = p.id) AS orders_count
                FROM pickup_points p
                LEFT JOIN mp_accounts a ON a.id = p.mp_account_id {$where} ";

        $sql .= $page ? $page->orderBy() . ' ' . $page->limit() : 'ORDER BY p.name';

        return Database::select($sql, $params);
    }

    public static function count(string $search = ''): int
    {
        [$where, $params] = self::filters($search);

        return (int) Database::selectOne("SELECT COUNT(*) AS total FROM pickup_points p {$where}", $params)['total'];
    }

    private static function filters(string $search): array
    {
        if ($search === '') {
            return ['', []];
        }

        return ['WHERE p.name LIKE :search', ['search' => '%' . $search . '%']];
    }

    /** Puntos activos para el selector público del checkout: el predeterminado primero. */
    public static function active(): array
    {
        return Database::select(
            'SELECT id, name, address, notes, is_default FROM pickup_points WHERE is_active = 1 ORDER BY is_default DESC, name',
        );
    }

    public static function find(int $id): ?array
    {
        return Database::selectOne('SELECT * FROM pickup_points WHERE id = ?', [$id]);
    }

    /** $mpAccountId: cuenta de Mercado Pago con la que cobra (null = la principal). */
    public static function create(string $name, string $address, ?string $notes, bool $isActive, ?int $mpAccountId, bool $isDefault): array
    {
        $id = Database::insert(
            'INSERT INTO pickup_points (name, address, notes, is_active, mp_account_id) VALUES (?, ?, ?, ?, ?)',
            [$name, $address, $notes, (int) $isActive, $mpAccountId],
        );

        self::setDefault($id, $isDefault);

        return self::find($id);
    }

    public static function update(int $id, string $name, string $address, ?string $notes, bool $isActive, ?int $mpAccountId, bool $isDefault): ?array
    {
        Database::execute(
            'UPDATE pickup_points SET name = ?, address = ?, notes = ?, is_active = ?, mp_account_id = ? WHERE id = ?',
            [$name, $address, $notes, (int) $isActive, $mpAccountId, $id],
        );

        self::setDefault($id, $isDefault);

        return self::find($id);
    }

    /** Marca (o desmarca) el punto como predeterminado. Solo puede haber uno: marcarlo desmarca el resto. */
    private static function setDefault(int $id, bool $isDefault): void
    {
        if ($isDefault) {
            Database::execute('UPDATE pickup_points SET is_default = (id = ?)', [$id]);
        } else {
            Database::execute('UPDATE pickup_points SET is_default = 0 WHERE id = ?', [$id]);
        }
    }

    public static function delete(int $id): void
    {
        Database::execute('DELETE FROM pickup_points WHERE id = ?', [$id]);
    }

    public static function nameTaken(string $name, ?int $exceptId = null): bool
    {
        return Database::selectOne(
            'SELECT 1 FROM pickup_points WHERE name = ? AND id <> ? LIMIT 1',
            [$name, $exceptId ?? 0],
        ) !== null;
    }
}
