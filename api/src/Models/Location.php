<?php

declare(strict_types=1);

namespace App\Models;

use App\Core\Database;
use App\Core\Paginator;

final class Location
{
    public const SORTABLE = [
        'name' => 'l.name',
        'institutions_count' => 'institutions_count',
        'created_at' => 'l.created_at',
    ];

    public static function all(string $search = '', ?Paginator $page = null): array
    {
        [$where, $params] = self::filters($search);

        $sql = "SELECT l.id, l.name, l.created_at,
                       (SELECT COUNT(*) FROM institutions i WHERE i.location_id = l.id) AS institutions_count
                FROM locations l {$where} ";

        $sql .= $page ? $page->orderBy() . ' ' . $page->limit() : 'ORDER BY l.name';

        return Database::select($sql, $params);
    }

    public static function count(string $search = ''): int
    {
        [$where, $params] = self::filters($search);

        return (int) Database::selectOne("SELECT COUNT(*) AS total FROM locations l {$where}", $params)['total'];
    }

    private static function filters(string $search): array
    {
        if ($search === '') {
            return ['', []];
        }

        return ['WHERE l.name LIKE :search', ['search' => '%' . $search . '%']];
    }

    public static function find(int $id): ?array
    {
        return Database::selectOne('SELECT * FROM locations WHERE id = ?', [$id]);
    }

    public static function create(string $name): array
    {
        return self::find(Database::insert('INSERT INTO locations (name) VALUES (?)', [$name]));
    }

    public static function update(int $id, string $name): ?array
    {
        Database::execute('UPDATE locations SET name = ? WHERE id = ?', [$name, $id]);

        return self::find($id);
    }

    public static function delete(int $id): void
    {
        Database::execute('DELETE FROM locations WHERE id = ?', [$id]);
    }

    public static function hasInstitutions(int $id): bool
    {
        return Database::selectOne('SELECT 1 FROM institutions WHERE location_id = ? LIMIT 1', [$id]) !== null;
    }

    public static function nameTaken(string $name, ?int $exceptId = null): bool
    {
        return Database::selectOne(
            'SELECT 1 FROM locations WHERE name = ? AND id <> ? LIMIT 1',
            [$name, $exceptId ?? 0],
        ) !== null;
    }
}
