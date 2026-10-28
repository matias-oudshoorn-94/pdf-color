<?php

declare(strict_types=1);

namespace App\Models;

use App\Core\Database;

/**
 * Precios por cantidad según la faz: "desde X páginas, $Y por página".
 * El rango se evalúa por ítem del pedido (páginas del archivo × copias) y
 * todas las páginas del ítem se cobran al precio de ese rango.
 */
final class PriceTier
{
    public const SIDES = ['doble', 'simple'];

    /** Todos los rangos agrupados por faz y ordenados: ['doble' => [...], 'simple' => [...]]. */
    public static function grouped(): array
    {
        $rows = Database::select(
            'SELECT id, side, min_pages, price_per_page FROM price_tiers ORDER BY side, min_pages',
        );
        $grouped = array_fill_keys(self::SIDES, []);

        foreach ($rows as $row) {
            $grouped[$row['side']][] = [
                'id' => (int) $row['id'],
                'min_pages' => (int) $row['min_pages'],
                'price_per_page' => (float) $row['price_per_page'],
            ];
        }

        return $grouped;
    }

    /**
     * Precio por página para esa faz y esa cantidad de páginas: el del rango con
     * "desde" más alto que no la supere. Si la cantidad queda por debajo del primer
     * rango, se usa el primero. null si no hay rangos cargados para esa faz.
     */
    public static function pricePerPage(string $side, int $totalPages): ?float
    {
        $row = Database::selectOne(
            'SELECT price_per_page FROM price_tiers WHERE side = ? AND min_pages <= ? ORDER BY min_pages DESC LIMIT 1',
            [$side, $totalPages],
        ) ?? Database::selectOne(
            'SELECT price_per_page FROM price_tiers WHERE side = ? ORDER BY min_pages LIMIT 1',
            [$side],
        );

        return $row !== null ? (float) $row['price_per_page'] : null;
    }

    public static function find(int $id): ?array
    {
        return Database::selectOne('SELECT * FROM price_tiers WHERE id = ?', [$id]);
    }

    public static function create(string $side, int $minPages, float $pricePerPage): array
    {
        $id = Database::insert(
            'INSERT INTO price_tiers (side, min_pages, price_per_page) VALUES (?, ?, ?)',
            [$side, $minPages, $pricePerPage],
        );

        return self::find($id);
    }

    public static function update(int $id, string $side, int $minPages, float $pricePerPage): ?array
    {
        Database::execute(
            'UPDATE price_tiers SET side = ?, min_pages = ?, price_per_page = ? WHERE id = ?',
            [$side, $minPages, $pricePerPage, $id],
        );

        return self::find($id);
    }

    public static function delete(int $id): void
    {
        Database::execute('DELETE FROM price_tiers WHERE id = ?', [$id]);
    }

    public static function minPagesTaken(string $side, int $minPages, ?int $exceptId = null): bool
    {
        return Database::selectOne(
            'SELECT 1 FROM price_tiers WHERE side = ? AND min_pages = ? AND id <> ? LIMIT 1',
            [$side, $minPages, $exceptId ?? 0],
        ) !== null;
    }
}
