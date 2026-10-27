<?php

declare(strict_types=1);

namespace App\Models;

use App\Core\Database;
use App\Core\Paginator;

/** Años: lista global, igual que Subject y Career, pero depende del nivel educativo. */
final class Year
{
    public const LEVELS = ['primaria', 'secundaria', 'universitario'];

    public const SORTABLE = [
        'name' => 'name',
        'level' => 'level',
        'files_count' => 'files_count',
        'created_at' => 'created_at',
    ];

    public static function all(string $search = '', ?string $level = null, ?Paginator $page = null): array
    {
        [$where, $params] = self::filters($search, $level);

        $sql = "SELECT y.id, y.level, y.name, y.created_at,
                       (SELECT COUNT(*) FROM files f WHERE f.year_id = y.id) AS files_count
                FROM years y {$where} ";

        $sql .= $page ? $page->orderBy() . ' ' . $page->limit() : 'ORDER BY y.level, y.name';

        return Database::select($sql, $params);
    }

    public static function count(string $search = '', ?string $level = null): int
    {
        [$where, $params] = self::filters($search, $level);

        return (int) Database::selectOne("SELECT COUNT(*) AS total FROM years y {$where}", $params)['total'];
    }

    private static function filters(string $search, ?string $level): array
    {
        $conditions = [];
        $params = [];

        if ($level !== null) {
            $conditions[] = 'y.level = :level';
            $params['level'] = $level;
        }

        if ($search !== '') {
            $conditions[] = 'y.name LIKE :search';
            $params['search'] = '%' . $search . '%';
        }

        return [$conditions === [] ? '' : 'WHERE ' . implode(' AND ', $conditions), $params];
    }

    public static function find(int $id): ?array
    {
        return Database::selectOne('SELECT * FROM years WHERE id = ?', [$id]);
    }

    public static function create(string $level, string $name): array
    {
        return self::find(Database::insert('INSERT INTO years (level, name) VALUES (?, ?)', [$level, $name]));
    }

    public static function update(int $id, string $level, string $name): ?array
    {
        Database::execute('UPDATE years SET level = ?, name = ? WHERE id = ?', [$level, $name, $id]);

        return self::find($id);
    }

    public static function delete(int $id): void
    {
        Database::execute('DELETE FROM years WHERE id = ?', [$id]);
    }

    public static function nameTaken(string $level, string $name, ?int $exceptId = null): bool
    {
        return Database::selectOne(
            'SELECT 1 FROM years WHERE level = ? AND name = ? AND id <> ? LIMIT 1',
            [$level, $name, $exceptId ?? 0],
        ) !== null;
    }
}
