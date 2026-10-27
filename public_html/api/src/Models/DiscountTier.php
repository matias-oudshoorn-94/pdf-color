<?php

declare(strict_types=1);

namespace App\Models;

use App\Core\Database;
use App\Core\Paginator;

/** Escalones de descuento por cantidad de páginas, evaluados por ítem del pedido. */
final class DiscountTier
{
    public const SORTABLE = [
        'min_pages' => 'min_pages',
        'discount_percent' => 'discount_percent',
        'created_at' => 'created_at',
    ];

    public static function all(?Paginator $page = null): array
    {
        $sql = 'SELECT id, min_pages, discount_percent, created_at FROM discount_tiers ';
        $sql .= $page ? $page->orderBy() . ' ' . $page->limit() : 'ORDER BY min_pages';

        return Database::select($sql);
    }

    public static function count(): int
    {
        return (int) Database::selectOne('SELECT COUNT(*) AS total FROM discount_tiers')['total'];
    }

    /** Escalones para el estimado en vivo del checkout público. */
    public static function allActive(): array
    {
        return Database::select('SELECT min_pages, discount_percent FROM discount_tiers ORDER BY min_pages');
    }

    /** Mayor descuento aplicable: el escalón con min_pages más alto que no supere $totalPages. 0 si ninguno aplica. */
    public static function bestDiscountFor(int $totalPages): float
    {
        $row = Database::selectOne(
            'SELECT discount_percent FROM discount_tiers WHERE min_pages <= ? ORDER BY min_pages DESC LIMIT 1',
            [$totalPages],
        );

        return $row !== null ? (float) $row['discount_percent'] : 0.0;
    }

    public static function find(int $id): ?array
    {
        return Database::selectOne('SELECT * FROM discount_tiers WHERE id = ?', [$id]);
    }

    public static function create(int $minPages, float $discountPercent): array
    {
        $id = Database::insert(
            'INSERT INTO discount_tiers (min_pages, discount_percent) VALUES (?, ?)',
            [$minPages, $discountPercent],
        );

        return self::find($id);
    }

    public static function update(int $id, int $minPages, float $discountPercent): ?array
    {
        Database::execute(
            'UPDATE discount_tiers SET min_pages = ?, discount_percent = ? WHERE id = ?',
            [$minPages, $discountPercent, $id],
        );

        return self::find($id);
    }

    public static function delete(int $id): void
    {
        Database::execute('DELETE FROM discount_tiers WHERE id = ?', [$id]);
    }

    public static function minPagesTaken(int $minPages, ?int $exceptId = null): bool
    {
        return Database::selectOne(
            'SELECT 1 FROM discount_tiers WHERE min_pages = ? AND id <> ? LIMIT 1',
            [$minPages, $exceptId ?? 0],
        ) !== null;
    }
}
