<?php

declare(strict_types=1);

namespace App\Models;

use App\Core\Database;
use App\Core\Paginator;

final class Institution
{
    public const SORTABLE = [
        'name' => 'i.name',
        'location_name' => 'l.name',
        'files_count' => 'files_count',
        'created_at' => 'i.created_at',
    ];

    private const SELECT = 'SELECT i.id, i.location_id, i.name, i.created_by_user, i.created_at,
                                   l.name AS location_name,
                                   (SELECT COUNT(*) FROM files f WHERE f.institution_id = i.id) AS files_count
                            FROM institutions i
                            JOIN locations l ON l.id = i.location_id';

    public static function all(string $search = '', ?int $locationId = null, ?Paginator $page = null): array
    {
        [$where, $params] = self::filters($search, $locationId);

        $sql = self::SELECT . " {$where} ";
        $sql .= $page ? $page->orderBy() . ' ' . $page->limit() : 'ORDER BY l.name, i.name';

        return Database::select($sql, $params);
    }

    public static function count(string $search = '', ?int $locationId = null): int
    {
        [$where, $params] = self::filters($search, $locationId);

        return (int) Database::selectOne(
            "SELECT COUNT(*) AS total FROM institutions i JOIN locations l ON l.id = i.location_id {$where}",
            $params,
        )['total'];
    }

    private static function filters(string $search, ?int $locationId): array
    {
        $conditions = [];
        $params = [];

        if ($locationId !== null) {
            $conditions[] = 'i.location_id = :location_id';
            $params['location_id'] = $locationId;
        }

        if ($search !== '') {
            $conditions[] = '(i.name LIKE :s1 OR l.name LIKE :s2)';
            $params['s1'] = $params['s2'] = '%' . $search . '%';
        }

        return [$conditions === [] ? '' : 'WHERE ' . implode(' AND ', $conditions), $params];
    }

    public static function find(int $id): ?array
    {
        return Database::selectOne(self::SELECT . ' WHERE i.id = ?', [$id]);
    }

    public static function create(int $locationId, string $name, bool $byUser = false): array
    {
        return self::find(Database::insert(
            'INSERT INTO institutions (location_id, name, created_by_user) VALUES (?, ?, ?)',
            [$locationId, $name, (int) $byUser],
        ));
    }

    public static function update(int $id, int $locationId, string $name): ?array
    {
        Database::execute('UPDATE institutions SET location_id = ?, name = ? WHERE id = ?', [$locationId, $name, $id]);

        return self::find($id);
    }

    public static function delete(int $id): void
    {
        Database::execute('DELETE FROM institutions WHERE id = ?', [$id]);
    }

    public static function nameTaken(int $locationId, string $name, ?int $exceptId = null): bool
    {
        return Database::selectOne(
            'SELECT 1 FROM institutions WHERE location_id = ? AND name = ? AND id <> ? LIMIT 1',
            [$locationId, $name, $exceptId ?? 0],
        ) !== null;
    }
}
